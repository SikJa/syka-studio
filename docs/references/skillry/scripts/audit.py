"""Verify inventory coverage and real local evidence without fetching or rendering."""
import argparse
from collections import Counter
import json
import pathlib
from collect import write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--repo-root', required=True)
    args = parser.parse_args()
    root, repo = pathlib.Path(args.root).resolve(), pathlib.Path(args.repo_root).resolve()
    inventory = json.loads((root / 'inventory.json').read_text(encoding='utf-8'))
    assets = json.loads((root / 'downloads.json').read_text(encoding='utf-8'))
    analysis = json.loads((root / 'analysis.json').read_text(encoding='utf-8'))
    catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
    problems = []

    def local(path):
        file = (root / path).resolve()
        if not file.is_relative_to(root) or not file.is_file():
            problems.append(dict(path=path, error='missing file or escaping library'))
            return None
        return file

    expected = {u for row in inventory for u in row.get('videos', []) + row.get('images', [])}
    downloaded = {a['url']: a for a in assets if a.get('status') == 'downloaded'}
    missing = sorted(expected - downloaded.keys())
    for asset in downloaded.values():
        file = local(asset['path'])
        if file and file.stat().st_size != asset['bytes']:
            problems.append(dict(path=asset['path'], error='size differs from acquired manifest'))
    videos = {u: a for u, a in downloaded.items() if a.get('probeStatus') == 'ok'}
    evidence = {a['url']: a for a in analysis if a.get('status') == 'automatic_evidence'}
    missing_evidence = sorted(videos.keys() - evidence.keys())
    for url, item in evidence.items():
        if url not in videos or item['sourceSha256'] != videos[url]['sha256']:
            problems.append(dict(url=url, error='evidence/source identity differs'))
        local(item['contactPath'])
        for sample in item['samples']:
            local(sample['path'])
    publication_without_media, opus_without_pair = [], []
    for row in catalog['entries']:
        if row['textPath']:
            local(row['textPath'])
        if row['kind'] == 'video' and not row['media']:
            publication_without_media.append(row['id'])
        if row.get('collection') == 'opus-5-5' and not {'original', 'remake'}.issubset({m['role'] for m in row['media']}):
            opus_without_pair.append(row['id'])
        for media in row['media']:
            local(media['path'])
            local(media['contactPath'])
            local(media['analysisPath'])
    texts = sum(row['sourceAccessible'] for row in catalog['entries'] if row['kind'] == 'video')
    report = dict(
        status='passed' if not (problems or missing or missing_evidence or publication_without_media or opus_without_pair) else 'failed',
        expectedMediaUrls=len(expected), acquiredExpectedMediaUrls=len(expected & downloaded.keys()),
        probedVideoUrls=len(videos), automaticEvidenceUrls=len(evidence),
        automaticSamplingModes=dict(Counter(a.get('sampleMode') for a in evidence.values())),
        distinctVideoFiles=len({a['sha256'] for a in videos.values()}),
        publicationCount=catalog['coverage']['uniqueVideoPublications'],
        locallyRetainedVideoTextBlocks=texts,
        allPublicationsHaveMedia=not publication_without_media,
        allOpusPublicationsHaveOriginalAndRemake=not opus_without_pair,
        missingMediaUrls=missing, missingAutomaticEvidence=missing_evidence,
        publicationsWithoutMedia=publication_without_media, opusWithoutOriginalRemake=opus_without_pair,
        pathOrIdentityProblems=problems,
        limitation='Acquired bytes/probe identities and local samples checked. This is not a full-movie aesthetic, audio, smoothness or rights assessment; no fresh whole-file rehash was performed.')
    write_json(root / 'acquisition-audit.json', report)
    write_json(repo / 'docs/references/skillry/acquisition-audit.json', report)
    print(json.dumps(report, indent=2))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
