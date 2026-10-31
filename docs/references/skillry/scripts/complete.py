"""Reconcile the acquisition manifest and deduplicate verified identical media bytes."""
import argparse
import concurrent.futures as futures
import json
import os
import pathlib
from collect import download_asset, write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()
    rows = json.loads((root / 'inventory.json').read_text(encoding='utf-8'))
    expected = set(u for row in rows for u in row.get('videos', []) + row.get('images', []))
    assets = {}
    for path in (root / 'media').glob('*/download.json'):
        asset = json.loads(path.read_text(encoding='utf-8'))
        if (root / asset['path']).exists():
            assets[asset['url']] = asset
    pending = sorted(expected - assets.keys())
    print(f'RECONCILE {len(expected)} media URLs; {len(pending)} pending', flush=True)
    with futures.ThreadPoolExecutor(max_workers=4) as executor:
        for count, row in enumerate(executor.map(lambda u: download_asset(u, root), pending), 1):
            assets[row['url']] = row
            if count % 20 == 0:
                print(f'RECONCILE {count}/{len(pending)}', flush=True)
    hashes, saved, links = {}, 0, 0
    for asset in assets.values():
        if asset.get('status') != 'downloaded':
            continue
        path = (root / asset['path']).resolve()
        if not path.is_relative_to(root):
            raise RuntimeError('Media path escapes selected library')
        previous = hashes.get(asset['sha256'])
        if previous and not os.path.samefile(path, previous):
            temp = path.with_name(path.name + '.dedupe')
            os.link(previous, temp)
            os.replace(temp, path)
            saved += asset['bytes']
            links += 1
        hashes.setdefault(asset['sha256'], path)
    write_json(root / 'downloads.json', [assets[u] for u in sorted(assets)])
    write_json(root / 'deduplication.json', dict(sha256IdenticalFilesHardlinked=links, logicalDuplicateBytes=saved, expectedMediaUrls=len(expected), successfulExpected=sum(assets[u]['status'] == 'downloaded' for u in expected), missingOrFailed=[assets.get(u, {'url': u, 'status': 'missing'}) for u in sorted(expected) if assets.get(u, {}).get('status') != 'downloaded']))
    print(f'RECONCILE complete: {links} identical files hardlinked; {saved} duplicate bytes', flush=True)


if __name__ == '__main__':
    main()
