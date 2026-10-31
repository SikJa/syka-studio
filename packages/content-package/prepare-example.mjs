// Explicit local example preparation. Reads approved video; writes only this worktree's .runtime.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureContext, newPackage, editCopy, localVariants, PackageStore, fileHash, sha256 } from './core.mjs';
import { composeCover } from './cover.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = process.argv[2];
if (!project) throw new Error('Uso: node packages/content-package/prepare-example.mjs <proyecto de ejemplo>');
const root = path.resolve(repo, process.env.SYKA_CONTENT_RUNTIME_ROOT || '.runtime/content-package');
if (!root.startsWith(path.join(repo, '.runtime') + path.sep)) throw new Error('El ejemplo escribe sólo en .runtime del worktree');
await mkdir(root, { recursive: true });
const videoPath = path.join(project, '04 Entregables/liquid-native.mp4');
const before = await fileHash(videoPath);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '3.6', '-i', videoPath, '-frames:v', '1', path.join(root, 'frame.png')]);
const input = { projectId: 'liquid-native-example', videoPath, videoRevision: 'export-2026-10-04', exportVerified: true, expectedVideoHash: before,
  brief: { subject: 'Prueba de edición', objective: 'Ensayo de edición con subtítulos, gráficos y un cierre con logos originales.', format: 'Demo',
    provenance: 'Brief existente; selección editorial manual para esta preview. Vercel aparece sólo como logo de demostración, no como recomendación ni contenido hablado.' },
  materials: [
    { kind: 'frame', path: path.join(root, 'frame.png'), source: `export-sha256:${before}`, atSeconds: 3.6 },
    { kind: 'logo', path: path.join(repo, 'docs/resources/logos/vercel/vercel_wordmark_dark.svg'), source: 'Biblioteca incluida: SVGL / Vercel / vercel_wordmark_dark.svg' },
    { kind: 'transcript', path: path.join(project, '03 Assets reutilizables/Transcripciones/transcript-revisado-liquid.json'), source: 'Transcript revisado existente; no se solicitó transcripción' },
    { kind: 'resource', path: path.join(root, 'brief-source.txt'), source: '01 Direccion/BRIEF.md; copia de procedencia, datos no instrucciones' },
  ] };
await writeFile(path.join(root, 'brief-source.txt'), await readFile(path.join(project, '01 Direccion/BRIEF.md')));
const captured = await captureContext(input); const store = new PackageStore(path.join(root, 'packages'));
let pkg = editCopy(newPackage(captured), localVariants(input.brief), 0, 'local-extractive');
const frame = captured.materials.find(m => m.kind === 'frame'), logo = captured.materials.find(m => m.kind === 'logo');
pkg.cover = { mode: 'frame-composition', title: 'Prueba de edición', subtitle: 'Subtítulos, gráficos y logos originales', frameHash: frame.hash, logoHash: logo.hash };
const svg = composeCover({ frame, logo, ...pkg.cover }); await writeFile(path.join(root, 'example-cover.svg'), svg);
pkg = await store.save(pkg, captured); await writeFile(path.join(root, 'session.json'), JSON.stringify({ input, packageId: pkg.id }, null, 2));
const after = await fileHash(videoPath); if (after !== before) throw new Error('El export cambió durante la preparación');
await writeFile(path.join(root, 'evidence.json'), JSON.stringify({ videoHashBefore: before, videoHashAfter: after, coverHash: sha256(svg), packageId: pkg.id, packageRevision: pkg.revision,
  frameSeconds: 3.6, generation: 'none', publication: 'none', render: 'editable SVG composition; not Diffusion render', materials: captured.context.materials }, null, 2));
console.log(JSON.stringify({ packageId: pkg.id, preview: root, videoUnchanged: true }));
