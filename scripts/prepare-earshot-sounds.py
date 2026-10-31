"""Maintainer-only renderer. No models, accounts or runtime Python dependency.

Use a private environment with numpy==2.2.6 and scipy==1.15.3, then:
  python scripts/prepare-earshot-sounds.py --source <pinned checkout> --out <staging>
  node scripts/import-earshot-sounds.mjs <staging>
The importer quantizes, measures and publishes ONLY this small selected kit.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import sys
import types

COMMIT = "925ebe56a1b755e5d354ab642bb8f344440cfa9c"
TREE_SHA256 = "5b92635b86b2338cdaec661b6b7a2c36cf46323025fed1c3e6854f2b1c1d5f8f"
SELECTION_PATH = Path(__file__).parent / 'data' / 'earshot-selection.json'
SELECTION_DATA = json.loads(SELECTION_PATH.read_text(encoding='utf-8'))
SELECTION = [(e['id'], e['title'], e['audioFamily'], e['tags']) for e in SELECTION_DATA['entries']]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    root = args.source.resolve()
    lines = []
    for path in root.rglob("*"):
        if path.is_file() and "__pycache__" not in path.parts and ".git" not in path.parts and (
            path.suffix in (".py", ".json") or path.name in ("LICENSE", "CREDITS_FIT.md")
        ):
            lines.append(path.relative_to(root).as_posix() + ":" + sha(path.read_bytes()))
    if sha("\n".join(sorted(lines)).encode()) != TREE_SHA256:
        raise RuntimeError("Pinned Earshot source changed; review the source before rendering")
    import numpy as np
    import scipy
    if np.__version__ != "2.2.6" or scipy.__version__ != "1.15.3":
        raise RuntimeError("Reproduce with numpy==2.2.6 and scipy==1.15.3 in a PRIVATE build environment")
    sys.path.insert(0, str(root))
    # The upstream forge initializer also loads authoring/analysis entrypoints.
    # Load its bank submodule directly; this keeps Torch/CLAP out of this build.
    import earshot  # noqa: F401
    forge = types.ModuleType("earshot.forge")
    forge.__path__ = [str(root / "earshot" / "forge")]
    sys.modules["earshot.forge"] = forge
    bank = importlib.import_module("earshot.forge.bank")
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    entries = []
    for sid, title, family, tags in SELECTION:
        entry = bank.get(sid)
        source = entry.get("source")
        if entry["type"] == "fit" and (not source or source["license"] != "CC0 1.0"):
            raise RuntimeError("Unverified fitted source: " + sid)
        audio, meta = bank.render(sid, peak_db=-6, sr=48000, checks=True)
        if not meta.get("checks", {}).get("ok"):
            raise RuntimeError("Earshot technical audit needs review: " + sid)
        if audio.ndim == 1:
            audio = np.column_stack((audio, audio))
        if audio.ndim != 2 or audio.shape[1] != 2 or not np.isfinite(audio).all() or np.abs(audio).max() >= 1:
            raise RuntimeError("Invalid render: " + sid)
        file = sid.replace("/", "--") + ".f32"
        (out / file).write_bytes(audio.astype("<f4").tobytes())
        entries.append({"id": sid, "title": title, "audioFamily": family, "tags": tags,
                        "pcm": file, "frames": len(audio), "source": source,
                        "recipeSha256": sha(json.dumps(entry, sort_keys=True, separators=(",", ":")).encode()),
                        "measurements": meta, "artisticallyAuditioned": False})
        print("Rendered: " + sid, flush=True)
    if any(name == "torch" or name.startswith("torch.") for name in sys.modules):
        raise RuntimeError("Unexpected model runtime loaded")
    (out / "LICENSE-EARSHOT.txt").write_bytes((root / "LICENSE").read_bytes())
    (out / "CREDITS-EARSHOT-FIT.md").write_bytes((root / "docs" / "CREDITS_FIT.md").read_bytes())
    manifest = {"version": 2, "provider": "Earshot", "commit": COMMIT, "sourceTreeSha256": TREE_SHA256,
                "selectionSha256": sha(SELECTION_PATH.read_bytes()),
                "repository": "https://github.com/Leonxlnx/earshot", "license": "MIT",
                "render": {"sampleRate": 48000, "peakDb": -6, "seed": "upstream delivered seed",
                           "numpy": np.__version__, "scipy": scipy.__version__, "modelsLoaded": False,
                           "adaptation": "Direct bank submodule bootstrap, unchanged rendering functions"},
                "entries": entries}
    (out / "rendered.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
