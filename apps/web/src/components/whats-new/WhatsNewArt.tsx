import { For, Match, Switch, type JSX } from 'solid-js';
import { Icon } from './whats-new-icon';
import { useWhatsNewMessages } from './whats-new-messages';
import type { WhatsNewPageId } from './whats-new-pages';

// Kevin's drawings from Syka Legacy, with Syka Studio's content. Each keeps the
// original markup and classes so whats-new.css animates it unchanged.

type Translate = ReturnType<typeof useWhatsNewMessages>;

const MARK_STROKE = 'M364 146H229c-62 0-95 27-95 71 0 41 33 61 94 69l56 8c24 3 35 11 35 25 0 17-15 27-46 27H148';
const MARK_OUT_ARROW = 'm338 109 36 37-36 37';
const MARK_IN_ARROW = 'M174 309l-36 37 36 37';

function cssVars(vars: Record<string, string | number>): JSX.CSSProperties {
  return Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, String(value)]));
}

function ArtIcon(props: { name: string }) {
  return <Icon name={props.name} class="syka-wn-i" aria-hidden="true" />;
}

/** The three ways to caption 50 s of video, Syka Code's accounts drawing; the recommended one on top. */
function ParakeetArt(props: { t: Translate }) {
  const rows = () => [
    { name: props.t('art.parakeetGpu'), meta: `1,1 s · ${props.t('art.onPc')}`, top: true },
    { name: props.t('art.groq'), meta: `0,7 s · ${props.t('art.cloud')}`, top: false },
    { name: props.t('art.parakeetCpu'), meta: `5 s · ${props.t('art.onPc')}`, top: false },
  ];
  return <div class="syka-wn-accounts syka-wn-glass">
    <For each={rows()}>{(row, index) =>
      <div class="syka-wn-account" data-top={row.top ? '' : undefined} style={cssVars({ '--i': index() })}>
        <ArtIcon name={row.name === props.t('art.groq') ? 'AudioLines' : 'Captions'} />
        <span class="syka-wn-account-avatar">{row.name.slice(0, 1)}</span>
        <span class="syka-wn-account-name"><b>{row.name}</b><small>{row.meta}</small></span>
        {row.top ? <span class="syka-wn-account-chip">{props.t('art.recommended')}</span> : null}
      </div>}
    </For>
  </div>;
}

/** Kevin's activity drawing as a quick requirements check: ideal, fine and slow. */
function PcArt(props: { t: Translate }) {
  return <div class="syka-wn-activity syka-wn-glass">
    <div class="syka-wn-row"><ArtIcon name="Gauge" /><span>{props.t('art.pcIdeal')}</span></div>
    <div class="syka-wn-row"><ArtIcon name="Cpu" /><span>{props.t('art.pcGood')}</span></div>
    <div class="syka-wn-row" data-tone="error"><ArtIcon name="CircleX" /><span>{props.t('art.pcSlow')}</span></div>
    <div class="syka-wn-row" data-tone="quiet"><ArtIcon name="Check" /><span>{props.t('art.pcDefault')}</span></div>
  </div>;
}

/** Settings drawn as Kevin's glass panel: a slider and two switches. */
function SettingsArt(props: { t: Translate }) {
  return <div class="syka-wn-look">
    <div class="syka-wn-panel syka-wn-glass">
      <div class="syka-wn-row"><ArtIcon name="Settings" /><span>{props.t('art.scale')}</span><span class="syka-wn-slider"><span /></span></div>
      <div class="syka-wn-row"><ArtIcon name="Laptop" /><span>{props.t('art.tray')}</span><span class="syka-wn-switch" /></div>
      <div class="syka-wn-row"><ArtIcon name="Bell" /><span>{props.t('art.notices')}</span><span class="syka-wn-switch" /></div>
    </div>
  </div>;
}

/** The update advancing: download, verified fingerprint, restart on your word. */
function UpdateArt(props: { t: Translate }) {
  return <div class="syka-wn-activity syka-wn-glass">
    <div class="syka-wn-plan">
      <div class="syka-wn-row"><ArtIcon name="Download" /><span class="syka-wn-shine">{props.t('art.downloading')}</span></div>
      <span class="syka-wn-progress"><span /></span>
    </div>
    <div class="syka-wn-row"><ArtIcon name="SecurityCheck" /><span>{props.t('art.fingerprint')}</span></div>
    <div class="syka-wn-row" data-tone="quiet"><ArtIcon name="RefreshCw" /><span>{props.t('art.restartWhenever')}</span></div>
  </div>;
}

/** Kevin's brand card: the Syka mark drawing itself above a small catalog. */
export function BrandArt(props: { t: Translate; head: string; action: string; rows: readonly { icon: string; title: string; body: string }[] }) {
  return <div class="syka-wn-brand">
    <div class="syka-wn-mark">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="96 94 304 304" fill="none" aria-hidden="true">
        <path class="syka-wn-mark-stroke" d={MARK_STROKE} pathLength={1} stroke="currentColor" stroke-width={46} stroke-linecap="round" />
        <For each={[MARK_OUT_ARROW, MARK_IN_ARROW]}>{path =>
          <path class="syka-wn-mark-arrow" d={path} stroke="currentColor" stroke-width={20} stroke-linecap="round" stroke-linejoin="round" />}
        </For>
      </svg>
      <span>Syka</span>
    </div>
    <div class="syka-wn-catalog syka-wn-glass">
      <div class="syka-wn-catalog-head">
        <span>{props.head}</span>
        <span class="syka-wn-fused">
          <span><ArtIcon name="MessageCirclePlus" />{props.action}</span>
          <i />
          <span><ArtIcon name="ChevronDown" /></span>
        </span>
      </div>
      <For each={props.rows}>{row =>
        <div class="syka-wn-ext">
          <span class="syka-wn-ext-icon"><ArtIcon name={row.icon} /></span>
          <span class="syka-wn-ext-text"><strong>{row.title}</strong><small>{row.body}</small></span>
          <span class="syka-wn-switch" />
        </div>}
      </For>
    </div>
  </div>;
}

export function WhatsNewArt(props: { page: WhatsNewPageId }) {
  const t = useWhatsNewMessages();
  return <Switch>
    <Match when={props.page === 'parakeet'}><ParakeetArt t={t} /></Match>
    <Match when={props.page === 'pc'}><PcArt t={t} /></Match>
    <Match when={props.page === 'voice'}>
      <BrandArt t={t} head={t('art.transcription')} action={t('art.addService')} rows={[
        { icon: 'AudioLines', title: t('art.openai'), body: t('art.openaiBody') },
        { icon: 'Sparkles', title: t('art.compatible'), body: t('art.compatibleBody') },
        { icon: 'Mic', title: t('art.codex'), body: t('art.codexBody') },
      ]} />
    </Match>
    <Match when={props.page === 'settings'}><SettingsArt t={t} /></Match>
    <Match when={props.page === 'update'}><UpdateArt t={t} /></Match>
  </Switch>;
}
