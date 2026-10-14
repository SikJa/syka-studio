/** Maintainer-only, offline rendering of pinned MIT Cuelume recipes. No network or browser at runtime. */
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { soundProfile } from '../packages/agent-chat/src/host/audio-spectrum.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(repo, 'scripts', 'lib', 'cuelume');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const themes = {
  default: { title: 'Cálido', tags: ['default', 'warm', 'cálido', 'vidrio', 'glass', 'madera', 'wood', 'aire', 'mallet'] },
  mech: { title: 'Mecánico', tags: ['mech', 'mechanical', 'mecánico', 'metal', 'metálico', 'seco', 'preciso'] },
  bubble: { title: 'Burbuja', tags: ['bubble', 'burbuja', 'orgánico', 'lúdico', 'corcho', 'gota'] },
  press: { title: 'Pulsación', tags: ['press', 'pulsación', 'switch', 'interruptor', 'trackpad', 'profundo'] },
};
const cues = {
  tap: ['Toque', 'tap', ['tap', 'toque', 'clic', 'click', 'botón', 'pulsar', 'contacto']],
  type: ['Teclado', 'click', ['type', 'typing', 'teclado', 'escribir', 'texto', 'entrada']],
  select: ['Selección', 'click', ['select', 'selección', 'seleccionar', 'opción']],
  toggle: ['Interruptor', 'switch', ['toggle', 'interruptor', 'activar', 'cambiar']],
  open: ['Abrir', 'open-close', ['open', 'abrir', 'menú', 'panel', 'aparición']],
  close: ['Cerrar', 'open-close', ['close', 'cerrar', 'menú', 'panel', 'salida']],
  navigate: ['Navegación', 'whoosh', ['navigate', 'navegar', 'whoosh', 'barrido', 'transición', 'deslizar']],
  success: ['Confirmación', 'success', ['success', 'éxito', 'confirmación', 'completado']],
  error: ['Error', 'error', ['error', 'fallo', 'rechazo']],
  warning: ['Aviso', 'notification', ['warning', 'aviso', 'advertencia']],
  loading: ['Carga', 'notification', ['loading', 'carga', 'inicio', 'espera']],
  ready: ['Resultado listo', 'notification', ['ready', 'listo', 'resultado', 'notificación']],
  attention: ['Atención', 'notification', ['attention', 'atención', 'pregunta', 'aviso', 'campana']],
  count: ['Contador', 'texture', ['count', 'contador', 'número', 'progreso', 'aire']],
};
const emphasisTitles = { subtle: 'Suave', normal: 'Normal', strong: 'Fuerte' };

async function saveUnchanged(path, bytes) {
  try {
    if (!(await readFile(path)).equals(bytes)) throw Error('Existing Cuelume file changed: ' + path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
  }
}

/** Quantize before measuring so metadata describes the actual distributable PCM. */
function waveAndProfile(channels, rate, notice) {
  const [left, right] = channels;
  if (!left.length || left.length !== right.length || rate !== 48000) throw Error('Invalid Cuelume stereo render');
  const comment = Buffer.from(notice + '\0');
  const info = Buffer.alloc(20 + Math.ceil(comment.length / 2) * 2);
  info.write('LIST', 0); info.writeUInt32LE(info.length - 8, 4); info.write('INFOICMT', 8);
  info.writeUInt32LE(comment.length, 16); comment.copy(info, 20);
  const wave = Buffer.alloc(44 + left.length * 4 + info.length), pcm = Buffer.alloc(left.length * 8);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(2, 22);
  wave.writeUInt32LE(rate, 24); wave.writeUInt32LE(rate * 4, 28);
  wave.writeUInt16LE(4, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36);
  wave.writeUInt32LE(left.length * 4, 40);
  info.copy(wave, 44 + left.length * 4);
  for (let frame = 0; frame < left.length; frame++) for (let channel = 0; channel < 2; channel++) {
    const value = channels[channel][frame];
    if (!Number.isFinite(value) || Math.abs(value) >= 1) throw Error('Cuelume render clips; no clipped asset was published');
    const sample = Math.round(value * 32767);
    wave.writeInt16LE(sample, 44 + frame * 4 + channel * 2);
    pcm.writeFloatLE(sample / 32768, frame * 8 + channel * 4);
  }
  const profile = soundProfile(pcm, rate);
  if (profile.peakDb === null || profile.peakOffsetSeconds === null) throw Error('Silent Cuelume cue');
  return { wave, profile, duration: left.length / rate };
}

export async function prepareCuelumeSounds(docsDir = join(repo, 'docs')) {
  const pin = JSON.parse(await readFile(join(vendor, 'PINNED.json'), 'utf8'));
  if (pin.version !== '0.2.8' || pin.commit !== '2a1ba4fc1b67e8371c9f37e37a51e61353166335') throw Error('Review a new Cuelume version before rendering it');
  for (const file of pin.files) {
    if (sha(await readFile(join(vendor, file.path))) !== file.sha256) throw Error('Pinned Cuelume source changed: ' + file.path);
  }
  const { stereo, THEMES, SR } = await import('./lib/cuelume/scripts/sound.mjs');
  const root = join(resolve(docsDir), 'resources', 'sounds'), file = join(root, 'catalog.json');
  const lock = join(root, '.cuelume-render.lock');
  await writeFile(lock, String(process.pid), { flag: 'wx' });
  let added = 0, bytes = 0;
  try {
    const initial = await readFile(file), catalog = JSON.parse(initial.toString('utf8'));
    if (catalog.version !== 1 || !Array.isArray(catalog.entries) || !Array.isArray(catalog.providers)) throw Error('Invalid existing sound catalog');
    const paths = new Map(catalog.entries.map(entry => [entry.path, entry]));
    const license = await readFile(join(vendor, 'LICENSE'));
    const notice = license.toString('utf8') + '\nCuelume ' + pin.version + '\n' + pin.repository + '/tree/' + pin.commit;
    const rendered = [];
    for (const [theme, material] of Object.entries(themes)) {
      if (Object.keys(THEMES[theme]).length !== Object.keys(cues).length) throw Error('Cuelume cue set changed');
      for (const [cue, [title, family, tags]] of Object.entries(cues)) for (const emphasis of Object.keys(emphasisTitles)) {
        const { wave, profile, duration } = waveAndProfile(stereo(theme, cue, { emphasis, part: 'both', step: 0, seed: 0 }), SR, notice);
        const path = `cuelume/${theme}/${cue}-${emphasis}.wav`, hash = sha(wave);
        const entry = {
          path, brand: 'Cuelume · ' + material.title, title: title + ' · ' + emphasisTitles[emphasis],
          provider: 'Cuelume', audioType: 'sfx', audioFamily: family, theme, variant: emphasis,
          tags: [...new Set(['cuelume', `cuelume ${theme}`, `cuelume ${theme} ${cue}`, 'ui', 'interfaz', cue, emphasis, emphasisTitles[emphasis].toLowerCase(), ...material.tags, ...tags])],
          license: 'MIT', url: 'https://cuelume.dev/docs', sha256: hash,
          duration, sampleRate: SR, channels: 2, bitDepth: 16,
          cuePoint: profile.peakOffsetSeconds, soundProfile: profile,
          sourceCue: cue, sourceCommit: pin.commit,
          usage: 'Offline interface SFX for native timeline audio; copy:true, align measured cuePoint, volume in dB. Not music or a real-world field recording.',
        };
        const previous = paths.get(path);
        if (previous && (previous.provider !== 'Cuelume' || previous.sha256 !== hash)) throw Error('Existing catalog cue differs: ' + path);
        await saveUnchanged(join(root, path), wave);
        if (previous) catalog.entries[catalog.entries.indexOf(previous)] = entry;
        else { catalog.entries.push(entry); added++; }
        rendered.push({ path, sha256: hash, theme, cue, emphasis }); bytes += wave.length;
      }
      console.log('Cuelume rendered: ' + theme);
    }
    await saveUnchanged(join(root, 'LICENSE-CUELUME.txt'), license);
    const source = {
      version: 1, provider: 'Cuelume', packageVersion: pin.version, commit: pin.commit,
      repository: pin.repository, author: 'Daniel Belyi', license: 'MIT', licenseSha256: sha(license),
      renderer: 'Upstream scripts/sound.mjs, pinned and unchanged; seeded offline stereo rendering',
      portableNotice: 'The full MIT notice and pinned source URL are embedded in the WAV INFO/ICMT chunk and also included as LICENSE-CUELUME.txt.',
      settings: { sampleRate: SR, channels: 2, bitDepth: 16, part: 'both', step: 0, seed: 0, emphasis: Object.keys(emphasisTitles), themes: Object.keys(themes) },
      limitations: ['Frozen cues do not retain live typing cadence or randomized per-play strikes.', 'Upstream offline renderer omits the shared soft clip; every published cue is checked for PCM clipping.', 'The count preset uses the upstream default duration, not automatic time-stretch to the edit.'],
      files: rendered,
    };
    await saveUnchanged(join(root, 'sources', 'cuelume.json'), Buffer.from(JSON.stringify(source, null, 2) + '\n'));
    if (!catalog.providers.some(provider => provider.id === 'cuelume')) catalog.providers.push({ id: 'cuelume', name: 'Cuelume', url: 'https://cuelume.dev', license: 'MIT', version: pin.version, commit: pin.commit, sourceManifest: 'sources/cuelume.json' });
    if (!(await readFile(file)).equals(initial)) throw Error('Sound catalog changed during rendering; retry without overwriting another update');
    const temp = file + '.' + randomUUID() + '.tmp';
    try { await writeFile(temp, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' }); await rename(temp, file); }
    finally { await unlink(temp).catch(() => undefined); }
    return { added, cues: rendered.length, bytes, mebibytes: Math.round(bytes / 1024 ** 2 * 100) / 100, preservedOtherEntries: catalog.entries.length - rendered.length, sourceCommit: pin.commit };
  } finally { await unlink(lock); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await prepareCuelumeSounds(process.argv[2])));
}
