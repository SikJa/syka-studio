"""Denser, aspect-preserving stills for selected references; requested times are labeled."""
import argparse
import hashlib
import json
import pathlib
import subprocess
from PIL import Image, ImageDraw, ImageFont
from collect import write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--slugs', nargs='+', required=True)
    args = parser.parse_args()
    root = pathlib.Path(args.root)
    inventory = json.loads((root / 'inventory.json').read_text(encoding='utf-8'))
    assets = {a['url']: a for a in json.loads((root / 'downloads.json').read_text(encoding='utf-8'))}
    for slug in args.slugs:
        row = next(r for r in inventory if r.get('slug') == slug)
        url = next((u for u in row.get('videos', []) if assets.get(u, {}).get('probeStatus') == 'ok'), None)
        if not url:
            print(f'PENDING {slug}', flush=True)
            continue
        asset = assets[url]
        duration = float(asset['probe']['format']['duration'])
        streams = [s for s in asset['probe']['streams'] if s['codec_type'] == 'video']
        duration = min(duration, float(streams[0].get('duration', duration)))
        width, height = streams[0]['width'], streams[0]['height']
        portrait = height > width
        sample_width = 240 if portrait else 320
        sample_height = round(sample_width * height / width)
        folder = root / 'focused' / slug
        folder.mkdir(parents=True, exist_ok=True)
        samples = []
        for i in range(12):
            at = i * max(0, duration - .12) / 11
            dest = folder / f'frame-{i:02d}.jpg'
            command = ['C:/ffmpeg/bin/ffmpeg.exe', '-v', 'error', '-ss', str(at), '-i', str(root / asset['path']), '-frames:v', '1', '-vf', f'scale={sample_width}:-1', '-q:v', '2', '-y', str(dest)]
            run = subprocess.run(command, capture_output=True, timeout=40)
            if run.returncode or not dest.exists():
                raise RuntimeError(f'Snapshot failed: {slug} {at}')
            samples.append(dict(requestedSeconds=round(at, 3), path=str(dest.relative_to(root))))
        cols = 4 if not portrait else 4
        sheet = Image.new('RGB', (sample_width * cols, (sample_height + 24) * 3 + 40), '#161b21')
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
        draw.text((8, 10), slug + ' | requested sampling times; not a frame-by-frame review', font=font, fill='white')
        for i, sample in enumerate(samples):
            x, y = i % cols * sample_width, 40 + i // cols * (sample_height + 24)
            image = Image.open(root / sample['path'])
            sheet.paste(image, (x, y))
            draw.text((x + 5, y + sample_height + 3), f'{sample["requestedSeconds"]:.2f}s', font=font, fill='white')
        sheet.save(folder / 'contact.jpg', quality=94)
        write_json(folder / 'manifest.json', dict(url=url, sha256=asset['sha256'], slug=slug, sampleMode='12_uniform_requested_times', samples=samples, contactPath=str((folder / 'contact.jpg').relative_to(root)), visualReview='pending', audioReview=False))
        print(f'FOCUSED {slug}: {folder / "contact.jpg"}', flush=True)


if __name__ == '__main__':
    main()
