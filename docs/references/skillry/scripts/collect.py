"""Resumable anonymous Skillry reference acquisition; never executes source code."""
import argparse
import concurrent.futures as futures
import gzip
import hashlib
import html
from html.parser import HTMLParser
import json
import pathlib
import re
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = 'Mozilla/5.0 SykaReferenceResearch/1.0'
BASE = 'https://skillry.dev'
STRING = r'"(?:\\.|[^"\\])*"'
LOCK = threading.Lock()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60)


def fetch(url):
    for attempt in range(3):
        try:
            with request(url) as response:
                return response.read(), response.status
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if isinstance(exc, urllib.error.HTTPError) and exc.code in (401, 403, 404, 410):
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.videos, self.images, self.texts, self.pres = [], [], [], [], []
        self.hidden = 0
        self.pre = None
        self.title = False
        self.headline = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag in ('video', 'source') and attrs.get('src'):
            self.videos.append(attrs['src'])
        if tag == 'video' and attrs.get('poster'):
            self.images.append(attrs['poster'])
        if tag == 'img' and attrs.get('src'):
            self.images.append(attrs['src'])
        if tag == 'pre':
            self.pre = []
        if tag == 'h1':
            self.title = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = max(0, self.hidden - 1)
        if tag == 'pre' and self.pre is not None:
            self.pres.append(''.join(self.pre))
            self.pre = None
        if tag == 'h1':
            self.title = False

    def handle_data(self, data):
        if self.hidden:
            return
        if self.pre is not None:
            self.pre.append(data)
        if self.title:
            self.headline += data
        if data.strip():
            self.texts.append(data.strip())


def field(source, key):
    match = re.search(r'(?<![\w])' + re.escape(key) + r':(?:\$R\[\d+\]=)?(' + STRING + r'|null|!0|!1|\d+(?:\.\d+)?)', source)
    if not match:
        return None
    raw = match.group(1)
    if raw == '!0':
        return True
    if raw == '!1':
        return False
    try:
        return decode_literal(raw)
    except json.JSONDecodeError:
        return None


def decode_literal(raw):
    # Seroval writes JS hex escapes (e.g. \x3C) that JSON does not accept.
    # Decode literals only; no eval, import, VM or execution of website scripts.
    raw = re.sub(r'(?<!\\)\\x([0-9a-fA-F]{2})', lambda m: '\\u00' + m.group(1), raw)
    return json.loads(raw)


def inspect_page(url, root):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    cache = root / 'pages' / (key + '.html.gz')
    try:
        if cache.exists():
            data, status = gzip.decompress(cache.read_bytes()), 200
        else:
            data, status = fetch(url)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(gzip.compress(data))
            time.sleep(.18)
        source = data.decode('utf-8')
        page = Page()
        page.feed(source)
        path = urllib.parse.urlsplit(url).path
        kind = 'video' if re.fullmatch(r'/ai-videos/[^/]+/[^/]+', path) else 'skill' if re.fullmatch(r'/skills/bs-[^/]+', path) else 'section'
        row = dict(url=url, key=key, kind=kind, status=status, title=page.headline.strip(), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), cache=str(cache.relative_to(root)))
        row['links'] = sorted(set(urllib.parse.urljoin(BASE, link) for link in page.links if link.startswith('/') and not link.startswith('/zh/')))
        row['videos'] = sorted(set(urllib.parse.urljoin(BASE, link) for link in page.videos))
        row['images'] = sorted(set(urllib.parse.urljoin(BASE, link) for link in page.images if '/media/preview-' in link or 'media.skillry.dev/' in link))
        row['textPath'] = f'text/{key}.txt'
        (root / 'text').mkdir(exist_ok=True)
        (root / row['textPath']).write_text('\n'.join(page.texts), encoding='utf-8')
        if kind == 'video':
            for name in ('authorHandle', 'postUrl', 'category', 'durationSeconds', 'width', 'height', 'prompt', 'promptPartial', 'promptTruncated', 'originalVideoUrl', 'remakeVideoUrl'):
                row[name] = field(source, name)
            row['slug'] = path.split('/')[-1]
            row['collection'] = path.split('/')[-2]
            prompt = row.get('prompt')
            if not isinstance(prompt, str) and page.pres:
                prompt = max(page.pres, key=len)
                row['prompt'] = prompt
            if isinstance(prompt, str) and prompt.strip():
                row['promptPath'] = f'prompts/{row["collection"]}/{row["slug"]}.txt'
                dest = root / row['promptPath']
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(prompt, encoding='utf-8')
                row['promptSha256'] = hashlib.sha256(prompt.encode()).hexdigest()
                row['promptCharacters'] = len(prompt)
            row['promptStatus'] = 'partial_as_declared' if row.get('promptPartial') else 'as_displayed_unverified' if prompt else 'absent'
        if kind == 'skill':
            row['slug'] = path.split('/')[-1]
            for name in ('name', 'description', 'outputType', 'accessTier', 'demoPrompt', 'archiveSizeBytes', 'previewDurationSeconds'):
                row[name] = field(source, name)
            document = re.search(r'skillDocument:(?:\$R\[\d+\]=)?\{content:(' + STRING + r'|null)', source)
            content = decode_literal(document.group(1)) if document else None
            placeholder = bool(content and ('name: premium-workflow-example' in content or '# Premium workflow\n' in content))
            row['sourceAccessible'] = bool(content) and not placeholder
            row['sourceDocumentStatus'] = 'premium_placeholder' if placeholder else 'public_skill_document' if content else 'not_accessible'
            row['filePaths'] = []
            match = re.search(r'filePaths:(?:\$R\[\d+\]=)?(\[[^\]]*\])', source)
            if match:
                try:
                    row['filePaths'] = json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass
            if content:
                row['documentPath'] = f'skills/{row["slug"]}/SKILL.md'
                dest = root / row['documentPath']
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(content, encoding='utf-8')
                row['documentSha256'] = hashlib.sha256(content.encode()).hexdigest()
        return row
    except Exception as exc:
        return dict(url=url, key=key, status=getattr(exc, 'code', None), error=str(exc))


def crawl(root, workers):
    sitemap, _ = fetch(BASE + '/sitemap.xml')
    (root / 'sitemap.xml').write_bytes(sitemap)
    (root / 'robots.txt').write_bytes(fetch(BASE + '/robots.txt')[0])
    urls = sorted(set(e.text for e in ET.fromstring(sitemap).findall('{*}url/{*}loc') if '/zh/' not in e.text and not e.text.endswith('/zh')))
    rows = {}
    results = root / 'inventory.json'
    if results.exists():
        rows = {r['url']: r for r in json.loads(results.read_text(encoding='utf-8'))}
    pending = [url for url in urls if url not in rows or rows[url].get('error')]
    print(f'CRAWL {len(urls)} sitemap URLs; {len(pending)} pending', flush=True)
    with futures.ThreadPoolExecutor(max_workers=workers) as executor:
        jobs = {executor.submit(inspect_page, url, root): url for url in pending}
        for count, job in enumerate(futures.as_completed(jobs), 1):
            row = job.result()
            rows[row['url']] = row
            if count % 20 == 0 or count == len(pending):
                write_json(results, [rows[url] for url in sorted(rows)])
                failures = sum(bool(r.get('error')) for r in rows.values())
                print(f'CRAWL {len(rows)}/{len(urls)} errors={failures}', flush=True)
    # Follow public pagination and taxonomy pages omitted by the sitemap.
    extra = set()
    for row in list(rows.values()):
        for url in row.get('links', []):
            if url not in rows and re.search(r'/skills/(use-case|output|role|agent)/|/learn/|/blog/|/skills\?page=|/ai-videos/[^/]+\?page=', url):
                extra.add(url)
    if extra:
        with futures.ThreadPoolExecutor(max_workers=workers) as executor:
            for row in executor.map(lambda u: inspect_page(u, root), sorted(extra)):
                rows[row['url']] = row
        write_json(results, [rows[url] for url in sorted(rows)])
    return list(rows.values())


def download_asset(url, root):
    split = urllib.parse.urlsplit(url)
    ident = hashlib.sha256(url.encode()).hexdigest()[:20]
    name = pathlib.PurePosixPath(split.path).name
    dest = root / 'media' / ident / name
    meta = dest.parent / 'download.json'
    if dest.exists() and meta.exists():
        return json.loads(meta.read_text(encoding='utf-8'))
    try:
        if shutil.disk_usage(root).free < 8 * 1024 ** 3:
            raise RuntimeError('Storage reserve reached: 8 GiB')
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp = dest.with_suffix(dest.suffix + '.part')
        digest, size = hashlib.sha256(), 0
        with request(url) as response, temp.open('wb') as out:
            declared = int(response.headers.get('Content-Length', 0))
            while chunk := response.read(1024 * 1024):
                out.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        if declared and declared != size:
            raise RuntimeError(f'Incomplete download: {size}/{declared}')
        if not size:
            raise RuntimeError('Empty media')
        temp.replace(dest)
        row = dict(url=url, path=str(dest.relative_to(root)), bytes=size, sha256=digest.hexdigest(), status='downloaded')
        if dest.suffix.lower() in ('.mp4', '.webm', '.mov'):
            probe = subprocess.run(['C:/ffmpeg/bin/ffprobe.exe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(dest)], capture_output=True, text=True, encoding='utf-8', timeout=45)
            row['probeStatus'] = 'ok' if probe.returncode == 0 else 'failed'
            if probe.returncode == 0:
                row['probe'] = json.loads(probe.stdout)
            else:
                row['probeError'] = probe.stderr[:1000]
        write_json(meta, row)
        return row
    except Exception as exc:
        return dict(url=url, status='failed', error=str(exc), httpStatus=getattr(exc, 'code', None))


def download_all(root, rows, workers):
    urls = sorted(set(url for row in rows for url in row.get('videos', []) + row.get('images', [])))
    results = root / 'downloads.json'
    print(f'DOWNLOAD {len(urls)} unique public media URLs', flush=True)
    assets = {}
    with futures.ThreadPoolExecutor(max_workers=workers) as executor:
        jobs = {executor.submit(download_asset, url, root): url for url in urls}
        for count, job in enumerate(futures.as_completed(jobs), 1):
            asset = job.result()
            assets[asset['url']] = asset
            if count % 20 == 0 or count == len(urls):
                write_json(results, [assets[url] for url in sorted(assets)])
                size = sum(a.get('bytes', 0) for a in assets.values())
                failed = sum(a['status'] == 'failed' for a in assets.values())
                print(f'DOWNLOAD {count}/{len(urls)} bytes={size} failed={failed}', flush=True)
    return list(assets.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--phase', choices=['all', 'crawl', 'download'], default='all')
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    rows = crawl(root, args.workers) if args.phase != 'download' else json.loads((root / 'inventory.json').read_text(encoding='utf-8'))
    if args.phase != 'crawl':
        download_all(root, rows, args.workers)
    print('ACQUISITION PHASE COMPLETE', flush=True)


if __name__ == '__main__':
    main()
