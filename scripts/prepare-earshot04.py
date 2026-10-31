"""Build-only Earshot 0.4 bank selection and full launch kit. No model imports.

Uses the existing private numpy/scipy environment; never installs a user runtime.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import sys
import types

CONFIG = Path(__file__).parent / 'data/earshot04-selection.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_digest(root):
    lines = [p.relative_to(root).as_posix() + ':' + sha(p.read_bytes())
             for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts
             and '.git' not in p.parts and (p.suffix in ('.py', '.json') or p.name in ('LICENSE', 'CREDITS_FIT.md'))]
    return sha('\n'.join(sorted(lines)).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    root, out = args.source.resolve(), args.out.resolve()
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    if source_digest(root) != config['sourceTreeSha256']:
        raise RuntimeError('Pinned source differs: review before rebuilding')
    import numpy as np
    import scipy
    if (np.__version__, scipy.__version__) != ('2.2.6', '1.15.3'):
        raise RuntimeError('Use the private pinned numpy/scipy build environment')
    sys.path.insert(0, str(root))
    import earshot
    if earshot.__version__ != '0.4.0':
        raise RuntimeError('Expected Earshot 0.4.0')
    forge = types.ModuleType('earshot.forge')
    forge.__path__ = [str(root / 'earshot/forge')]
    sys.modules['earshot.forge'] = forge
    bank = importlib.import_module('earshot.forge.bank')
    kit = importlib.import_module('earshot.forge.kit')
    out.mkdir(parents=True, exist_ok=True)

    def save(name, audio):
        if audio.ndim == 1:
            audio = np.column_stack((audio, audio))
        if audio.shape[1] != 2 or not np.isfinite(audio).all() or np.abs(audio).max() >= 1:
            raise RuntimeError('Invalid audio: ' + name)
        path = out / name
        path.write_bytes(audio.astype('<f4').tobytes())
        return len(audio)

    entries = []
    for selected in config['entries']:
        sid = selected['id']
        recipe = bank.get(sid)
        audio, meta = bank.render(sid, peak_db=-6, sr=48000, checks=True)
        if not meta['checks']['ok']:
            raise RuntimeError('Technical audit failed: ' + sid + ': ' + str(meta['checks']))
        filename = sid.replace('/', '--') + '.f32'
        entries.append(dict(selected, pcm=filename, frames=save(filename, audio), source=recipe.get('source'),
                            recipeSha256=sha(json.dumps(recipe, sort_keys=True, separators=(',', ':')).encode()),
                            measurements=meta, artisticallyAuditioned=False))
        print('Bank: ' + sid, flush=True)

    preset = kit.load(kit.preset('launch'))
    lock = {'kit': 1, 'earshot': '0.4.0', 'bank': bank.VERSION, 'sr': 48000, 'name': 'launch',
            'mix': preset['mix'], 'roles': {}}
    for role, spec in preset['roles'].items():
        lock['roles'][role] = None if spec is None else dict(
            sound=spec['sound'], align=spec.get('align', 'onset'), level_db=spec.get('level_db', 0),
            **{key: spec[key] for key in kit.MIX_KEYS if key in spec}, takes=[])
    for take in kit.plan(preset):
        audio, checks, meta, seed = kit.render_take(take)
        if not checks['ok'] or meta.get('width', {}).get('ok') is False:
            raise RuntimeError('Launch take needs review: ' + str(take) + ': ' + str(checks))
        measured = bank.measure(audio)
        filename = 'launch-' + take['file'].removesuffix('.wav') + '.f32'
        record = {key: measured[key] for key in ('onset_s', 'peak_s', 'end_s', 'dur_s', 'peak_db', 'lufs_m_max')}
        record.update(file=take['file'], pcm=filename, frames=save(filename, audio), seed=seed,
                      pitch=take['pitch'], key=kit.take_key(take), checks=[],
                      l50_lufs=kit.loud_lufs(audio), corr=kit.corr(audio))
        lock['roles'][take['role']]['takes'].append(record)
        print('Launch: ' + take['file'], flush=True)
    if any(name.split('.')[0] in ('torch', 'transformers', 'laion_clap') for name in sys.modules):
        raise RuntimeError('Unexpected model dependency loaded')
    (out / 'launch.json').write_text(json.dumps(preset, indent=2) + '\n', encoding='utf-8')
    (out / 'launch.lock.json').write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    for name, src in [('LICENSE-EARSHOT.txt', root / 'LICENSE'), ('CREDITS-EARSHOT-FIT.md', root / 'docs/CREDITS_FIT.md')]:
        (out / name).write_bytes(src.read_bytes())
    manifest = dict(version=3, provider='Earshot', commit=config['commit'], sourceTreeSha256=config['sourceTreeSha256'],
                    selectionSha256=sha(CONFIG.read_bytes()), repository='https://github.com/Leonxlnx/earshot',
                    render=dict(sampleRate=48000, channels=2, bitDepth=24, modelsLoaded=False,
                                numpy=np.__version__, scipy=scipy.__version__,
                                adaptation='Unmodified bank.render and kit.render_take; PCM WAV packaging by Syka'), entries=entries)
    (out / 'rendered.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
