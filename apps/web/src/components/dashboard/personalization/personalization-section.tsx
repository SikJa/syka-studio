import { createSignal, onCleanup, Show } from 'solid-js';
import { Popover as Primitive } from '@kobalte/core/popover';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Popover, PopoverTrigger, PopoverPortal, PopoverContent } from '@/components/ui/popover';
import { accent, appearanceSaved, previewAccent, saveAccent } from '@/lib/appearance/controller';
import { DEFAULT_ACCENT } from '@/lib/appearance/color';
import { ColorPicker } from './color-picker';
import './personalization.css';

export function PersonalizationSection() {
  const [open, setOpen] = createSignal(false);
  const [valid, setValid] = createSignal(true);
  const [selected, setSelected] = createSignal(true);
  let previous = accent(), applied = false;
  function toggle(next: boolean) {
    if (next) { previous = accent(); applied = false; setValid(true); }
    else if (!applied) previewAccent(previous);
    setOpen(next);
  }
  onCleanup(() => { if (open() && !applied) previewAccent(previous); });
  return <section class="syka-personalization" aria-labelledby="syka-personalization-title">
    <h2 id="syka-personalization-title">Personalización</h2>
    <div class="syka-personalization-card">
      <div class="syka-personalization-row">
        <div><h3>Color de acento</h3><p>Un toque tuyo en botones, selecciones y controles.</p></div>
        <Popover modal open={open()} onOpenChange={toggle} placement="bottom-end" gutter={8} flip slide overlap fitViewport overflowPadding={12}>
          <PopoverTrigger class="syka-accent-trigger" aria-label="Elegir color de acento">
            <span class="syka-accent-tile" style={{ background: accent() }} /><span>{accent()}</span><Icon name="chevron-down" />
          </PopoverTrigger>
          <PopoverPortal><PopoverContent class="syka-color-popover">
            <Primitive.Title class="syka-color-title">Color de acento</Primitive.Title>
            <Primitive.Description class="syka-color-hint">Probalo en vivo. Aplicá para guardarlo.</Primitive.Description>
            <ColorPicker value={accent()} onChange={previewAccent} onValidityChange={setValid} />
            <div class="syka-color-footer"><Button variant="secondary" onClick={() => toggle(false)}>Cancelar</Button><Button disabled={!valid()} onClick={() => { saveAccent(accent()); applied = true; toggle(false); }}>Aplicar color</Button></div>
          </PopoverContent></PopoverPortal>
        </Popover>
      </div>
      <div class="syka-personalization-preview" aria-label="Vista previa de controles">
        <span class="syka-color-hint">Así se ve</span>
        <Button onClick={() => setSelected(!selected())}>Botón principal</Button>
        <Button variant={selected() ? 'on' : 'secondary'} aria-pressed={selected()} onClick={() => setSelected(!selected())}><Icon name="confirm-check" />Selección</Button>
        <input aria-label="Probar foco" placeholder="Probá el foco acá" />
      </div>
      <div class="syka-personalization-row syka-personalization-bottom"><p>Sólo cambia la interfaz. Tu marca y tus videos conservan sus colores.</p><Button variant="link" onClick={() => saveAccent(DEFAULT_ACCENT)} disabled={accent() === DEFAULT_ACCENT}>Restaurar azul original</Button></div>
      <Show when={!appearanceSaved()}><p role="status" class="syka-color-error">El color está aplicado por esta sesión. No se pudo guardar en este dispositivo.</p></Show>
    </div>
  </section>;
}
