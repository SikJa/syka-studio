"""Real local AST/watch tests. No provider, editor, account or shared listener."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('graphify-runtime.py').resolve()
spec = importlib.util.spec_from_file_location('syka_graph', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GraphRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='syka-graphify-test-')
        self.root = Path(self.temp.name).resolve()
        (self.root / 'scripts').mkdir()
        (self.root / 'src').mkdir()
        (self.root / 'scripts/graphify-scope.json').write_text(json.dumps({
            'version': 1, 'files': [], 'directories': ['src'], 'patterns': [],
            'extensions': ['.ts'], 'maxFiles': 20, 'maxFileBytes': 100000,
        }))
        self.write('math.ts', 'export function double(value: number) { return value * 2; }')
        self.write('main.ts', "import { double } from './math'; export function render() { return double(4); }")
        self.write('independent.ts', 'export function unrelated() { return 42; }')
        self.runtime = module.Runtime(self.root)

    def tearDown(self):
        self.assertTrue(self.root.name.startswith('syka-graphify-test-'))
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.temp.cleanup()

    def write(self, name, text):
        (self.root / 'src' / name).write_text(text, encoding='utf-8')

    def refresh(self):
        self.runtime.refresh(*self.runtime.scan(full=True))
        return self.runtime.index

    def test_incremental_rebinds_dependents_and_keeps_unrelated_file(self):
        first = self.refresh()
        self.write('math.ts', 'export function triple(value: number) { return value * 3; }')
        second = self.refresh()
        self.assertNotEqual(first['generation'], second['generation'])
        self.assertEqual(set(second['parsedFiles']), {'src/math.ts', 'src/main.ts'})
        self.assertFalse(any(n.get('label') == 'double()' and n.get('source_file') == 'src/math.ts' for n in second['graph']['nodes']))
        stable = second['generation']
        self.assertEqual(self.refresh()['generation'], stable)

    def test_added_renamed_deleted_and_shrinking_scope(self):
        self.refresh()
        self.write('added.ts', 'export function added() { return 7; }')
        self.assertIn('src/added.ts', self.refresh()['files'])
        (self.root / 'src/added.ts').rename(self.root / 'src/renamed.ts')
        changed = self.refresh()
        self.assertIn('src/renamed.ts', changed['files'])
        self.assertNotIn('src/added.ts', changed['files'])
        (self.root / 'src/renamed.ts').unlink()
        changed = self.refresh()
        self.assertNotIn('src/renamed.ts', changed['files'])
        self.assertFalse(any(n.get('source_file') in {'src/added.ts', 'src/renamed.ts'} for n in changed['graph']['nodes']))
        ids = {n['id'] for n in changed['graph']['nodes']}
        self.assertTrue(all(e['source'] in ids and e['target'] in ids for e in changed['graph']['links']))
        policy = json.loads((self.root / 'scripts/graphify-scope.json').read_text())
        policy['directories'] = []
        (self.root / 'scripts/graphify-scope.json').write_text(json.dumps(policy))
        empty = self.refresh()
        self.assertEqual(empty['files'], {})
        self.assertEqual(empty['graph']['nodes'], [])

    def test_failed_extraction_and_mid_build_edit_preserve_last_good(self):
        self.refresh()
        saved = (self.runtime.out / 'code-index.json').read_bytes()
        self.write('math.ts', 'export function changed() { return 3; }')
        with patch('graphify.extract.extract', side_effect=RuntimeError('injected AST failure')):
            with self.assertRaisesRegex(RuntimeError, 'injected'):
                self.refresh()
        self.assertEqual((self.runtime.out / 'code-index.json').read_bytes(), saved)
        from graphify.extract import extract
        def during(*args, **kwargs):
            result = extract(*args, **kwargs)
            self.write('math.ts', 'export function changedAgain() { return 5; }')
            return result
        with patch('graphify.extract.extract', side_effect=during):
            with self.assertRaisesRegex(ValueError, 'cambió durante'):
                self.refresh()
        self.assertEqual((self.runtime.out / 'code-index.json').read_bytes(), saved)
        self.refresh()

    def test_recovery_and_content_hashes_after_restart(self):
        first = self.refresh()
        old_stat = (self.root / 'src/math.ts').stat()
        self.write('math.ts', 'export function double(value: number) { return value * 3; }')
        os.utime(self.root / 'src/math.ts', ns=(old_stat.st_atime_ns, old_stat.st_mtime_ns))
        self.runtime = module.Runtime(self.root)
        self.assertNotEqual(self.refresh()['generation'], first['generation'])
        (self.runtime.out / 'code-index.json').write_text('{broken')
        self.runtime = module.Runtime(self.root)
        self.assertEqual(self.runtime.index['generation'], first['generation'])
        self.assertTrue(module.valid_index(json.loads((self.runtime.out / 'code-index.json').read_text())))
        self.assertNotEqual(self.refresh()['generation'], first['generation'])

    def test_denied_sources_and_links_are_never_read(self):
        self.write('credentials.ts', 'SECRET_MUST_NOT_APPEAR')
        self.write('clip.mp4', 'PRIVATE_MEDIA')
        (self.root / 'src/profiles').mkdir()
        self.write('profiles/private.ts', 'SECRET_PROFILE')
        try:
            (self.root / 'src/linked.ts').symlink_to(SCRIPT)
        except OSError:
            pass  # Windows can require a privilege; junction guard is shared.
        index = self.refresh()
        self.assertEqual(set(index['files']), {'src/main.ts', 'src/math.ts', 'src/independent.ts'})

    def test_watcher_debounce_single_writer_and_reopen(self):
        args = [sys.executable, str(SCRIPT), '--root', str(self.root), '--watch', '--parent-stdin', '--poll', '.1', '--debounce', '.3']
        def start():
            return subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def wait_for(predicate, timeout=15):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                try:
                    value = module.load_index(self.root / 'graphify-out')
                    if value and predicate(value):
                        return value
                except (OSError, ValueError):
                    pass
                time.sleep(.1)
            self.fail('watcher timeout')
        proc = start()
        try:
            first = wait_for(lambda i: len(i['files']) == 3)
            contender = subprocess.run([sys.executable, str(SCRIPT), '--root', str(self.root)], capture_output=True, timeout=10)
            self.assertEqual(contender.returncode, 75)
            self.write('math.ts', 'export function double(value: number) { return value * 3; }')
            math_hash = module.sha((self.root / 'src/math.ts').read_bytes())
            modified = wait_for(lambda i: i['files']['src/math.ts'] == math_hash)
            self.assertEqual(set(modified['parsedFiles']), {'src/math.ts', 'src/main.ts'})
            self.write('math.ts', 'export function broken(\n  this is not valid typescript {{{')
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                state = json.loads((self.root / 'graphify-out/status.json').read_text())
                if state.get('error'):
                    break
                time.sleep(.1)
            self.assertTrue(state.get('error'), 'Real parse failure should be observable')
            self.assertEqual(module.load_index(self.root / 'graphify-out')['generation'], modified['generation'])
            self.write('math.ts', 'export function double(value: number) { return value * 4; }')
            fixed_hash = module.sha((self.root / 'src/math.ts').read_bytes())
            wait_for(lambda i: i['files']['src/math.ts'] == fixed_hash)
            for n in range(6):
                self.write('added.ts', f'export function added() {{ return {n}; }}')
                time.sleep(.03)
            added = wait_for(lambda i: 'src/added.ts' in i['files'])
            self.assertEqual(added['parsedFiles'], ['src/added.ts'])
            (self.root / 'src/added.ts').rename(self.root / 'src/renamed.ts')
            wait_for(lambda i: 'src/renamed.ts' in i['files'] and 'src/added.ts' not in i['files'])
            (self.root / 'src/renamed.ts').unlink()
            wait_for(lambda i: 'src/renamed.ts' not in i['files'])
            proc.stdin.close(); proc.wait(timeout=10)
            self.write('offline.ts', 'export function afterReopen() { return 1; }')
            proc = start()
            reopened = wait_for(lambda i: 'src/offline.ts' in i['files'])
            self.assertEqual(reopened['parsedFiles'], ['src/offline.ts'])
            self.assertNotEqual(first['generation'], reopened['generation'])
        finally:
            if proc.poll() is None:
                proc.stdin.close(); proc.wait(timeout=10)


if __name__ == '__main__':
    unittest.main(verbosity=2)
