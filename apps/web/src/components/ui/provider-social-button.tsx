import { createEffect, onCleanup, onMount } from 'solid-js';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SocialButton } from '@/boardui-react/components/base/social-button/social-button';
import zernioLogo from '@/assets/providers/zernio.svg?url';
import codexLogo from '@/assets/providers/codex.svg?raw';
import './provider-social-button.css';

const codexBody = codexLogo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');

/** BoardUI's custom-brand API, mounted with the same React bridge as the chat. */
export function ProviderSocialButton(props: {
  provider: 'zernio' | 'codex';
  label: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick(): void;
}) {
  let element!: HTMLSpanElement;
  let root: Root | undefined;
  onMount(() => {
    root = createRoot(element);
    createEffect(() => {
      const icon = props.provider === 'zernio'
        ? createElement('img', { src: zernioLogo, alt: '', width: 18, height: 18 })
        : createElement('svg', { viewBox: '96 96 420 420', width: 18, height: 18, 'aria-hidden': true, dangerouslySetInnerHTML: { __html: codexBody } });
      root!.render(createElement(SocialButton, {
        brand: 'custom',
        config: { icon, label: props.provider === 'zernio' ? 'Zernio' : 'Codex' },
        appearance: 'white', size: 'small', fullWidth: props.fullWidth ?? true,
        className: 'syka-social-button', disabled: props.disabled,
        onClick: () => props.onClick(), children: props.label,
      }));
    });
  });
  onCleanup(() => root?.unmount());
  return <span ref={element} class="syka-social-root" />;
}
