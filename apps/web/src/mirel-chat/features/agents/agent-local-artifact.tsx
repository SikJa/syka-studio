/** @jsxImportSource react */
import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, FileText, Expand } from 'lucide-react';
import { Library } from '@diffusionstudio/runtime';
import type { ImageAsset } from '@diffusionstudio/assets';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { ElectronFileHandle } from '@/lib/electron-file-handle';
import { editorSession } from '@/dapi/session';
import { insertAssetAtPlayhead } from '@/engine/asset-actions';
import { ASSET_DRAG_TYPE } from '@/components/sidebar-left/folder-item';
import { ImageGenerationCard } from './image-generation-card';
import { projectArtifactKind, projectArtifactSource } from './agent-local-media';
import './agent-document-reader.css';

const DocumentReader = lazy(() => import('./agent-document-reader'));
const titleOf = (body: string, fallback: string) => body.match(/^#\s+(.+)$/mu)?.[1]?.replace(/[*_`]/g, '') || fallback;

/** A long response is readable without copying it out of the narrow transcript. */
export function AgentTextDocumentButton({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="syka-document-open" onClick={() => setOpen(true)}><Expand size={12}/>Leer en pantalla completa</button>
    {open ? <Suspense fallback={<p role="status">Abriendo documento…</p>}><DocumentReader body={body} title={titleOf(body, 'Respuesta de Syka')} onClose={() => setOpen(false)}/></Suspense> : null}</>;
}

type Artifact = { target: string; file: File; body?: string; url?: string; aspect?: number; asset?: ImageAsset };
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function AgentLocalArtifact({ target, label, inline = false }: { target: string; label: string; inline?: boolean }) {
  const kind = projectArtifactKind(target);
  const [artifact, setArtifact] = useState<Artifact>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false, url: string | undefined;
    setArtifact(undefined); setError(undefined); setOpen(false);
    if (inline && kind !== 'document') return;
    const session = editorSession();
    const root = session?.project.dir();
    const source = root && projectArtifactSource(target, root);
    if (!window.desktop || !root || !source || !kind) { setError('La previsualización está disponible para archivos de este proyecto en Syka Studio.'); return; }
    void (async () => {
      const [actual, actualRoot, info] = await Promise.all([
        mainBridge.call(MAIN_CHANNELS.PROJECTS_FS_REAL_PATH, { dir: root, source }),
        mainBridge.call(MAIN_CHANNELS.PROJECTS_FS_REAL_PATH, { dir: root, source: '.' }),
        mainBridge.call(MAIN_CHANNELS.PROJECTS_FS_STAT, { dir: root, source }),
      ]);
      if (cancelled) return;
      if (!actual || !actualRoot || !info || !projectArtifactSource(actual, actualRoot)) throw Error('El archivo no está disponible dentro de este proyecto.');
      const limit = kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
      if (info.size > limit) throw Error('El archivo es demasiado grande para esta previsualización. Podés abrir el original.');
      const file = await new ElectronFileHandle(actual).getFile();
      if (cancelled) return;
      if (file.size > limit) throw Error('El archivo cambió de tamaño. Abrí el original para revisarlo.');
      if (kind === 'document') {
        const body = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        if (!cancelled) setArtifact({ target, file, body });
      } else {
        url = URL.createObjectURL(file);
        const image = new Image(); image.src = url;
        await image.decode();
        if (!cancelled) setArtifact({ target, file, url, aspect: image.naturalWidth / image.naturalHeight });
      }
    })().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [target, kind, inline]);
  const current = artifact?.target === target ? artifact : undefined;
  const reveal = () => { if (window.desktop) void mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, { path: target }).catch(() => setError('No se pudo localizar el archivo.')); };
  const insert = async () => {
    const session = editorSession(), library = session?.world.get(Library);
    if (!session || !library || !current || !projectArtifactSource(target, session.project.dir())) return;
    try {
      await library.whenReady();
      const normalize = (path: string) => path.replaceAll('\\', '/').toLowerCase();
      const existing = library.assets().find(asset => normalize(library.fs.absolute?.(asset.source) || asset.source) === normalize(target));
      const report = existing ? { assets: [existing], failed: [] } : await library.import([target], { folder: 'Portadas' });
      if (report.failed.length) throw report.failed[0]!.error;
      const asset = report.assets[0];
      if (!asset || asset.type !== 'IMAGE') throw Error('El archivo no se pudo agregar como imagen.');
      if (editorSession() !== session) return;
      await library.flush(); insertAssetAtPlayhead(session.world, asset);
      setArtifact(previous => previous?.target === target ? { ...previous, asset } : previous);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo agregar la portada.'); }
  };
  const openDocument = () => { if (current?.body !== undefined) setOpen(true); else reveal(); };
  if (inline) return <><button type="button" className="agent-rich-local-file" data-local-path={target} title={kind === 'document' ? 'Abrir documento completo' : 'Mostrar archivo en carpeta'} onClick={openDocument}>{label}</button>
    {open && current?.body !== undefined ? <Suspense fallback={null}><DocumentReader body={current.body} title={titleOf(current.body, label)} fileName={current.file.name} onClose={() => setOpen(false)}/></Suspense> : null}</>;

  if (kind === 'image') return <section data-local-artifact="image" data-local-path={target}>
    <ImageGenerationCard status={error && !current?.url ? 'failed' : current?.url ? 'ready' : 'preparing'} src={current?.url}
      imageLabel={label} fileName={current?.file.name} aspect={current?.aspect || 16 / 9} assetId={current?.asset?.id}
      onInsert={() => void insert()} onDrag={transfer => { if (current?.asset) transfer.setData(ASSET_DRAG_TYPE, current.asset.id); }}
      error={error} onImageError={() => { setArtifact(undefined); setError('No se pudo decodificar la imagen.'); }}/>
    {error ? <p className="syka-local-artifact-error" role="status">{error}</p> : null}
  </section>;
  const body = current?.body;
  return <section data-local-artifact="document" data-local-path={target}>
    <button type="button" className="syka-document-card" onClick={openDocument} title={label}>
      <span><FileText size={13} aria-hidden="true"/>DOCUMENTO · {current?.file.name || target.split(/[\\/]/).at(-1)}</span>
      <strong>{body !== undefined ? titleOf(body, label) : label}</strong>
      {body !== undefined ? <small>{body.replace(/^#+\s+.*$/gm, '').replace(/[*_`]/g, '').trim()}</small> : null}
      <em>{body !== undefined ? 'Abrir documento completo' : error ? 'Mostrar archivo original' : 'Cargando documento…'}<ArrowUpRight size={12}/></em>
    </button>
    {error ? <p className="syka-local-artifact-error" role="status">{error}</p> : null}
    {open && body !== undefined ? <Suspense fallback={<p role="status">Abriendo documento…</p>}><DocumentReader body={body} title={titleOf(body, label)} fileName={current?.file.name} onClose={() => setOpen(false)}/></Suspense> : null}
  </section>;
}
