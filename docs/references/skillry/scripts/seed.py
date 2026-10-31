"""Extract the complete public SSR catalog as data, without running its JavaScript."""
import argparse
import hashlib
import json
import pathlib
import re
import urllib.parse
from collect import BASE, field, fetch, write_json


def blocks(source, pattern):
    matches = list(re.finditer(pattern, source))
    for i, match in enumerate(matches):
        yield source[match.start():matches[i + 1].start() if i + 1 < len(matches) else len(source)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--repo', required=True)
    args = parser.parse_args()
    root, cache = pathlib.Path(args.root), pathlib.Path(args.cache)
    upstream = {r['slug']: r for r in json.loads(pathlib.Path(args.repo).read_text(encoding='utf-8'))}
    rows = []
    for collection, filename in [('opus-5-5', 'probe-2.txt'), ('fable-5-5', 'fable-home.html')]:
        source = (cache / filename).read_text(encoding='utf-8')
        for block in blocks(source, r'\$R\[\d+\]=\{slug:"[^"\n]+"'):
            slug = field(block, 'slug')
            if not slug or slug.startswith('bs-'):
                continue
            row = {key: field(block, key) for key in ['authorHandle', 'postUrl', 'category', 'durationSeconds', 'width', 'height', 'prompt', 'promptPartial', 'promptTruncated', 'posterUrl', 'originalPreviewUrl', 'remakePreviewUrl', 'videoUrl']}
            row.update(kind='video', slug=slug, collection=collection, url=f'{BASE}/ai-videos/{collection}/{slug}', status=200, accessEvidence='complete public gallery SSR listing; detail not individually fetched')
            if collection == 'opus-5-5':
                row['videos'] = [f'https://media.skillry.dev/{collection}/{slug}/original.mp4', f'https://media.skillry.dev/{collection}/{slug}/remake.mp4']
                row['mediaResolution'] = 'gallery media path pattern; verified individually on download'
                old = upstream.get(slug, {})
                row['promptStatus'] = 'declared_partial' if old.get('prompt_partial') else 'post_text_only' if old.get('prompt_is_post_text') or old.get('prompt_source') == 'post' else None
                row['upstreamPromptFields'] = {k: v for k, v in old.items() if k.startswith('prompt_')}
                # The upstream Markdown explicitly distinguishes a prompt from post text.
                markdown = pathlib.Path(args.repo).parent.parent / 'prompts' / f'{slug}.md'
                text = markdown.read_text(encoding='utf-8') if markdown.exists() else ''
                if 'No prompt was published' in text or 'original post text' in text.lower() or 'no full prompt' in text.lower():
                    row['promptStatus'] = 'post_text_only'
                if row['promptStatus'] is None:
                    row['promptStatus'] = 'declared_complete'
            else:
                row['videos'] = [row['videoUrl']] if row.get('videoUrl') else []
                row['promptStatus'] = 'partial_as_declared' if row.get('promptPartial') else 'as_displayed_unverified' if row.get('prompt') else 'absent'
            row['videos'] = [urllib.parse.urljoin(BASE, v) for v in row['videos']]
            row['images'] = [urllib.parse.urljoin(BASE, row['posterUrl'])] if row.get('posterUrl') else []
            prompt = row.get('prompt')
            if prompt:
                row['promptPath'] = f'prompts/{collection}/{slug}.txt'
                path = root / row['promptPath']
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(prompt, encoding='utf-8')
                row['promptCharacters'] = len(prompt)
                row['promptSha256'] = hashlib.sha256(prompt.encode()).hexdigest()
            row['title'] = (prompt or slug).split('\n')[0][:100]
            rows.append(row)
    source = (cache / 'probe-3.txt').read_text(encoding='utf-8')
    skills = []
    for block in blocks(source, r'\$R\[\d+\]=\{id:"[^"\n]+",slug:"bs-[^"\n]+"'):
        row = {key: field(block, key) for key in ['slug', 'name', 'description', 'outputType', 'priceUsdCents', 'previewVideoUrl', 'posterUrl']}
        row.update(kind='skill', url=f'{BASE}/skills/{row["slug"]}', title=row['name'], sourceAccessible=None, accessEvidence='complete public gallery SSR listing')
        row['videos'] = [urllib.parse.urljoin(BASE, row['previewVideoUrl'])] if row.get('previewVideoUrl') else []
        row['images'] = [urllib.parse.urljoin(BASE, row['posterUrl'])] if row.get('posterUrl') else []
        skills.append(row)
    write_json(root / 'video-listing.json', rows)
    write_json(root / 'skill-listing.json', skills)
    write_json(root / 'inventory.json', rows)
    print(f'SEED {len(rows)} videos; {len(skills)} skills; {sum(bool(r.get("prompt")) for r in rows)} text blocks', flush=True)


if __name__ == '__main__':
    main()
