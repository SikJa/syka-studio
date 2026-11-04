import { For, Match, Switch } from 'solid-js';
import type { WhatsNewPageId } from './whats-new-pages';

const PATHS = {
  check: 'M4 10.5 8 14.5 16 6',
  cross: 'M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5',
  play: 'M7 5v10l8-5z',
  music: 'M8 14.5V5l8-1.5v9M8 14.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm8-2a2 2 0 1 1-2-2 2 2 0 0 1 2 2Z',
  chat: 'M4 5.5h12v7H9l-4 3v-3H4z',
  camera: 'M4 7h3l1.5-2h3L13 7h3v8H4zM10 13.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
} as const;

function Glyph(props: { name: keyof typeof PATHS }) {
  return <svg class="syka-wn-i" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={PATHS[props.name]} /></svg>;
}

function RecipesArt() {
  const recipes = [{ title: 'Lanzamiento', meta: '16:9 · 15–40 s' }, { title: 'YouTube', meta: 'desde la grabación' }, { title: 'Vertical', meta: '9:16 · zona segura' }];
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>Recetas</span><span class="syka-wn-row-meta">de fábrica</span></div>
    <For each={recipes}>{(recipe, index) => <div class="syka-wn-row" data-picked={index() === 1 ? '' : undefined}><Glyph name={index() === 1 ? 'check' : 'play'} />{recipe.title}<span class="syka-wn-row-meta">{recipe.meta}</span></div>}</For>
  </div>;
}

function PlanArt() {
  const phases = [{ label: 'Brief', done: true }, { label: 'Material', done: true }, { label: 'Escenas', done: true }, { label: 'Gate sobre la versión final', done: false }];
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>00 Plan</span><span class="syka-wn-row-meta">construir</span></div>
    <For each={phases}>{phase => <div class="syka-wn-row" data-picked={phase.done ? undefined : ''}><Glyph name={phase.done ? 'check' : 'play'} />{phase.label}</div>}</For>
  </div>;
}

function OfferArt() {
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>¿Guardamos este video como tu receta?</span></div>
    <div class="syka-wn-row" data-picked=""><Glyph name="check" />Música 2 dB más baja</div>
    <div class="syka-wn-options"><span data-picked="">Crear receta</span><span>Ahora no</span></div>
  </div>;
}

function LiquidArt() {
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>Prueba</span><span class="syka-wn-row-meta">cámara 00:05</span></div>
    <div class="syka-wn-row" data-picked=""><Glyph name="camera" />1–2 días<span class="syka-wn-row-meta">con fuente</span></div>
    <div class="syka-wn-row"><Glyph name="check" />La cara queda libre</div>
  </div>;
}

function SteerArt() {
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>Claude está trabajando</span></div>
    <div class="syka-wn-row" data-picked=""><Glyph name="chat" />Mejor el logo al final<span class="syka-wn-row-meta">mismo turno</span></div>
  </div>;
}

function SkillsArt() {
  const skills = [{ title: 'Mis subtítulos serif', meta: 'mi skill' }, { title: 'Cámara fluida', meta: 'mi skill' }, { title: 'Liquid Glass', meta: 'base Syka' }];
  return <div class="syka-wn-card syka-wn-glass">
    <div class="syka-wn-card-head"><span>Skills y flujos</span><span class="syka-wn-row-meta">4 skills</span></div>
    <For each={skills}>{skill => <div class="syka-wn-row"><Glyph name="check" />{skill.title}<span class="syka-wn-row-meta">{skill.meta}</span></div>}</For>
  </div>;
}

export function WhatsNewArt(props: { page: WhatsNewPageId }) {
  return <Switch>
    <Match when={props.page === 'recipes'}><RecipesArt /></Match>
    <Match when={props.page === 'plan'}><PlanArt /></Match>
    <Match when={props.page === 'offer'}><OfferArt /></Match>
    <Match when={props.page === 'liquid'}><LiquidArt /></Match>
    <Match when={props.page === 'steer'}><SteerArt /></Match>
    <Match when={props.page === 'skills'}><SkillsArt /></Match>
  </Switch>;
}
