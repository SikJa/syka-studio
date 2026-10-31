import { createSignal, onCleanup, onMount } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { createPreviewCache } from './preview-cache';

export const resourcePreviews = createPreviewCache(async (path: string) => {
  const result = await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES, { action: 'preview', path });
  if (!result.preview) throw new Error('No se pudo cargar la previsualización.');
  return result.preview;
}, 96, 4, value => value.length * 2, 8 * 1024 * 1024);

/** Don't initialize invisible canvases or issue IPC for an entire catalog. */
export function visiblePreview(element: () => Element) {
  const [visible, setVisible] = createSignal(false);
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '120px' });
    observer.observe(element());
    onCleanup(() => observer.disconnect());
  });
  return visible;
}
