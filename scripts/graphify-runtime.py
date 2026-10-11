"""Syka's local, allowlisted Graphify worker. No network, semantic APIs or media.

One OS lock covers manual refresh and watch. A complete index (graph + hashes) is
published in a single atomic replacement; compatibility exports are not authority.
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = 1
PIPELINE_VERSION = 1
DENIED = {'.git', '.runtime', 'node_modules', 'worktrees', 'references', 'projects',
          'media', 'credentials', 'profiles', 'conversations', 'documents', 'private',
          'secrets', 'browser', '__pycache__'}


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def atomic(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('w', encoding='utf-8', newline='\n') as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        # Readers on Windows can briefly hold the destination open.
        for attempt in range(8):
            try:
                os.replace(temp, path)
                break
            except PermissionError:
                if attempt == 7:
                    raise
                time.sleep(.03 * (attempt + 1))
    finally:
        temp.unlink(missing_ok=True)


def safe(root: Path, path: Path):
    try:
        rel = path.relative_to(root)
        if any(p.lower() in DENIED or p.startswith('.') for p in rel.parts):
            return False
        if re.search(r'(^|[._-])(secrets?|credentials?|tokens?|passwords?|conversations?|profiles?)([._-]|$)', path.name, re.I):
            return False
        # Includes Windows junctions and ancestors. Never copy their targets.
        cursor = root
        for part in rel.parts:
            cursor /= part
            if cursor.is_symlink() or (hasattr(cursor, 'is_junction') and cursor.is_junction()):
                return False
        return path.resolve().is_relative_to(root)
    except (ValueError, FileNotFoundError):
        return False


def sources(root: Path, policy: dict):
    found = set()
    for name in policy['files']:
        path = root / name
        if safe(root, path) and path.is_file():
            found.add(path)
    for pattern in policy['patterns']:
        parent, mask = pattern.rsplit('/', 1)
        directory = root / parent
        if safe(root, directory) and directory.is_dir():
            for path in directory.iterdir():
                if fnmatch.fnmatchcase(path.name, mask) and safe(root, path) and path.is_file():
                    found.add(path)
    for name in policy['directories']:
        directory = root / name
        if not safe(root, directory) or not directory.is_dir():
            continue
        def walk_error(error):
            raise error  # Unreadable sources are a failure, not a deletion.
        for parent, dirs, files in os.walk(directory, followlinks=False, onerror=walk_error):
            dirs[:] = [d for d in dirs if safe(root, Path(parent) / d)]
            for name in files:
                path = Path(parent) / name
                if path.suffix in policy['extensions'] and safe(root, path):
                    found.add(path)
    found = sorted(p for p in found if p.suffix in policy['extensions'])
    if len(found) > policy['maxFiles']:
        raise ValueError('El alcance supera maxFiles; revisar graphify-scope.json antes de ampliarlo.')
    return found


def valid_index(value):
    return (isinstance(value, dict) and value.get('schemaVersion') == SCHEMA
            and isinstance(value.get('files'), dict) and isinstance(value.get('generation'), str)
            and isinstance(value.get('graphJson'), str)
            and value.get('checksum') == sha(value['graphJson'].encode()))


def save_index(path, value):
    atomic(path, {k: v for k, v in value.items() if k != 'graph'})


def load_index(out: Path):
    for name in ['code-index.json', 'code-index.previous.json']:
        try:
            value = json.loads((out / name).read_text(encoding='utf-8'))
            if valid_index(value):
                value['graph'] = json.loads(value['graphJson'])
                if not isinstance(value['graph']['nodes'], list) or not isinstance(value['graph']['links'], list):
                    continue
                if name.endswith('previous.json'):
                    save_index(out / 'code-index.json', value)
                return value
        except (OSError, ValueError, TypeError, KeyError):
            pass
    return None


class Lock:
    """Kernel releases this on crash. Never delete/recreate the lock inode."""
    def __init__(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.stream = path.open('a+b')
        self.stream.seek(0, 2)
        if self.stream.tell() == 0:
            self.stream.write(b'0')
            self.stream.flush()
        self.stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(self.stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.stream.close()
            raise

    def close(self):
        self.stream.close()


class Runtime:
    def __init__(self, root, out=None):
        self.root = root.resolve()
        self.out = out or self.root / 'graphify-out'
        self.stage = self.out / '.runtime' / 'source'
        self.policy_file = self.root / 'scripts/graphify-scope.json'
        self.index = load_index(self.out)
        if self.index and self.index.get('sourceRoot') != str(self.root):
            self.index = None  # A copied repository needs its own verified generation.
        self.cached = {}
        self.status = {'state': 'checking', 'pid': os.getpid(), 'error': None}

    def scan(self, full=False):
        policy_bytes = self.policy_file.read_bytes()
        policy = json.loads(policy_bytes)
        files = {}
        for path in sources(self.root, policy):
            stat = path.stat()
            key = path.relative_to(self.root).as_posix()
            stamp = (stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
            if stat.st_size > policy['maxFileBytes']:
                raise ValueError(f'Archivo de código demasiado grande: {key}')
            cached = self.cached.get(key)
            if full or not cached or cached[0] != stamp:
                data = path.read_bytes()
                if b'\0' in data:
                    raise ValueError(f'Contenido binario en fuente permitida: {key}')
                self.cached[key] = (stamp, sha(data), data)
            files[key] = self.cached[key][1]
        self.cached = {k: v for k, v in self.cached.items() if k in files}
        return files, sha(policy_bytes)

    def report(self, state, **extra):
        self.status.update(state=state, checkedAt=now(), generation=self.index['generation'] if self.index else None, **extra)
        atomic(self.out / 'status.json', self.status)

    def refresh(self, files, scope_hash):
        from importlib.metadata import version
        extractor = 'graphifyy/' + version('graphifyy')
        previous = self.index
        old = previous['files'] if previous else {}
        changed = {p for p in files if old.get(p) != files[p]}
        deleted = set(old) - set(files)
        if previous and not changed and not deleted and previous['scopeHash'] == scope_hash and previous['extractor'] == extractor and previous.get('pipelineVersion') == PIPELINE_VERSION:
            self.report('current', error=None)
            return
        self.report('updating', changedFiles=len(changed), deletedFiles=len(deleted), error=None)
        # Stage only permitted bytes. Deleted/renamed sources cannot linger here.
        self.stage.mkdir(parents=True, exist_ok=True)
        for path in self.stage.rglob('*'):
            if path.is_file() and path.relative_to(self.stage).as_posix() not in files:
                path.unlink()
        for name in files:
            target = self.stage / name
            if name in changed or not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(self.cached[name][2])
        # Stop Graphify's upward config/workspace discovery at this public-only
        # stage. These synthetic resolver configs never reference the real tree.
        atomic(self.stage / 'package.json', {'private': True, 'workspaces': []})
        policy = json.loads(self.policy_file.read_text(encoding='utf-8'))
        atomic(self.stage / 'tsconfig.json', {'compilerOptions': {'baseUrl': '.', 'paths': policy.get('aliases', {})}})

        graph = previous['graph'] if previous else {'nodes': [], 'links': []}
        nodes = {n['id']: n for n in graph['nodes']}
        affected = changed | deleted
        # Invalidate reverse dependents, including importers of newly created or
        # renamed modules (their previous graph may only contain external stubs).
        imports = {}
        for name in files:
            text = self.cached[name][2].decode('utf-8', errors='replace')
            imports[name] = re.findall(r'(?:from\s*|import\s*|require\s*\()([\'\"])([^\'\"\n]+)\1', text)
        while True:
            before = set(affected)
            stems = {Path(p).stem for p in affected}
            for name, refs in imports.items():
                if any(Path(ref).stem in stems for _, ref in refs):
                    affected.add(name)
            for edge in graph['links']:
                source = edge.get('source_file') or nodes.get(edge['source'], {}).get('source_file')
                target = nodes.get(edge['target'], {}).get('source_file')
                if target in affected and source in files:
                    affected.add(source)
            if before == affected:
                break
        if not previous or previous['scopeHash'] != scope_hash or previous['extractor'] != extractor or previous.get('pipelineVersion') != PIPELINE_VERSION:
            affected = set(files) | deleted
        parsed = sorted(affected & set(files))
        kept_nodes = [n for n in graph['nodes'] if n.get('source_file') not in affected]
        kept_edges = [e for e in graph['links'] if e.get('source_file') not in affected]
        from graphify.extract import extract, extract_js
        # Graphify can recover a broken TS parse without adding failed_sources.
        # Do not replace a good graph with the partial AST of an in-progress save.
        # Use the library's symbol-loss threshold (tiny grammar recoveries may
        # still extract correctly). Only changed sources need this extra guard.
        for name in sorted(changed & set(files)):
            if Path(name).suffix in {'.ts', '.tsx'}:
                check = extract_js(self.stage / name)
                errors = check.get('parse_errors')
                if check.get('error') or (errors and (len(check.get('nodes', [])) <= 1 or errors.get('multiline_error'))):
                    line = errors.get('first_error_line', '?') if errors else '?'
                    raise ValueError(f'Sintaxis incompleta en {name}:{line}; se conserva el grafo anterior hasta corregir el archivo.')
            elif Path(name).suffix == '.py':
                import ast
                ast.parse(self.cached[name][2], filename=name)
        fresh = extract([self.stage / p for p in parsed], root=self.stage,
                        cache_root=self.out / '.runtime', parallel=False,
                        resolution_context_nodes=kept_nodes, resolution_context_edges=kept_edges) if parsed else {'nodes': [], 'edges': []}
        if fresh.get('failed_sources'):
            raise ValueError('Graphify no pudo analizar: ' + ', '.join(Path(p).name for p in fresh['failed_sources'])[:300])
        merged = {n['id']: n for n in kept_nodes}
        for node in fresh['nodes']:
            merged[node['id']] = node
        # External stubs are retained only while referenced. Never retain deleted
        # source nodes or edges that point to missing endpoints.
        unresolved = sum(1 for e in kept_edges + fresh['edges'] if e['source'] not in merged or e['target'] not in merged)
        edges = [e for e in kept_edges + fresh['edges'] if e['source'] in merged and e['target'] in merged]
        used = {e[k] for e in edges for k in ('source', 'target')}
        merged = {k: n for k, n in merged.items() if n.get('source_file') in files or (not n.get('source_file') and k in used)}
        edges = [e for e in edges if e['source'] in merged and e['target'] in merged]
        # Keep parallel relation types and their original confidence/direction.
        edges = list({json.dumps(e, sort_keys=True): e for e in edges}.values())
        result = {'directed': True, 'multigraph': True, 'graph': {}, 'nodes': list(merged.values()), 'links': edges}
        # Cluster the merged graph without re-extracting unchanged source or LLMs.
        from graphify.build import build_from_json
        from graphify.cluster import cluster
        built = build_from_json({'nodes': result['nodes'], 'edges': edges}, root=self.stage, directed=True)
        communities = cluster(built) if built.number_of_nodes() else {}
        membership = {node: cid for cid, members in communities.items() for node in members}
        for node in result['nodes']:
            node['community'] = membership.get(node['id'])
        # A save during extraction queues another pass; never label old bytes fresh.
        current_files, current_scope = self.scan(full=True)
        if current_files != files or current_scope != scope_hash:
            raise ValueError('El código cambió durante la extracción; reintentando después del debounce.')
        graph_json = json.dumps(result, ensure_ascii=False, separators=(',', ':'))
        snapshot = {'schemaVersion': SCHEMA, 'pipelineVersion': PIPELINE_VERSION, 'generation': uuid.uuid4().hex, 'generatedAt': now(),
                    'sourceRoot': str(self.root), 'scopeHash': scope_hash, 'files': files,
                    'extractor': extractor, 'mode': 'local AST; no semantic/API/cloud',
                    'parsedFiles': parsed, 'deletedFiles': sorted(deleted), 'graph': result,
                    'diagnostics': {'lastUpdateUnresolvedEdgesOmitted': unresolved, 'scope': 'partial; external modules may be outside the allowlist'},
                    'graphJson': graph_json, 'checksum': sha(graph_json.encode())}
        if previous:
            save_index(self.out / 'code-index.previous.json', previous)
        save_index(self.out / 'code-index.json', snapshot)
        self.index = snapshot
        self.report('current', error=None, parsedFiles=len(parsed), changedFiles=len(changed), deletedFiles=len(deleted))
        # Human/CLI compatibility files may be read separately; tools use only the
        # coherent code-index.json bundle, not these independent copies.
        atomic(self.out / 'graph.json', result)
        atomic(self.out / 'source-manifest.json', {k: snapshot[k] for k in ('generation', 'sourceRoot', 'generatedAt', 'scopeHash', 'mode')} |
               {'files': [{'path': p, 'sha256': h} for p, h in files.items()]})
        print(json.dumps({'generation': snapshot['generation'], 'files': len(files), 'parsed': len(parsed), 'deleted': len(deleted)}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--out', type=Path)
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--parent-stdin', action='store_true')
    parser.add_argument('--poll', type=float, default=.5)
    parser.add_argument('--debounce', type=float, default=1.)
    args = parser.parse_args()
    out = (args.out or args.root / 'graphify-out').resolve()
    try:
        lock = Lock(out / '.runtime/worker.lock')
    except OSError:
        print('Graphify: ya hay un actualizador activo para este índice.', file=sys.stderr)
        return 75
    stop = threading.Event()
    if args.parent_stdin:
        def parent_ended():
            sys.stdin.buffer.read()
            stop.set()
        threading.Thread(target=parent_ended, daemon=True).start()
    runtime = Runtime(args.root, out)
    last_signature = None
    first_change = last_change = last_full = 0.
    retry_at = 0.
    failures = 0
    try:
        while not stop.is_set():
            tick = time.monotonic()
            try:
                files, scope_hash = runtime.scan(full=tick - last_full > 15)
                if tick - last_full > 15:
                    last_full = tick
                    # Recover a deleted/corrupt bundle while the app is still open,
                    # as well as at startup. Keep the in-memory last good index.
                    if runtime.index:
                        try:
                            stored = json.loads((out / 'code-index.json').read_text(encoding='utf-8'))
                            if not valid_index(stored):
                                save_index(out / 'code-index.json', runtime.index)
                        except (OSError, ValueError):
                            save_index(out / 'code-index.json', runtime.index)
                signature = (files, scope_hash)
                if signature != last_signature:
                    last_change = tick
                    if not first_change:
                        first_change = tick
                    last_signature = signature
                    retry_at = 0
                from importlib.metadata import version
                dirty = not runtime.index or files != runtime.index['files'] or scope_hash != runtime.index['scopeHash'] or runtime.index['extractor'] != 'graphifyy/' + version('graphifyy') or runtime.index.get('pipelineVersion') != PIPELINE_VERSION
                if dirty:
                    runtime.report('stale', error=runtime.status.get('error'))
                    if (not args.watch or tick - last_change >= args.debounce or tick - first_change >= 5) and tick >= retry_at:
                        # Restart the max-wait window on every attempt, including
                        # failed parses. Continuous typing must not turn a failure
                        # after 5s into an extraction on every subsequent poll.
                        first_change = tick
                        runtime.refresh(files, scope_hash)
                        first_change = 0
                        failures = 0
                else:
                    runtime.report('current', error=None)
                    first_change = 0
                    failures = 0
                if not args.watch:
                    return 0
            except Exception as error:
                failures += 1
                runtime.report('error', error=str(error)[:600], retryAfterSeconds=min(60, 2 ** min(failures, 6)))
                print('Graphify: ' + str(error)[:600], file=sys.stderr, flush=True)
                if not args.watch:
                    return 1
                retry_at = tick + min(60, 2 ** min(failures, 6))
            stop.wait(max(.1, args.poll))
    finally:
        runtime.report('stopped')
        lock.close()


if __name__ == '__main__':
    sys.exit(main())
