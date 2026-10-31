"""Decode every acquired video and create explicitly automatic reference evidence."""
import argparse
import concurrent.futures as futures
import hashlib
import json
import math
import pathlib
import subprocess
import time
from PIL import Image, ImageChops, ImageStat, ImageDraw, ImageFont
from collect import write_json

WIDTH, HEIGHT, SAMPLE_FPS = 240, 136, 2
FRAME_BYTES = WIDTH * HEIGHT * 3


def exact_read(stream, size):
    chunks, remaining = [], size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b''.join(chunks)


def analyze(asset, root):
    source = root / asset['path']
    key = hashlib.sha256(asset['url'].encode()).hexdigest()[:20]
    folder = root / 'analysis' / key
    manifest = folder / 'automatic.json'
    if manifest.exists():
        return json.loads(manifest.read_text(encoding='utf-8'))
    folder.mkdir(parents=True, exist_ok=True)
    try:
        duration = float(asset.get('probe', {}).get('format', {}).get('duration', 0))
        probe = subprocess.run(['C:/ffmpeg/bin/ffprobe.exe', '-v', 'error', '-skip_frame', 'nokey', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', str(source)], capture_output=True, text=True, encoding='utf-8', timeout=120)
        if probe.returncode:
            raise RuntimeError('Keyframe timestamp probe failed')
        points = [float(f['best_effort_timestamp_time']) for f in json.loads(probe.stdout).get('frames', []) if 'best_effort_timestamp_time' in f]
        expected = len(points)
        if not expected:
            raise RuntimeError('No timestamped keyframes')
        selected = set(round(i * max(0, expected - 1) / 11) for i in range(12))
        command = ['C:/ffmpeg/bin/ffmpeg.exe', '-v', 'error', '-skip_frame', 'nokey', '-threads', '1', '-i', str(source), '-map', '0:v:0', '-an', '-vf', f'scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2', '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        previous, frames, samples, deltas = None, 0, [], []
        while raw := exact_read(process.stdout, FRAME_BYTES):
            if len(raw) != FRAME_BYTES:
                raise RuntimeError('Incomplete sampled frame')
            frame = Image.frombytes('RGB', (WIDTH, HEIGHT), raw)
            if frames in selected:
                path = folder / f'sample-{frames:05d}.jpg'
                frame.save(path, quality=88)
                samples.append(dict(sample=frames, nominalSeconds=points[frames] if frames < len(points) else None, path=str(path.relative_to(root))))
            if previous is not None:
                deltas.append(dict(nominalSeconds=points[frames] if frames < len(points) else None, meanAbsoluteDelta=round(sum(ImageStat.Stat(ImageChops.difference(frame, previous)).mean) / 3, 3)))
            previous, frames = frame, frames + 1
        stderr = process.stderr.read().decode('utf-8', errors='replace')
        code = process.wait(timeout=30)
        if code != 0 or not frames or frames != len(points):
            raise RuntimeError(f'Decode failed ({code}): {stderr[:1200]}')
        if previous is not None and frames - 1 not in selected:
            path = folder / f'sample-{frames-1:05d}.jpg'
            previous.save(path, quality=88)
            samples[-1:] = [dict(sample=frames - 1, nominalSeconds=points[frames - 1], path=str(path.relative_to(root)))]
        label_height = 22
        rows = max(1, math.ceil(min(12, len(samples)) / 4))
        sheet = Image.new('RGB', (WIDTH * 4, (HEIGHT + label_height) * rows + 34), '#151821')
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 14)
        draw.text((10, 9), source.parent.name + ' | automatic samples; visual judgment pending', font=font, fill='white')
        for i, sample in enumerate(samples[:12]):
            x, y = (i % 4) * WIDTH, 34 + (i // 4) * (HEIGHT + label_height)
            sheet.paste(Image.open(root / sample['path']), (x, y))
            draw.text((x + 5, y + HEIGHT + 3), f'{sample["nominalSeconds"]:.2f}s', font=font, fill='white')
        sheet.save(folder / 'contact.jpg', quality=90)
        peaks = sorted(deltas, key=lambda x: -x['meanAbsoluteDelta'])[:8]
        result = dict(url=asset['url'], sourcePath=asset['path'], sourceSha256=asset['sha256'], status='automatic_evidence', fullDecode='not_run_keyframes_only', decodeWarnings=stderr[:1200] or None, visualReview='not_individually_reviewed', durationSeconds=duration, sampledFrames=frames, sampleMode='timestamped_keyframes', contactPath=str((folder / 'contact.jpg').relative_to(root)), samples=samples, coarseChangeCandidates=peaks, limitation='Timestamped keyframes decoded for efficient cataloging; metrics and sparse images do not establish typography quality, smoothness, intervening transitions, audio quality, or the original authoring prompt. Inspect selected transitions with consecutive frames before adapting.')
        write_json(manifest, result)
        return result
    except Exception as exc:
        return dict(url=asset['url'], status='failed', error=str(exc))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    root = pathlib.Path(args.root)
    assets = json.loads((root / 'downloads.json').read_text(encoding='utf-8'))
    videos = [a for a in assets if a.get('status') == 'downloaded' and a.get('probeStatus') == 'ok']
    rows = []
    print(f'ANALYZE {len(videos)} acquired videos', flush=True)
    with futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        for count, result in enumerate(executor.map(lambda a: analyze(a, root), videos), 1):
            rows.append(result)
            if count % 20 == 0 or count == len(videos):
                write_json(root / 'analysis.json', rows)
                print(f'ANALYZE {count}/{len(videos)} failed={sum(r["status"] == "failed" for r in rows)}', flush=True)
    print('AUTOMATIC ANALYSIS COMPLETE', flush=True)


if __name__ == '__main__':
    main()
