import { type JSX, Show, For } from 'solid-js';
import { SOCIAL_COLOR_LOGOS } from '@/boardui-react/components/base/social-button/social-color-logos';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/boardui-react/components/base/social-button/social-providers';
import ZernioSvg from '@/assets/providers/zernio.svg';
import CodexSvg from '@/assets/providers/codex.svg';
import ThreadsSvg from '@/assets/providers/threads.svg';

export function ZernioMark(props: { class?: string }) { return <span aria-hidden="true" class={'inline-flex [&_svg]:size-full ' + (props.class ?? 'size-5')}><ZernioSvg /></span>; }
export function CodexMark(props: { class?: string }) { return <span aria-hidden="true" class={'inline-flex [&_svg]:size-full ' + (props.class ?? 'size-7')}><CodexSvg /></span>; }

const youtube = { viewBox: '0 0 256 180', body: '<path fill="#ff0033" d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z"/><path fill="#fff" d="m102.421 128.06 66.328-38.418-66.328-38.418z"/>' };
const labels: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', x: 'X', twitter: 'X', linkedin: 'LinkedIn', threads: 'Threads' };

/** All SVG markup comes from checked-in brand assets, never account data. */
export function PlatformMark(props: { platform: string; class?: string }) {
  const key = () => (props.platform === 'twitter' ? 'x' : props.platform) as SocialProvider;
  const meta = () => SOCIAL_PROVIDERS[key()];
  const logo = () => props.platform === 'youtube' ? youtube : SOCIAL_COLOR_LOGOS[key()];
  return <span class={props.class ?? 'syka-platform-mark'} data-platform={props.platform} title={labels[props.platform] ?? props.platform}>
    <Show when={props.platform !== 'threads'} fallback={<span aria-label="Threads" role="img" class="size-4 fill-current [&_svg]:size-full"><ThreadsSvg /></span>}>
      <Show when={logo() || meta()} fallback={<span aria-label={props.platform}>{props.platform.slice(0, 1).toUpperCase()}</span>}>
        <Show when={logo()} fallback={<svg role="img" aria-label={labels[props.platform] ?? props.platform} viewBox={meta()?.viewBox} class="size-4"><path fill={meta()?.brand ?? 'currentColor'} d={meta()?.path} /></svg>}>
          {brand => <svg role="img" aria-label={labels[props.platform] ?? props.platform} viewBox={brand().viewBox} class="size-4" classList={{ 'syka-invert-brand': ['x', 'twitter', 'github', 'apple'].includes(props.platform) }} innerHTML={brand().body} />}
        </Show>
      </Show>
    </Show>
  </span>;
}

export function SocialPlatformStack(props: { children?: JSX.Element }) {
  return <div class="syka-social-footer">
    <div class="syka-platform-stack" aria-label="Plataformas de Zernio">
      <For each={['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'threads']}>{platform => <PlatformMark platform={platform} />}</For>
    </div>
    <span>{props.children ?? 'Tus cuentas sociales en un solo lugar.'}</span>
  </div>;
}
