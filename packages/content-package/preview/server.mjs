import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { captureContext, PackageStore, editCopy, localVariants, reviewPackage, publicationDraft, freshness, rebase, sha256, validateImage } from '../core.mjs';
import { composeCover } from '../cover.mjs';
import { PLATFORMS, DEMO_ACCOUNTS, StyleStore, newStyle, prepareSocial, editTarget, socialDraft, socialFreshness } from '../social.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const runtime = path.resolve(repo, process.env.SYKA_CONTENT_RUNTIME_ROOT || '.runtime/content-package');
if (!runtime.startsWith(path.join(repo, '.runtime') + path.sep)) throw new Error('La preview escribe sólo en .runtime del worktree');
const store = new PackageStore(path.join(runtime, 'packages'));
const styles = new StyleStore(path.join(runtime, 'styles'));
async function accountSnapshot(demo) {
  if (demo) return DEMO_ACCOUNTS;
  try { return JSON.parse(await readFile(path.join(runtime, 'account-snapshot.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return { source: 'publication', accounts: [] }; }
}
async function portableStyleMaterials(captured, style) {
  const materials = [...captured.materials];
  for (const ref of style.references.filter(r => r.kind === 'image')) {
    if (!/^[a-f0-9]{64}\.(png|jpg|jpeg)$/.test(ref.file)) throw new Error('Referencia inválida');
    const bytes = await readFile(path.join(runtime, 'references', ref.file));
    if (sha256(bytes) !== ref.file.split('.')[0]) throw new Error('Cambió la imagen de referencia');
    materials.push({ kind: 'reference', bytes, hash: sha256(bytes), file: `assets/${ref.file}`, source: ref.label });
  }
  return { ...captured, materials };
}
async function session() {
  const config = JSON.parse(await readFile(path.join(runtime, 'session.json'), 'utf8'));
  return { config, pkg: await store.load(config.packageId), captured: await captureContext(config.input) };
}
function coverFor(pkg, captured, spec = pkg.cover) {
  if (!spec) throw new Error('Portada desactivada');
  return composeCover({ ...spec, frame: captured.materials.find(m => m.kind === 'frame' && m.hash === spec.frameHash),
    logo: spec.logoHash ? captured.materials.find(m => m.kind === 'logo' && m.hash === spec.logoHash) : null });
}
async function bodyOf(req) {
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8000000) throw new Error('Solicitud demasiado grande'); }
  return JSON.parse(body);
}
export function createPreviewServer() {
  return http.createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`;
    const respond = (code, value, mime = 'application/json') => {
      res.writeHead(code, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(mime === 'application/json' ? JSON.stringify(value) : value);
    };
    try {
      if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '')) return respond(403, { error: 'Host no permitido' });
      const url = new URL(req.url, origin);
      if (req.method === 'GET') {
        if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
        const staticFiles = { '/': ['index.html', 'text/html'], '/app.mjs': ['app.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
        if (staticFiles[url.pathname]) { const [file, mime] = staticFiles[url.pathname]; return respond(200, await readFile(path.join(here, file)), mime); }
        if (url.pathname === '/font.ttf') return respond(200, await readFile(path.join(repo, 'apps/web/src/assets/fonts/Inter-VariableFont_opsz,wght.ttf')), 'font/ttf');
        const platform = url.pathname.match(/^\/logos\/([a-z]+)\.svg$/)?.[1];
        if (platform && PLATFORMS[platform]) return respond(200, await readFile(path.join(repo, 'docs/resources/logos', PLATFORMS[platform].logo)), 'image/svg+xml');
        const reference = url.pathname.match(/^\/references\/([a-f0-9]{64}\.(?:png|jpg|jpeg))$/)?.[1];
        if (reference) return respond(200, await readFile(path.join(runtime, 'references', reference)), reference.endsWith('.png') ? 'image/png' : 'image/jpeg');
        const { pkg, captured } = await session();
        if (url.pathname === '/api/session') {
          const profiles = await styles.list(), accounts = await accountSnapshot(url.searchParams.get('demo') === '1');
          const style = profiles.find(p => p.id === pkg.social?.styleId);
          return respond(200, { pkg, freshness: freshness(pkg, captured), history: await store.list(pkg.id), styles: profiles, emptyStyle: newStyle(), accounts,
            socialCurrent: style ? socialFreshness(pkg, captured, style, accounts) : false, platforms: PLATFORMS, capabilities: { textGeneration: false, imageGeneration: false } });
        }
        if (url.pathname === '/api/frame') { const frame = captured.materials.find(m => m.kind === 'frame'); if (!frame) throw new Error('Sin fotograma'); return respond(200, frame.bytes, 'image/png'); }
        if (url.pathname === '/api/social-cover') {
          const target = pkg.social?.targets.find(t => t.account.id === url.searchParams.get('account'));
          if (!target?.cover) throw new Error('Sin portada');
          return respond(200, coverFor(pkg, captured, target.cover), 'image/svg+xml');
        }
        if (url.pathname === '/api/cover') {
          if (!freshness(pkg, captured).current) throw new Error('Portada desactualizada');
          return respond(200, coverFor(pkg, captured), 'image/svg+xml');
        }
        return respond(404, { error: 'No existe' });
      }
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') return respond(403, { error: 'Solicitud local requerida' });
      const data = await bodyOf(req);
      if (url.pathname === '/api/style') {
        for (const ref of data.style?.references ?? []) if (ref.kind === 'image') {
          if (!/^[a-f0-9]{64}\.(png|jpg|jpeg)$/.test(ref.file)) throw new Error('Referencia inválida');
          const bytes = await readFile(path.join(runtime, 'references', ref.file));
          if (sha256(bytes) !== ref.file.split('.')[0]) throw new Error('Cambió la referencia');
        }
        return respond(200, await styles.save(data.style));
      }
      if (url.pathname === '/api/reference') {
        if (!['image/png', 'image/jpeg'].includes(data.mime) || typeof data.base64 !== 'string') throw new Error('Adjuntá una imagen PNG o JPG');
        const bytes = Buffer.from(data.base64, 'base64'); if (bytes.length > 5000000) throw new Error('Máximo 5 MB por imagen');
        const ext = data.mime === 'image/png' ? '.png' : '.jpg'; validateImage(bytes, ext);
        const file = sha256(bytes) + ext; await mkdir(path.join(runtime, 'references'), { recursive: true });
        await writeFile(path.join(runtime, 'references', file), bytes); return respond(200, { file });
      }
      const { pkg, captured } = await session();
      if (data.revision !== pkg.revision) return respond(409, { error: 'Hay una revisión nueva. Recargá antes de guardar.' });
      if (url.pathname === '/api/refresh') return respond(200, await store.save(rebase(pkg, captured), captured));
      if (!freshness(pkg, captured).current) return respond(409, { error: 'Cambió el origen. Prepará una revisión nueva.' });
      if (url.pathname.startsWith('/api/social/')) {
        const style = await styles.load(data.styleId), accounts = await accountSnapshot(data.demo === true);
        if (url.pathname === '/api/social/prepare') return respond(200, await store.save(prepareSocial(pkg, style, accounts), await portableStyleMaterials(captured, style)));
        if (!socialFreshness(pkg, captured, style, accounts)) throw new Error('Cambió el estilo o las cuentas. Prepará nuevos borradores.');
        if (url.pathname === '/api/social/save' || url.pathname === '/api/social/review') {
          let cover = null;
          if (data.cover) {
            cover = { mode: 'frame-composition', title: data.cover.title, subtitle: data.cover.subtitle ?? '', frameHash: captured.materials.find(m => m.kind === 'frame')?.hash };
            coverFor(pkg, captured, cover);
          }
          const next = editTarget(pkg, data.accountId, { title: data.title, description: data.description, cover }, url.pathname.endsWith('/review'));
          return respond(200, await store.save(next, await portableStyleMaterials(captured, style)));
        }
        if (url.pathname === '/api/social/draft') {
          const draft = socialDraft(pkg, captured, style, accounts);
          await writeFile(path.join(runtime, `social-draft-r${pkg.revision}.json`), JSON.stringify(draft, null, 2)); return respond(200, draft);
        }
        return respond(404, { error: 'No existe' });
      }
      if (url.pathname === '/api/local-copy') return respond(200, await store.save(editCopy(pkg, localVariants(pkg.context.brief), 0, 'local-extractive'), captured));
      if (url.pathname === '/api/save' || url.pathname === '/api/review') {
        let next = editCopy(pkg, data.variants, data.selected);
        if (data.cover) {
          next.cover = { mode: 'frame-composition', title: data.cover.title, subtitle: data.cover.subtitle,
            frameHash: captured.materials.find(m => m.kind === 'frame')?.hash,
            logoHash: data.cover.useLogo ? captured.materials.find(m => m.kind === 'logo')?.hash : undefined };
          coverFor(next, captured);
        } else next.cover = null;
        if (url.pathname === '/api/review') next = reviewPackage(next, captured, 'Revisión manual en preview local');
        return respond(200, await store.save(next, captured));
      }
      if (url.pathname === '/api/draft') {
        const draft = publicationDraft(pkg, captured);
        await writeFile(path.join(runtime, `publication-draft-r${pkg.revision}.json`), JSON.stringify(draft, null, 2), { flag: 'w' });
        return respond(200, draft);
      }
      return respond(404, { error: 'No existe' });
    } catch (error) { respond(400, { error: error.message }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SYKA_CONTENT_PORT || 5306);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log(`Content package preview: http://127.0.0.1:${port}`));
}
