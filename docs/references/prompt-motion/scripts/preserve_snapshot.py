"""Record the attributed source snapshot before discarding our clone's Git metadata."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "upstream" / "awesome-opus5-5-videos"
EXPECTED = "3d54892e2ae5b0e8d337171e6508bba4cec01ab8"

def git(*args):
    return subprocess.check_output(["git", "-C", str(UPSTREAM), *args], text=True, encoding="utf-8").strip()

if __name__ == "__main__":
    commit = git("rev-parse", "HEAD")
    assert commit == EXPECTED, "Do not silently substitute another snapshot"
    remote = git("remote", "get-url", "origin")
    assert remote.rstrip("/").removesuffix(".git") == "https://github.com/yihui-dev/awesome-opus5-5-videos"
    files = git("ls-files", "-z").split("\0")
    manifest = [{"path": name, "bytes": (UPSTREAM / name).stat().st_size,
                 "sha256": hashlib.sha256((UPSTREAM / name).read_bytes()).hexdigest()}
                for name in sorted(files) if name]
    result = {"capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "source": remote, "commit": commit, "license": "MIT, 2026 yihui-dev",
              "scope": "All tracked source files. Linked creator media rights are separate.",
              "files": manifest}
    destination = ROOT / "provenance" / "upstream-snapshot.json"
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(manifest), "commit": commit, "manifest": str(destination)}))
