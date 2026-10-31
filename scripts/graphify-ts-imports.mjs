// Parse only; never execute source. Preserve byte offsets for Graphify locations.
import ts from 'typescript';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { source, tsx } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const file = ts.createSourceFile(tsx ? 'source.tsx' : 'source.ts', source, ts.ScriptTarget.Latest, true);
if (file.parseDiagnostics.length) {
  process.stdout.write('null');
} else {
  const ranges = [];
  const visit = node => {
    if (ts.isImportTypeNode(node)) {
      const start = node.getStart(file), afterArgument = source.slice(node.argument.end);
      const close = /^\s*\)/.exec(afterArgument);
      if (close) ranges.push([Buffer.byteLength(source.slice(0, start)), Buffer.byteLength(source.slice(0, node.argument.end + close[0].length))]);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const bytes = Buffer.from(source);
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i++) if (bytes[i] !== 10 && bytes[i] !== 13) bytes[i] = i === start ? 84 : 32;
  }
  process.stdout.write(JSON.stringify(ranges.length ? bytes.toString('utf8') : null));
}
