import { For, Show, createSignal, onCleanup } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { AudioEngine, Computed, FrameRate, Playback, Workarea, getActiveEntity, setPlayhead, togglePlayback } from '@diffusionstudio/runtime';
import { useDerived } from '@/engine/hooks';
import { Button } from '@/components/ui/button';
import { PreviewIcon } from './preview-icon';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { previewBounds, previewClock, previewTimecode } from './transport-model';
import { Popover, PopoverTrigger, PopoverContent, PopoverPortal } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import './transport.css';
import { EditorShortcuts } from './editor-shortcuts';

/** Preview preferences never change clip timing, authored volume or exports. */
export function CanvasTransport(props: { fullscreen: boolean; onFullscreen: () => void; portalMount: HTMLElement }) {
  const world = useWorld();
  const [volumeOpen, setVolumeOpen] = createSignal(false);
  let volumeTrigger: HTMLButtonElement | undefined;
  let volumeContent: HTMLDivElement | undefined;
  let volumeCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let volumeOpenedByHover = false;
  const openVolume = () => {
    clearTimeout(volumeCloseTimer);
    if (scene() && !volumeOpen()) { volumeOpenedByHover = true; setVolumeOpen(true); }
  };
  const closeVolume = () => {
    clearTimeout(volumeCloseTimer);
    volumeCloseTimer = setTimeout(() => {
      const focused = document.activeElement;
      if (!(volumeTrigger?.contains(focused) && !volumeOpenedByHover) && !volumeContent?.contains(focused)) setVolumeOpen(false);
    }, 180);
  };
  onCleanup(() => clearTimeout(volumeCloseTimer));
  const scene = useDerived(() => getActiveEntity(world));
  const playing = useDerived(() => scene()?.get(Playback)?.playing ?? false);
  const speed = useDerived(() => scene()?.get(Playback)?.speed ?? 1);
  const loop = useDerived(() => scene()?.get(Playback)?.loop ?? false);
  const muted = useDerived(() => world.get(AudioEngine)?.previewMuted ?? false);
  const volume = useDerived(() => world.get(AudioEngine)?.previewVolume ?? 1);
  const frame = useDerived(() => scene()?.get(Computed)?.localTime ?? 0);
  const duration = useDerived(() => scene()?.get(Computed)?.duration ?? 0);
  const fps = useDerived(() => world.get(FrameRate)?.value ?? 30);
  const seekToFrame = (value: number) => {
    const current=scene(); if(!current)return;
    const bounds=previewBounds(duration(),current.has(Workarea)?current.get(Workarea):undefined);
    current.set(Playback,{playing:false});
    setPlayhead(world,current,Math.min(bounds.last,Math.max(bounds.start,Math.round(value))));
  };
  const scrubBounds = () => previewBounds(duration(),scene()?.has(Workarea)?scene()?.get(Workarea):undefined);
  const seek = (offset: number | 'start' | 'end') => {
    const current = scene();
    if (!current) return;
    const bounds = previewBounds(duration(), current.has(Workarea) ? current.get(Workarea) : undefined);
    current.set(Playback, { playing: false });
    setPlayhead(world, current, offset === 'start' ? bounds.start : offset === 'end' ? bounds.last
      : Math.min(bounds.last, Math.max(bounds.start, frame() + offset)));
  };
  const control = (label: string, icon: string, action: () => void, active = false, className = '') =>
    <Tooltip openDelay={80}><TooltipTrigger as={Button} size="icon-square" variant="ghost" disabled={!scene()} aria-label={label}
      onClick={action} aria-pressed={active} class={className} classList={{ 'syka-preview-active': active }}><PreviewIcon name={icon} /></TooltipTrigger>
      <TooltipContent class="syka-transport-tooltip">{label}</TooltipContent></Tooltip>;

  return <div role="toolbar" aria-label="Reproducción del video" class="syka-canvas-transport">
    <div class="syka-preview-seek">
      <input type="range" aria-label="Buscar un momento del video" aria-valuetext={previewTimecode(frame(),fps())}
        min={scrubBounds().start} max={scrubBounds().last} step="1" value={Math.min(scrubBounds().last,Math.max(scrubBounds().start,frame()))}
        disabled={!scene() || scrubBounds().last === scrubBounds().start}
        onInput={event=>seekToFrame(Number(event.currentTarget.value))}/>
    </div>
    <div class="syka-playback-buttons">
      {control('Ir al inicio · Inicio', 'start', () => seek('start'))}
      {control(playing() ? 'Pausar · Espacio' : 'Reproducir · Espacio', playing() ? 'pause' : 'play', () => {
        const current = scene();
        if (!current) return;
        const requestedSpeed = speed();
        togglePlayback(world, current);
        current.set(Playback, { speed: requestedSpeed });
      }, playing(), 'syka-preview-play')}
      {control('Ir al final · Fin', 'end', () => seek('end'))}
    </div>
    <output class="syka-preview-time" aria-label="Tiempo del video" title={`${previewTimecode(frame(), fps())} / ${previewTimecode(duration(), fps())} · ${fps()} fps`}>
      <span>{previewClock(frame(), fps(), duration())}</span><span class="syka-preview-duration"> / {previewClock(duration(), fps(), duration())}</span>
    </output>
    <DropdownMenu placement="top">
      <DropdownMenuTrigger as={Button} variant="ghost" disabled={!scene()} aria-label="Velocidad de previsualización" title="Velocidad de previsualización" class="syka-preview-speed">
        <span>{speed()}×</span><PreviewIcon name="chevron" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal mount={props.portalMount}><DropdownMenuContent class="syka-speed-menu w-40">
        <DropdownMenuRadioGroup value={String(speed())} onChange={value => { scene()?.set(Playback, { speed: Number(value) }); }}>
          <For each={[0.25, 0.5, 1, 1.5, 2, 4]}>{value => <DropdownMenuRadioItem value={String(value)}>{value}×</DropdownMenuRadioItem>}</For>
        </DropdownMenuRadioGroup>
        <p class="syka-transport-menu-note">Previsualización. Audio a 1×.</p>
      </DropdownMenuContent></DropdownMenuPortal>
    </DropdownMenu>
    {control(loop() ? 'Desactivar bucle' : 'Repetir video', 'loop', () => scene()?.set(Playback, { loop: !loop() }), loop())}
    <Popover placement="top" modal={false} open={volumeOpen()} onOpenChange={open => { if (open) volumeOpenedByHover = false; setVolumeOpen(open); }}>
      <PopoverTrigger ref={volumeTrigger} as={Button} size="icon-square" variant="ghost" aria-label="Volumen de previsualización" disabled={!scene()}
        onPointerEnter={(event: PointerEvent) => { if (event.pointerType !== 'touch') openVolume(); }} onPointerLeave={closeVolume}>
        <PreviewIcon name={muted() || volume() === 0 ? 'muted' : 'volume'} />
      </PopoverTrigger>
      <PopoverPortal mount={props.portalMount}><PopoverContent ref={volumeContent} class="syka-speed-menu syka-preview-volume"
        onPointerEnter={openVolume} onPointerLeave={closeVolume} onFocusOut={closeVolume}
        onOpenAutoFocus={event => { if (volumeOpenedByHover) event.preventDefault(); }}
        onCloseAutoFocus={event => { if (volumeOpenedByHover) event.preventDefault(); }}>
        <div><strong>Volumen</strong><output>{Math.round(volume()*100)}%</output></div>
        <input type="range" min="0" max="100" step="1" value={Math.round(volume()*100)} aria-label="Volumen de previsualización"
          onInput={event => world.set(AudioEngine,{previewVolume:Number(event.currentTarget.value)/100,previewMuted:false})} />
      </PopoverContent></PopoverPortal>
    </Popover>
    <Button size="icon-square" variant="ghost" disabled={!scene()} aria-label={props.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa del video'} title="Pantalla completa · Ctrl + Enter" onClick={props.onFullscreen}>
      <PreviewIcon name={props.fullscreen ? 'collapse' : 'fullscreen'} />
    </Button>
    <Show when={props.fullscreen}><EditorShortcuts fullscreen portalMount={props.portalMount} /></Show>
  </div>;
}

