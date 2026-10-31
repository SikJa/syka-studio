import { For, Match, Switch } from 'solid-js';
import type { WhatsNewPageId } from './whats-new-pages';

const PATHS = {
  check: 'M4 10.5 8 14.5 16 6',
  cross: 'M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5',
  play: 'M7 5v10l8-5z',
  music: 'M8 14.5V5l8-1.5v9M8 14.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm8-2a2 2 0 1 1-2-2 2 2 0 0 1 2 2Z',
  chat: 'M4 5.5h12v7H9l-4 3v-3H4z',
  fullscreen: 'M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4',
  inspect: 'M5 4l10 4.5-4.2 1.4L9.4 14z',
  camera: 'M4 7h3l1.5-2h3L13 7h3v8H4zM10 13.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
} as const;

function Glyph(props: { name: keyof typeof PATHS }) {
  return <svg class="syka-wn-i" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={PATHS[props.name]} /></svg>;
}

function GateArt() {
  const rows = [
    { label: 'Cuadros vacíos', ok: true },
    { label: 'Imagen congelada', ok: true },
    { label: 'Texto cortado', ok: true },
    { label: 'Texto tapado a los 6 s', ok: false },
  ];
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>gate</span><span class="syka-wn-row-meta">60 cuadros</span></div>
    <For each={rows}>{row => <div class="syka-wn-row" data-tone={row.ok ? undefined : 'error'}><Glyph name={row.ok ? 'check' : 'cross'} />{row.label}</div>}</For>
  </div>;
}

function MusicArt() {
  const tracks = [{ title: 'Infinity', meta: '2:31 · electrónica', picked: true }, { title: 'Deep Urban', meta: '2:08 · calma' }, { title: 'Tech House', meta: '1:56 · 120 BPM' }];
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>Mixkit</span><span class="syka-wn-row-meta">licencia anotada</span></div>
    <For each={tracks}>{track => <div class="syka-wn-row" data-picked={track.picked ? '' : undefined}><Glyph name={track.picked ? 'check' : 'music'} />{track.title}<span class="syka-wn-row-meta">{track.meta}</span></div>}</For>
  </div>;
}

function CameraArt() {
  return <div class="syka-wn-frame">
    <div class="syka-wn-frame-ui syka-wn-glass"><span /><span /><span data-target="" /></div>
    <div class="syka-wn-frame-focus" />
  </div>;
}

function ChatsArt() {
  const chats = ['Lanzamiento de Syka', 'Subtítulos del reel', 'Logo animado'];
  return <div class="syka-wn-card syka-wn-glass">
    <For each={chats}>{(title, index) => <div class="syka-wn-row" data-picked={index() === 0 ? '' : undefined}><Glyph name="chat" />{title}<span class="syka-wn-row-meta">{index() === 0 ? '12 ms' : ''}</span></div>}</For>
  </div>;
}

function QuestionsArt() {
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>¿Qué música preferís?</span></div>
    <div class="syka-wn-options"><span data-picked="">Mixkit</span><span>Tu tema</span><span>Sin música</span></div>
  </div>;
}

function DockArt() {
  return <div class="syka-wn-dock-wrap">
    <span class="syka-wn-tip">Pantalla completa <kbd>Ctrl+Enter</kbd></span>
    <div class="syka-wn-dock syka-wn-glass">
      <span><Glyph name="play" /></span><span data-pressed=""><Glyph name="fullscreen" /></span><span><Glyph name="inspect" /></span><span><Glyph name="camera" /></span>
    </div>
  </div>;
}

export function WhatsNewArt(props: { page: WhatsNewPageId }) {
  return <Switch>
    <Match when={props.page === 'gate'}><GateArt /></Match>
    <Match when={props.page === 'music'}><MusicArt /></Match>
    <Match when={props.page === 'camera'}><CameraArt /></Match>
    <Match when={props.page === 'chats'}><ChatsArt /></Match>
    <Match when={props.page === 'questions'}><QuestionsArt /></Match>
    <Match when={props.page === 'dock'}><DockArt /></Match>
  </Switch>;
}
