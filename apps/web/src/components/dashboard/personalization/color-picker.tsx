import { For, Show, createEffect, createSignal, createUniqueId, onCleanup } from 'solid-js';
import { colord } from 'colord';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { clamp, formatColor, parseColor, type ColorFormat } from '@/lib/appearance/color';

export const ACCENT_PRESETS = [
  ['Azul Syka', '#008CFF'], ['Lavanda', '#A78BFA'], ['Rosa', '#EF83B5'],
  ['Coral', '#F58B70'], ['Ámbar', '#E4B85C'], ['Menta', '#68C6AC'], ['Perla', '#D5D9E0'],
];
type EyeDropperConstructor = new () => { open(options?: { signal: AbortSignal }): Promise<{ sRGBHex: string }> };

/** Solid implementation of the Fluid Functionalism picker interaction.
 * Original implementation; see docs/PERSONALIZATION_2026-10-05.md for provenance. */
export function ColorPicker(props: { value: string; onChange(value: string): void; onValidityChange(valid: boolean): void }) {
  const id = createUniqueId();
  const [hsv, setHsv] = createSignal(colord(props.value).toHsv());
  const [format, setFormat] = createSignal<ColorFormat>('HEX');
  const [text, setText] = createSignal('');
  const [error, setError] = createSignal('');
  const [status, setStatus] = createSignal('');
  let emitted = '', lastFormat: ColorFormat | undefined, plane!: HTMLDivElement;
  const eyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
  const abort = new AbortController();
  onCleanup(() => abort.abort());
  createEffect(() => {
    const value = props.value, mode = format();
    if (value !== emitted || mode !== lastFormat) {
      if (value !== emitted) setHsv(colord(value).toHsv());
      setText(formatColor(value, mode)); setError(''); props.onValidityChange(true);
    }
    lastFormat = mode;
  });
  function change(next: { h: number; s: number; v: number; a: number }) {
    setHsv(next); emitted = colord(next).toHex().toUpperCase();
    setText(formatColor(emitted, format())); setError(''); props.onValidityChange(true); props.onChange(emitted);
  }
  function point(event: PointerEvent) {
    const rect = plane.getBoundingClientRect();
    change({ ...hsv(), s: clamp((event.clientX - rect.left) / rect.width) * 100, v: (1 - clamp((event.clientY - rect.top) / rect.height)) * 100 });
  }
  function edit(value: string) {
    setText(value); const parsed = parseColor(value);
    setError(parsed ? '' : 'Ingresá un color válido en HEX, RGB, HSL u OKLCH.'); props.onValidityChange(!!parsed);
    if (parsed) { setHsv(colord(parsed).toHsv()); emitted = parsed; props.onChange(parsed); }
  }
  function choose(value: string) {
    setHsv(colord(value).toHsv()); emitted = value;
    setText(formatColor(value, format())); setError(''); props.onValidityChange(true); props.onChange(value);
  }
  async function pick() {
    if (!eyeDropper) return;
    try { const result = await new eyeDropper().open({ signal: abort.signal }); const value = parseColor(result.sRGBHex); if (value) choose(value); }
    catch (e) { if ((e as Error).name !== 'AbortError') setStatus('No se pudo tomar el color de pantalla.'); }
  }
  return <div class="syka-color-picker">
    <div ref={plane} class="syka-color-plane" role="group" tabindex="0"
      aria-label="Saturación y brillo" aria-describedby={`${id}-keys`}
      style={{ 'background-color': `hsl(${hsv().h} 100% 50%)` }}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); plane.focus(); plane.setPointerCapture(e.pointerId); point(e); }}
      onPointerMove={e => { if (plane.hasPointerCapture(e.pointerId)) point(e); }}
      onPointerUp={e => { if (plane.hasPointerCapture(e.pointerId)) plane.releasePointerCapture(e.pointerId); }}
      onKeyDown={e => {
        const step = e.shiftKey ? 10 : 1, current = hsv();
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); change({ ...current, s: clamp(current.s + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), 0, 100), v: clamp(current.v + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0), 0, 100) });
      }}>
      <span class="syka-color-cursor" style={{ left: `${hsv().s}%`, top: `${100 - hsv().v}%`, background: colord(hsv()).alpha(1).toHex() }} />
    </div>
    <span class="sr-only" id={`${id}-keys`}>Flechas izquierda y derecha: saturación. Arriba y abajo: brillo. Shift: pasos de diez.</span>
    <label class="sr-only">Saturación<input type="range" min="0" max="100" value={hsv().s} onInput={e => change({ ...hsv(), s: +e.currentTarget.value })} /></label>
    <label class="sr-only">Brillo<input type="range" min="0" max="100" value={hsv().v} onInput={e => change({ ...hsv(), v: +e.currentTarget.value })} /></label>
    <input class="syka-color-rail syka-color-hue" type="range" aria-label="Tono" min="0" max="360" step="1" value={hsv().h} onInput={e => change({ ...hsv(), h: +e.currentTarget.value })} />
    <div class="syka-color-alpha"><input class="syka-color-rail" type="range" aria-label="Opacidad" min="0" max="100" value={Math.round(hsv().a * 100)}
      style={{ background: `linear-gradient(to right, transparent, ${colord(hsv()).alpha(1).toHex()})` }} onInput={e => change({ ...hsv(), a: +e.currentTarget.value / 100 })} /></div>
    <div class="syka-color-toolbar">
      <div class="syka-color-formats" role="group" aria-label="Formato de color"><For each={['HEX', 'RGB', 'HSL', 'OKLCH'] as ColorFormat[]}>{mode => <button type="button" aria-pressed={format() === mode} onClick={() => setFormat(mode)}>{mode}</button>}</For></div>
      <Show when={eyeDropper}><Button variant="ghost" size="icon-square" aria-label="Tomar color de pantalla" onClick={pick}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5 5 5M4 16l10-10 4 4L8 20H4v-4ZM14 6l3-3a2.1 2.1 0 0 1 3 3l-3 3" /></svg></Button></Show>
    </div>
    <div class="syka-color-value-row">
      <input aria-label="Valor del color" class="syka-color-value" value={text()} spellcheck={false} maxlength="100" aria-invalid={!!error()} aria-describedby={error() ? `${id}-error` : undefined} onInput={e => edit(e.currentTarget.value)} />
      <Button variant="ghost" size="icon-square" aria-label="Copiar color" onClick={async () => { try { await navigator.clipboard.writeText(formatColor(props.value, format())); setStatus('Color copiado.'); } catch { setStatus('No se pudo copiar. Podés seleccionar el valor manualmente.'); } }}><Icon name="timeline-copy" /></Button>
    </div>
    <Show when={error()}><p id={`${id}-error`} role="alert" class="syka-color-error">{error()}</p></Show>
    <div class="syka-color-swatches" role="group" aria-label="Colores sugeridos"><For each={ACCENT_PRESETS}>{([name, color]) => <button type="button" aria-label={name} title={name} aria-pressed={props.value === color} style={{ background: color }} onClick={() => choose(color)} />}</For></div>
    <p class="syka-color-hint">Opacidad {Math.round(hsv().a * 100)}% · Se combina con el fondo de la interfaz.</p>
    <span class="syka-color-hint" role="status">{status()}</span>
  </div>;
}
