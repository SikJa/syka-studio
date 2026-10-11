"""Read the coherent bundle and write a small generation-bound route inventory.

Does not extract, start providers, query an old HTML or scan source files.
"""
from pathlib import Path
import json
import hashlib
root = Path(__file__).resolve().parents[1]
out = root / 'graphify-out'
index = json.loads((out / 'code-index.json').read_text(encoding='utf-8'))
if hashlib.sha256(index['graphJson'].encode()).hexdigest() != index['checksum']:
    raise SystemExit('Indice corrupto: iniciar Syka para recuperar la ultima generacion integra.')
graph = json.loads(index['graphJson'])
routes = {}
for node in graph['nodes']:
    path = node.get('source_file')
    if path in index['files']:
        routes.setdefault(path, []).append({'label': node.get('label'), 'location': node.get('source_location'), 'id': node['id']})
manifest = {'version': 2, 'generation': index['generation'], 'generatedAt': index['generatedAt'],
            'authority': 'code-index.json; verify current source hashes with syka_code_graph',
            'scope': 'explicit public allowlist in scripts/graphify-scope.json',
            'routes': routes, 'legacyHtml': 'historical snapshot, not automatically refreshed',
            'update': 'scripts/refresh-graphify.ps1; automatic worker while Syka agent host is running'}
temp = out / 'routes-manifest.json.tmp'
temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
temp.replace(out / 'routes-manifest.json')
print('Routes:', len(routes), 'generation:', index['generation'])
