"""Download a selected public gallery sample for local analysis, without cookies.

These files are reference evidence, not licensed production assets. No source
scripts are run. A 403/429 stops that request; no alternate identity is used.
"""
import argparse
import hashlib
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SAMPLE = ["brainextends-e19ac3", "twoclipping-5cba86", "twoclipping-6dd14e",
          "twoclipping-221cab", "gdgtify-287ddf", "daniel-haida-8691d4",
          "notdwd-c2037d", "himanshutwtxs-5f4b43"]


def run(root, slugs):
    inventory = json.loads((root / "inventory/prompt-motion.json").read_text(encoding="utf-8"))
    entries = {x["slug"]: x for x in inventory["entries"]}
    media = root / "media"
    sheets = root / "evidence/source-frames"
    media.mkdir(exist_ok=True)
    sheets.mkdir(parents=True, exist_ok=True)
    records = []
    for slug in slugs:
        entry = entries[slug]
        output = media / (slug + ".mp4")
        record = {"slug": slug, "sourceUrl": entry["url"], "postUrl": entry["postUrl"],
                  "videoUrl": entry["videoUrl"], "role": "hosted_gallery_reference",
                  "retention": "private_local_analysis_only", "checkedAt": datetime.now(timezone.utc).isoformat()}
        if not output.exists():
            req = urllib.request.Request(entry["videoUrl"], headers={"User-Agent": "SykaReferenceAudit/1.0"})
            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    if int(response.headers.get("Content-Length", "0")) > 200_000_000:
                        raise ValueError("Sample exceeds 200 MB; select another local sample.")
                    record["httpStatus"] = response.status
                    data = response.read(200_000_001)
                    if len(data) > 200_000_000:
                        raise ValueError("Sample exceeds 200 MB.")
                    output.write_bytes(data)
            except (OSError, urllib.error.HTTPError, ValueError) as error:
                record["error"] = str(error)
                records.append(record)
                continue
        record["sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
        record["bytes"] = output.stat().st_size
        record["localPath"] = output.relative_to(root).as_posix()
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(output)],
                               capture_output=True, text=True, encoding="utf-8", check=True)
        meta = json.loads(probe.stdout)
        duration = float(meta["format"]["duration"])
        record["duration"] = duration
        record["streams"] = [{k: stream.get(k) for k in ["codec_type", "codec_name", "width", "height", "avg_frame_rate", "sample_rate", "channels", "nb_frames"]} for stream in meta["streams"]]
        video = next(s for s in meta["streams"] if s["codec_type"] == "video")
        video_duration = min(duration, float(video.get("duration", duration)))
        record["visualReview"] = "pending"
        frames = []
        sheet = Image.new("RGB", (1600, 3 * 345), "#101317")
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
        frame_dir = sheets / slug
        frame_dir.mkdir(exist_ok=True)
        for i in range(12):
            at = min(video_duration - 0.2, video_duration * i / 11)
            frame = frame_dir / f"frame-{i:02}.jpg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", str(output),
                            "-frames:v", "1", "-vf", "scale=1280:-2,format=yuvj420p", "-threads", "1", "-q:v", "2", str(frame)], check=True)
            pixels = Image.open(frame)
            pixels.thumbnail((394, 298))
            x, y = (i % 4) * 400, (i // 4) * 345
            sheet.paste(pixels, (x + (400 - pixels.width) // 2, y + 28))
            draw.text((x + 8, y + 5), f"{at:05.2f}s · {i+1}/12", font=font, fill="#eef0f3")
            frames.append({"requestedTime": round(at, 4), "path": frame.relative_to(root).as_posix()})
        sheet_path = sheets / (slug + ".jpg")
        sheet.save(sheet_path, quality=90)
        record["frameSheet"] = sheet_path.relative_to(root).as_posix()
        record["frames"] = frames
        records.append(record)
        print(f"{slug}: {duration:.2f}s, {video['width']}×{video['height']}, {record['bytes']/1e6:.1f} MB", flush=True)
        (root / "evidence/video-sample.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    (root / "evidence/video-sample.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--slugs", nargs="+", default=SAMPLE)
    args = parser.parse_args()
    run(args.root.resolve(), args.slugs)
