import { For, Show, createSignal, createEffect } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import type { Entity } from 'koota';
import { PanelSection } from '@/components/ui/panel-section';
import { useDerived } from '@/engine/hooks';
import { applyAdaptation, firstSource, prepareAdaptation, sceneDecision, sceneSize } from '@/engine/formats/native';
import { PRESETS, ratioOf, validSize, type Destination, type Ratio, type FormatDecision } from '@/engine/formats/model';
import './format-panel.css';

const destinations: { value: Destination; label: string }[] = [{ value: 'none', label: 'Sin destino' }, { value: 'reels', label: 'Reel' }, { value: 'shorts', label: 'Short' }, { value: 'tiktok', label: 'TikTok' }, { value: 'youtube', label: 'YouTube' }];
export function FormatPanel(props: { scene: Entity }) {
  const world = useWorld();
  const state = useDerived(() => JSON.stringify({ size: sceneSize(props.scene), decision: sceneDecision(props.scene), source: firstSource(world, props.scene) }));
  const current = () => JSON.parse(state()) as { size: { width: number; height: number }; decision?: FormatDecision; source?: ReturnType<typeof firstSource> };
  const [open, setOpen] = createSignal(false);
  const [mode, setMode] = createSignal<'auto' | 'manual'>(current().decision?.mode ?? 'manual');
  const [ratio, setRatio] = createSignal<Ratio>(ratioOf(current().size));
  const [width, setWidth] = createSignal(current().size.width);
  const [height, setHeight] = createSignal(current().size.height);
  const [destination, setDestination] = createSignal<Destination>(current().decision?.destination ?? 'none');
  const [fit, setFit] = createSignal<'fit' | 'fill'>('fit');
  const [plan, setPlan] = createSignal<ReturnType<typeof prepareAdaptation>>();
  const [error, setError] = createSignal('');
  createEffect(() => {
    const saved = current();
    setMode(saved.decision?.mode ?? 'manual'); setRatio(ratioOf(saved.size));
    setWidth(saved.size.width); setHeight(saved.size.height); setDestination(saved.decision?.destination ?? 'none');
    setPlan(undefined);
  });
  const target = () => mode() === 'auto' ? current().source ?? current().size : ratio() === 'custom' ? { width: width(), height: height() } : PRESETS[ratio() as Exclude<Ratio, 'custom'>];
  const invalidate = () => { setPlan(undefined); setError(''); };
  const preview = () => { try { setPlan(prepareAdaptation(world, props.scene, target(), fit())); setError(''); } catch (e) { setError(String(e)); } };
  const apply = () => {
    try {
      const p = plan(); if (!p) return;
      applyAdaptation(world, props.scene, p, { version: 1, mode: mode(), destination: destination(), provenance: 'manual',
        revision: (current().decision?.revision ?? 0) + 1, source: current().source, awaitingFirstMedia: false });
      setPlan(undefined); setError('Aplicado. Podés deshacer con Ctrl+Z.');
    } catch (e) { setError(String(e)); }
  };
  return <PanelSection title="Formato y destino">
    <div class="syka-format t-acc" data-open={String(open())}>
      <button class="t-acc-head format-head" aria-expanded={open()} onClick={() => setOpen(!open())}>
        <span><strong>{ratioOf(current().size) === 'custom' ? 'Personalizado' : ratioOf(current().size)}</strong><small>{current().size.width} × {current().size.height} · {current().decision?.mode === 'auto' ? 'Automático' : 'Manual / existente'}</small></span>
        <span class="t-acc-chevron"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6.5L8 10.5L12 6.5" /></svg></span>
      </button>
      <div class="t-acc-panel" inert={!open()}><div class="t-acc-panel-inner"><div class="format-body">
        <p class="format-note">Origen: {current().source ? `${current().source!.width} × ${current().source!.height} · ${current().source!.ratio}` : 'sin metadata disponible'}. La proporción no define el estilo editorial.</p>
        <div class="format-pills" aria-label="Modo de formato"><For each={['auto', 'manual'] as const}>{value => <button aria-pressed={mode() === value} onClick={() => { setMode(value); invalidate(); }}>{value === 'auto' ? 'Automático' : 'Manual'}</button>}</For></div>
        <Show when={mode() === 'manual'}><div class="format-pills" aria-label="Proporción"><For each={[...Object.keys(PRESETS), 'custom'] as Ratio[]}>{value => <button aria-pressed={ratio() === value} onClick={() => { setRatio(value); invalidate(); }}>{value === 'custom' ? 'Otra' : value}</button>}</For></div>
          <Show when={ratio() === 'custom'}><div class="format-measures"><label>Ancho<input aria-label="Ancho" type="number" min="2" max="16384" value={width()} onInput={e => { setWidth(e.currentTarget.valueAsNumber); invalidate(); }} /></label><span>×</span><label>Alto<input aria-label="Alto" type="number" min="2" max="16384" value={height()} onInput={e => { setHeight(e.currentTarget.valueAsNumber); invalidate(); }} /></label></div></Show>
        </Show>
        <span class="format-note">Destino opcional</span><div class="format-pills"><For each={destinations}>{item => <button aria-pressed={destination() === item.value} onClick={() => { setDestination(item.value); invalidate(); }}>{item.label}</button>}</For></div>
        <Show when={['reels', 'shorts', 'tiktok'].includes(destination()) && ratioOf(target()) !== '9:16'}><p class="format-note">Este destino suele usar 9:16. Elegilo manualmente si querés adaptar el encuadre.</p></Show>
        <div class="format-pills"><button aria-pressed={fit() === 'fit'} onClick={() => { setFit('fit'); invalidate(); }}>Encajar</button><button aria-pressed={fit() === 'fill'} onClick={() => { setFit('fill'); invalidate(); }}>Llenar · recortar</button></div>
        <button class="format-action" disabled={!validSize(target())} onClick={preview}>Previsualizar adaptación</button>
        <Show when={plan()}>{p => <div class="format-review">
          <div class="format-diagram" style={{ 'aspect-ratio': `${p().to.width}/${p().to.height}` }} aria-label="Esquema del encuadre propuesto">
            <div class="format-safe" /><For each={p().changes.filter(c => c.props.width && c.props.height)}>{c => <div class="format-box" style={{ left: `${Number(c.props.x) / p().to.width * 100}%`, top: `${Number(c.props.y) / p().to.height * 100}%`, width: `${Number(c.props.width) / p().to.width * 100}%`, height: `${Number(c.props.height) / p().to.height * 100}%` }} />}</For>
          </div>
          <p class="format-note">Esquema de layout · {p().to.width} × {p().to.height}. Área punteada: lectura. Revisá el video en el lienzo al aplicar.</p>
          <For each={p().warnings}>{warning => <p class="format-note">{warning}</p>}</For>
          <div class="format-pills"><button class="format-action" onClick={apply}>Aplicar</button><button onClick={() => setPlan(undefined)}>Cancelar</button></div>
        </div>}</Show>
        <Show when={error()}><p role="status" class="format-note">{error()}</p></Show>
      </div></div></div>
    </div>
  </PanelSection>;
}
