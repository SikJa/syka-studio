import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { formatVideoTime, parseVideoTime, validateVideoRange, youtubeUrlsInText, type VideoImportJob, type VideoImportMetadata, type VideoImportResult } from '@desktop/video-import/types';
import { mainBridge } from '@/lib/ipc';
import './video-link-import.css';

type Props = {
  text: string;
  attachedPaths: string[];
  resolveProject(): Promise<{ dir: string; seedTimeline: boolean } | null>;
  onImported(result: VideoImportResult, metadata: VideoImportMetadata): void;
  onPending(pending: boolean): void;
  onOpen(result: VideoImportResult): void;
};

function importError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No handler for request') ? 'Reiniciá Syka Studio para activar la importación de enlaces.' : message;
}

/** Link preparation belongs beside the existing prompt, before the agent spends a turn. */
export function VideoLinkImport(props: Props) {
  const [job, setJob] = createSignal<VideoImportJob | null>(null);
  const [error, setError] = createSignal('');
  const [start, setStart] = createSignal('0:00'), [end, setEnd] = createSignal('');
  const [customRange, setCustomRange] = createSignal(false);
  const [requesting, setRequesting] = createSignal(false);
  const [completed, setCompleted] = createSignal<string[]>([]);
  const completedJobs = new Map<string, VideoImportJob>();
  const links = createMemo(() => youtubeUrlsInText(props.text));
  let currentUrl = '', timer: ReturnType<typeof setTimeout> | undefined, sequence = 0, alive = true, delivered = '';
  const active = () => !!job() && ['inspecting', 'downloading', 'finalizing'].includes(job()!.state);
  const range = () => {
    if (!customRange() && !job()?.metadata?.requiresRange) return undefined;
    return { start: parseVideoTime(start()) ?? NaN, end: parseVideoTime(end()) ?? NaN };
  };
  const rangeIssue = createMemo(() => {
    const metadata = job()?.metadata;
    if (!metadata || job()?.state !== 'ready') return '';
    try { validateVideoRange(metadata, range()); return ''; } catch (e) { return (e as Error).message; }
  });
  const apply = (value: VideoImportJob) => {
    setJob(value);
    if (value.state === 'done' && value.result && value.metadata && delivered !== value.id) {
      completedJobs.set(value.url, value); setCompleted(list => [...new Set([...list, value.url])]);
      delivered = value.id; props.onImported(value.result, value.metadata);
    }
  };
  const poll = async (id: string, ticket: number) => {
    if (!alive || ticket !== sequence) return;
    try {
      const next = await mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'status', id });
      if (!alive || ticket !== sequence) return;
      const previous = job()?.state; apply(next);
      if (next.state === 'ready' && previous !== 'ready') {
        setCustomRange(next.metadata?.requiresRange ?? false);
        // Long videos require an explicit interval. No 12-hour silent default.
        setEnd(next.metadata?.requiresRange ? '' : formatVideoTime(next.metadata?.duration ?? 0));
      }
      if (['inspecting', 'downloading', 'finalizing'].includes(next.state)) timer = setTimeout(() => void poll(id, ticket), 500);
    } catch (e) { if (alive && ticket === sequence) setError(importError(e)); }
  };
  const inspect = async (url: string) => {
    const ticket = ++sequence;
    clearTimeout(timer); setError(''); setJob(null); setStart('0:00'); setEnd(''); setRequesting(false);
    if (!url) return;
    if (!window.desktop) { setError('Abrí Syka Studio en la aplicación de escritorio para importar enlaces.'); return; }
    const cached = completedJobs.get(url); if (cached) { apply(cached); return; }
    setRequesting(true);
    try {
      const next = await mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'inspect', url });
      if (!alive || ticket !== sequence) { void mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'cancel', id: next.id }); return; }
      apply(next); void poll(next.id, ticket);
    } catch (e) { if (alive && ticket === sequence) setError(importError(e)); }
    finally { if (alive && ticket === sequence) setRequesting(false); }
  };
  createEffect(() => {
    const url = links().find(link => !completed().includes(link)) ?? (links().includes(currentUrl) ? currentUrl : links()[0]) ?? '';
    if (url === currentUrl) return;
    const prior = job(); currentUrl = url; clearTimeout(timer);
    if (prior && ['inspecting', 'ready', 'downloading'].includes(prior.state)) void mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'cancel', id: prior.id }).catch(() => {});
    // Debounce ordinary typing, while pasted links reach preparation promptly.
    const ticket = ++sequence;
    timer = setTimeout(() => { if (ticket === sequence) void inspect(url); }, 400);
    if (!url) { setJob(null); setError(''); setRequesting(false); }
  });
  createEffect(() => props.onPending(links().some(link => {
    const imported = completedJobs.get(link)?.result;
    return !completed().includes(link) || !imported || !props.attachedPaths.includes(imported.path);
  })));
  const download = async () => {
    const current = job(); if (!current || requesting() || rangeIssue()) return;
    setRequesting(true); setError('');
    try {
      const project = await props.resolveProject(); if (!project) return;
      const next = await mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'start', id: current.id, projectDir: project.dir, range: range(), seedTimeline: project.seedTimeline });
      apply(next); void poll(next.id, sequence);
    } catch (e) { setError(importError(e)); }
    finally { setRequesting(false); }
  };
  const cancel = async () => {
    const current = job(); if (!current) return;
    setRequesting(true);
    try { apply(await mainBridge.call(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, { action: 'cancel', id: current.id })); }
    catch (e) { setError(importError(e)); }
    finally { setRequesting(false); }
  };
  onCleanup(() => { alive = false; ++sequence; clearTimeout(timer); props.onPending(false); });
  return <Show when={links().length > 0}>
    <section class="syka-video-link t-panel-slide" data-open="true" aria-label="Importar video de YouTube">
      <div class="syka-video-link-heading">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="5" fill="#f03"/><path d="m10 9 6 3-6 3Z" fill="white"/></svg>
        <div><strong>{job()?.metadata?.title ?? 'Video de YouTube'}</strong><span>{job()?.metadata ? [job()!.metadata!.channel, job()!.metadata!.duration ? formatVideoTime(job()!.metadata!.duration!) : 'Duración por confirmar', job()!.metadata!.liveStatus === 'archive' ? 'Directo terminado' : ''].filter(Boolean).join(' · ') : 'Leemos el enlace antes de descargar'}</span></div>
      </div>
      <Show when={links().filter(link => !completed().includes(link)).length > 1}><p>Vamos de a un enlace. Al terminar aparece el siguiente.</p></Show>
      <Show when={job()?.state === 'ready'}>
        <Show when={job()?.metadata?.requiresRange || customRange()} fallback={<button class="syka-video-link-subtle" onClick={() => setCustomRange(true)}>Elegir sólo un fragmento</button>}>
          <p>Elegí el tramo que vas a editar. Hasta 30 minutos por importación.</p>
          <div class="syka-video-link-range">
            <label>Desde<input aria-label="Inicio del intervalo" placeholder="0:00" value={start()} onInput={e => setStart(e.currentTarget.value)} /></label>
            <span aria-hidden="true">—</span>
            <label>Hasta<input aria-label="Final del intervalo" placeholder="15:00" value={end()} onInput={e => setEnd(e.currentTarget.value)} /></label>
          </div>
          <Show when={(job()?.metadata?.chapters.length ?? 0) > 0}><details><summary>Elegir un capítulo</summary><div class="syka-video-link-chapters"><For each={job()?.metadata?.chapters}>{chapter => <button onClick={() => { setStart(formatVideoTime(chapter.start)); setEnd(formatVideoTime(chapter.end)); }}>{chapter.title}<span>{formatVideoTime(chapter.start)} – {formatVideoTime(chapter.end)}</span></button>}</For></div></details></Show>
        </Show>
        <Show when={rangeIssue()}><p class="syka-video-link-validation">{rangeIssue()}</p></Show>
        <div class="syka-video-link-actions"><small>MP4 hasta 1080p, guardado en el proyecto. La transcripción se pide después.</small><button class="syka-video-link-primary" disabled={requesting() || !!rangeIssue()} onClick={() => void download()}>Importar video</button></div>
      </Show>
      <Show when={active() || requesting()}>
        <div class="syka-video-link-progress" role="status"><span>{job()?.message ?? 'Leyendo el enlace…'}</span><Show when={job()?.percent !== undefined}><span>{Math.floor(job()!.percent!)}%</span></Show></div>
        <Show when={job()?.percent !== undefined} fallback={<progress aria-label="Progreso de importación" max="100" />}><progress aria-label="Progreso de importación" value={job()?.percent ?? 0} max="100" /></Show>
        <button class="syka-video-link-subtle" disabled={requesting() || job()?.state === 'finalizing'} onClick={() => void cancel()}>Cancelar</button>
      </Show>
      <Show when={job()?.state === 'done'}><div class="syka-video-link-actions"><small>Listo · {formatVideoTime(job()!.result!.duration)} · guardado en el proyecto</small><Show when={props.attachedPaths.includes(job()!.result!.path)} fallback={<button class="syka-video-link-primary" onClick={() => props.onImported(job()!.result!,job()!.metadata!)}>Volver a adjuntar</button>}><button class="syka-video-link-primary" onClick={() => props.onOpen(job()!.result!)}>Abrir proyecto</button></Show></div></Show>
      <Show when={error() || job()?.error}><p role="alert" class="syka-video-link-error">{error() || job()?.error}</p></Show>
      <Show when={job()?.state === 'error' || job()?.state === 'cancelled' || error()}><button class="syka-video-link-subtle" onClick={() => void inspect(currentUrl)}>Volver a intentar</button></Show>
    </section>
  </Show>;
}
