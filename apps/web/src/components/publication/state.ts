import { createSignal, onCleanup, onMount } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { PublicationOverview, PublicationRequest } from '@desktop/publication/types';
import { mainBridge } from '@/lib/ipc';
export function usePublication() {
  const [data, setData] = createSignal<PublicationOverview | null>(null);
  const [loading, setLoading] = createSignal(true), [busy, setBusy] = createSignal(false), [error, setError] = createSignal('');
  const load = async () => {
    if (!window.desktop) { setLoading(false); return; }
    try { setData(await mainBridge.call(MAIN_CHANNELS.SYKA_PUBLICATION, { action: 'get' })); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer la publicación local.'); }
    finally { setLoading(false); }
  };
  const act = async (request: PublicationRequest, message?: string, options: { quiet?: boolean } = {}) => {
    setBusy(true); setError('');
    try { setData(await mainBridge.call(MAIN_CHANNELS.SYKA_PUBLICATION, request)); if (message) toast.success(message); return true; }
    catch (e) { const text = e instanceof Error ? e.message : 'No se pudo completar la operación.'; setError(text); if (!options.quiet) toast.error(text); await load(); setError(text); return false; }
    finally { setBusy(false); }
  };
  onMount(() => {
    void load();
    const timer = setInterval(() => { if (data()?.connections.some(c => c.pending) || data()?.drafts.some(d => ['uploading', 'submitting_unknown'].includes(d.phase))) void load(); }, 3000);
    onCleanup(() => clearInterval(timer));
  });
  return { data, loading, busy, error, load, act };
}
export function openZernio(url: 'dashboard' | 'keys' | 'docs' | 'pricing') {
  const urls = { dashboard: 'https://zernio.com/dashboard', keys: 'https://zernio.com/dashboard/api-keys', docs: 'https://docs.zernio.com/mcp/setup', pricing: 'https://docs.zernio.com/pricing' };
  if (window.desktop) void mainBridge.call(MAIN_CHANNELS.APP_OPEN_EXTERNAL, { url: urls[url] });
}
