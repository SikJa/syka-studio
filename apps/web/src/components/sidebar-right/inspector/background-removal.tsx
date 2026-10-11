import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { FrameRate, Source, Muted, getSourceWindow, framesToSeconds, getParentEntity, Sequential } from '@diffusionstudio/runtime';
import type { Asset } from '@diffusionstudio/assets';
import type { Entity } from 'koota';
import type { BackgroundJob } from '@desktop/../../../packages/agent-chat/src/host/background-removal';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { useProject } from '@/context/project';
import { useLibrary } from '@/engine/library';
import { useEditor } from '@/engine/hooks';
import { getEditHistory } from '@/engine/history';
import { detachAudio } from '@/engine/audio-detach';
import { Button } from '@/components/ui/button';
import './background-removal.css';

export function BackgroundRemoval(props: { node: Entity; asset: Asset }) {
  const project = useProject(), library = useLibrary(), world = useWorld(), editor = useEditor();
  const [open, setOpen] = createSignal(false), [job, setJob] = createSignal<BackgroundJob>();
  const [error, setError] = createSignal(''), [busy, setBusy] = createSignal(false), [applied, setApplied] = createSignal(false);
  const [before, setBefore] = createSignal(''), [after, setAfter] = createSignal('');
  const [compare, setCompare] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined, ticket = 0, alive = true, originalStamp = '', originalAsset = '';
  let subject: Asset | undefined, background: Asset | undefined;
  const video = () => props.asset.type === 'VIDEO';
  const running = () => busy() || !!job() && ['preparing', 'processing'].includes(job()!.state);
  const key = () => `syka-background:${project.id()}:${props.asset.id}`;
  const urls = new Set<string>();
  const preview = async (source: string) => { const file = await library()!.fs.file(source); const url = URL.createObjectURL(file); urls.add(url); return url; };
  async function adopt(next: BackgroundJob, run: number) {
    if (!alive || run !== ticket) return;
    setJob(next);
    if (next.state === 'done' && next.subject && !subject) {
      const subjectSource = next.subjectFrames || next.subject, backgroundSource = next.backgroundFrames || next.background;
      // Import one role at a time: byte-identical media can deduplicate to an
      // older library source, so source equality does not identify its role.
      const imported = await library()!.import([subjectSource], { folder: 'Recortes' });
      if (!alive || run !== ticket) return;
      if (imported.failed.length) throw imported.failed[0].error;
      subject = imported.assets[0];
      if (backgroundSource) { const bg = await library()!.import([backgroundSource], { folder: 'Recortes' }); if (bg.failed.length) throw bg.failed[0].error; background = bg.assets[0]; }
      if (!subject) throw Error('No se pudo cargar el recorte. El original sigue intacto.');
      setAfter(await preview(next.subject));
    }
  }
  async function poll(id: string, run: number) {
    if (!alive || run !== ticket) return;
    try {
      const next = await mainBridge.call(MAIN_CHANNELS.SYKA_BACKGROUND_REMOVAL, { action: 'status', projectDir: project.dir(), id });
      await adopt(next, run);
      if (alive && run === ticket && ['preparing', 'processing'].includes(next.state)) timer = setTimeout(() => void poll(id, run), 500);
    } catch (e) { if (alive && run === ticket) setError((e as Error).message); }
  }
  createEffect(() => {
    const id = props.asset.id; const run = ++ticket;
    clearTimeout(timer); subject = background = undefined; setJob(undefined); setApplied(false); setError(''); setBefore(''); setAfter('');
    originalAsset = id; originalStamp = props.node.get(Source)?.value ?? '';
    for (const url of urls) URL.revokeObjectURL(url); urls.clear();
    void preview(props.asset.source).then(url => { if (alive && ticket === run) setBefore(url); }).catch(() => {});
    const saved = localStorage.getItem(key()); if (saved && window.desktop) void poll(saved, run);
  });
  async function start(separate: boolean) {
    setError(''); setBusy(true); setApplied(false); const run = ticket;
    try {
      if (!window.desktop) throw Error('El recorte local está disponible en Syka de escritorio.');
      if (separate && getParentEntity(props.node)?.has(Sequential)) throw Error('Sacá este clip de la secuencia antes de separar capas, para que queden superpuestas.');
      const fps = world.get(FrameRate)?.value ?? 30, span = getSourceWindow(props.node);
      const start = video() ? framesToSeconds(span.in, fps) : 0, end = video() ? framesToSeconds(span.out, fps) : undefined;
      if (video() && (!end || end <= start || end - start > 30)) throw Error('Dividí el clip en tramos de hasta 30 segundos para recortarlo localmente.');
      let source = props.asset.source;
      // Existing linked originals stay intact; a portable copy becomes input.
      if (/^(?:[a-z]:[\\/]|\/|\\\\)/i.test(source)) {
        const imported = await library()!.import([source], { copy: true, folder: 'Originales' });
        if (!imported.assets[0]) throw imported.failed[0]?.error ?? Error('No se pudo copiar el original.');
        source = imported.assets[0].source;
      }
      subject = background = undefined; setAfter('');
      const next = await mainBridge.call(MAIN_CHANNELS.SYKA_BACKGROUND_REMOVAL, { action: 'start', projectDir: project.dir(), source, start, end, separate, quality: 'best' });
      if (!alive || run !== ticket) return;
      localStorage.setItem(key(), next.id); setJob(next); void poll(next.id, run);
    } catch (e) { if (alive && run === ticket) setError((e as Error).message.includes('No handler') ? 'Reiniciá Syka para activar el motor local de recorte.' : (e as Error).message); }
    finally { if (alive && run === ticket) setBusy(false); }
  }
  function apply() {
    setError('');
    try {
      const result = job();
      // Commands can change selection synchronously (audio detach does). Keep
      // this exact entity/assets rather than reading changing inspector props.
      const node = props.node, media = props.asset, isVideo = video(), foregroundAsset = subject, backgroundAsset = background;
      if (!subject || result?.state !== 'done' || props.node.get(Source)?.value !== originalStamp || props.asset.id !== originalAsset) throw Error('Seleccioná nuevamente el clip original antes de aplicar.');
      if (result.separate && (!background || getParentEntity(props.node)?.has(Sequential))) throw Error('Este clip necesita un contenedor con capas superpuestas.');
      getEditHistory(world).command(() => {
        if (isVideo && media.type === 'VIDEO' && media.channels && !node.has(Muted)) detachAudio(world, [node]);
        const foreground = result.separate ? editor.duplicateInPlace(node)[0]?.copy : node;
        if (!foreground) throw Error('No se pudo crear la capa del sujeto.');
        if (result.separate && backgroundAsset) {
          editor.editProperty(node, 'src', backgroundAsset.path); editor.editProperty(node, 'name', 'Fondo recortado'); editor.editProperty(node, 'muted', true);
          if (isVideo) { editor.editProperty(node, 'sourceIn', 0); editor.editProperty(node, 'sourceOut', result.end! - result.start); editor.editProperty(node, 'frameRate', result.frameRate!); }
        }
        editor.editProperty(foreground, 'src', foregroundAsset!.path); editor.editProperty(foreground, 'name', 'Sujeto sin fondo');
        if (isVideo) { editor.editProperty(foreground, 'sourceIn', 0); editor.editProperty(foreground, 'sourceOut', result.end! - result.start); editor.editProperty(foreground, 'frameRate', result.frameRate!); }
        editor.select(foreground);
      });
      setApplied(true);
    } catch (e) { setError((e as Error).message); }
  }
  const cancel = async () => { try { const next = await mainBridge.call(MAIN_CHANNELS.SYKA_BACKGROUND_REMOVAL, { action: 'cancel', projectDir: project.dir(), id: job()?.id }); setJob(next); } catch (e) { setError((e as Error).message); } };
  onCleanup(() => { alive = false; ticket++; clearTimeout(timer); for (const url of urls) URL.revokeObjectURL(url); });
  return <section class="syka-cutout" aria-label="Recorte de personas">
    <button class="syka-cutout-toggle" aria-expanded={open()} onClick={() => setOpen(!open())}>Quitar fondo <span aria-hidden="true">{open() ? '−' : '+'}</span></button>
    <div class="syka-cutout-reveal" data-open={open()} inert={!open()}><div>
      <p>Separá a la persona del fondo. Local, sin API. El original se conserva.</p>
      <div class="syka-cutout-actions"><Button disabled={running()} onClick={() => void start(false)}>Quitar fondo</Button><Button disabled={running()} variant="outline" onClick={() => void start(true)}>Separar capas</Button></div>
      <Show when={job()}><div role="status" aria-live="polite"><span>{job()!.message}</span><Show when={running()}><progress max="100" value={job()!.progress} /><Button variant="ghost" onClick={() => void cancel()}>Cancelar</Button></Show></div></Show>
      <Show when={after()}><div class="syka-cutout-preview" aria-label={compare() ? 'Original' : 'Sujeto sin fondo'}>
        <Show when={video()} fallback={<img src={compare() ? before() : after()} alt={compare() ? 'Original' : 'Sujeto recortado'} />}><video src={compare() ? before() : after()} controls playsinline preload="metadata" /></Show>
      </div><div class="syka-cutout-actions"><Button variant="ghost" aria-pressed={compare()} onClick={() => setCompare(!compare())}>{compare() ? 'Ver recorte' : 'Ver original'}</Button><Button disabled={applied()} onClick={apply}>{applied() ? 'Aplicado' : job()?.separate ? 'Aplicar dos capas' : 'Aplicar recorte'}</Button></div></Show>
      <Show when={error() || job()?.error}><p role="alert" class="syka-cutout-error">{error() || job()?.error}</p></Show>
      <small>Para personas. Revisá pelo, manos y movimiento. Separar capas no reconstruye lo que estaba detrás; el fondo queda con un hueco transparente. Podés deshacer la aplicación.</small>
    </div></div>
  </section>;
}
