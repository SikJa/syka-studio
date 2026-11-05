import { createSignal, onCleanup } from 'solid-js';

/** Kevin's card switches to dark through a `.dark` ancestor; Syka Studio marks its theme on `<html data-kb-theme>`. */
export function useDarkTheme() {
  const read = () => document.documentElement.getAttribute('data-kb-theme') === 'dark';
  const [dark, setDark] = createSignal(read());
  const observer = new MutationObserver(() => setDark(read()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kb-theme'] });
  onCleanup(() => observer.disconnect());
  return dark;
}
