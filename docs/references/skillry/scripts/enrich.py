"""Normalize source identities, prompt evidence and the previous gallery's missing media."""
import argparse
import gzip
import hashlib
import json
import pathlib
import re
from collections import Counter
from collect import Page, write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--repo-root', required=True)
    args = parser.parse_args()
    root, repo = pathlib.Path(args.root), pathlib.Path(args.repo_root)
    rows = json.loads((root / 'inventory.json').read_text(encoding='utf-8'))
    original = json.loads((repo / 'docs/skills/syka-motion-references/references/catalog.json').read_text(encoding='utf-8'))
    by_post = {r['postUrl']: r for r in original['entries']}
    for row in rows:
        if row.get('kind') != 'video':
            continue
        if row.get('collection') == 'fable-5-5':
            source = gzip.decompress((root / row['cache']).read_bytes()).decode()
            posts = re.findall(r'https?://(?:x|twitter)\.com/[A-Za-z0-9_]+/status/\d+', source)
            if posts:
                row['postUrl'], row['authorHandle'] = posts[0], posts[0].split('/')[3]
            section = next((s for s in re.findall(r'<section\b[^>]*>.*?</section>', source, re.S) if 'data-testid="fable-video-post-' in s), '')
            parsed = Page()
            parsed.feed(section)
            if 'Prompt the author shared' in parsed.texts:
                i = parsed.texts.index('Prompt the author shared')
                prompt = '\n'.join(parsed.texts[i + 1:])
                row['promptStatus'] = 'as_displayed_unverified'
            else:
                quote = re.search(r'<blockquote\b[^>]*>(.*?)</blockquote>', section, re.S)
                parsed = Page()
                parsed.feed(quote.group(1) if quote else '')
                prompt = '\n'.join(parsed.texts)
                row['promptStatus'] = 'post_text_only' if prompt else 'absent'
            row['prompt'] = prompt
            if prompt:
                row['promptPath'] = f'prompts/fable-5-5/{row["slug"]}.txt'
                path = root / row['promptPath']
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(prompt, encoding='utf-8')
                row['promptCharacters'] = len(prompt)
                row['promptSha256'] = hashlib.sha256(prompt.encode()).hexdigest()
        if row.get('postUrl') in by_post:
            old = by_post[row['postUrl']]
            row['promptStatus'] = (old.get('prompt') or {}).get('status') or row.get('promptStatus')
            row['title'], row['curatedTags'] = old['title'], old['tags']
    known = {r.get('postUrl') for r in rows if r.get('kind') == 'video'}
    gallery = json.loads((repo / 'docs/references/prompt-motion/inventory/prompt-motion.json').read_text(encoding='utf-8'))['entries']
    added = 0
    for old in gallery:
        if old.get('postUrl') in known:
            continue
        rows.append(dict(kind='video', slug=old['slug'], collection='prompt-motion', url=old['url'], title=old['title'], authorHandle=old['author'], postUrl=old['postUrl'], promptStatus='website_only_not_retained', promptCharacters=old.get('promptCharacters'), promptSha256=old.get('promptSha256'), videos=[old['videoUrl']], images=[old['posterUrl']], rights='personal reference media; web-exclusive prompt body not retained', status=old['http']['status']))
        known.add(old.get('postUrl'))
        added += 1
    write_json(root / 'inventory.json', rows)
    print(f'ENRICHED: {len(known)} source publications; {added} previous-gallery entries added')
    print(Counter(r.get('promptStatus') for r in rows if r.get('collection') == 'opus-5-5'))


if __name__ == '__main__':
    main()
