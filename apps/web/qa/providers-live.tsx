import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { AuthProvider } from '@/context/auth';
import { ProviderSettings } from '@/components/dashboard/provider-settings';
import { chatState } from '@/agent-chat/store';
import '@/index.css';

const listeners = new Map<string, Set<(value: unknown) => void>>();
const liveWindow = window as unknown as { __sykaProviderEndpoint?: string; desktop: unknown };
// The browser uses the same IPC endpoint resolver and real WebSocket store as
// Electron. Only browser-native window opening replaces Electron shell IPC.
liveWindow.desktop = {
  platform: 'win32',
  on(channel: string, listener: (value: unknown) => void) {
    const group = listeners.get(channel) ?? new Set(); group.add(listener); listeners.set(channel, group);
    return () => group.delete(listener);
  },
  send(channel: string, request: { id: string; channel: string; data?: { url?: string } }) {
    if (channel !== 'main:request') return;
    const reply = (data?: unknown, error?: string) => queueMicrotask(() => {
      for (const listener of listeners.get('main:response') ?? []) listener({ id: request.id, ok: !error, data, error });
    });
    if (request.channel === 'agent-chat:endpoint') {
      const path = liveWindow.__sykaProviderEndpoint;
      if (!path?.startsWith('/@fs/')) { reply(undefined, 'La conexión local todavía no está preparada.'); return; }
      void fetch(path + '?t=' + Date.now(), { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw Error('El backend local no está disponible.');
        const endpoint = await response.json();
        const url = new URL(endpoint.url);
        if (endpoint.mode !== 'real' || url.protocol !== 'ws:' || url.hostname !== '127.0.0.1') throw Error('La conexión local no corresponde al backend real.');
        reply({ url: endpoint.url });
      }).catch(error => reply(undefined, error.message));
    } else if (request.channel === 'app:open-external') {
      try {
        const url = new URL(request.data?.url ?? '');
        if (url.protocol !== 'https:') throw Error('Enlace de conexión inválido.');
        window.open(url.href, '_blank', 'noopener,noreferrer');
        reply();
      } catch { reply(undefined, 'No se pudo abrir el enlace de conexión.'); }
    } else reply(undefined, 'Esta vista está dedicada a conectar tus asistentes.');
  },
};

function Connections() {
  return <main style={{ padding: '24px', color: '#eee', background: '#101011', 'min-height': '100vh', 'max-width': '900px', margin: '0 auto' }}>
    <header style={{ 'margin-bottom': '20px' }}>
      <h1 style={{ 'font-size': '20px', 'font-weight': 600 }}>Conectar asistentes</h1>
      <p style={{ 'font-size': '13px', color: '#aaa', 'margin-top': '8px' }}>Elegí un asistente y autorizá tu cuenta en su página oficial.</p>
      <p role="status" data-live-connection={chatState.connection} style={{ 'font-size': '12px', color: '#aaa', 'margin-top': '8px' }}>{chatState.connection === 'open' ? 'Conectado · cuentas y modelos reales' : 'Conectando con Syka…'}</p>
    </header>
    <ProviderSettings />
  </main>;
}
render(() => <AuthProvider><Router><Route path="*all" component={Connections} /></Router></AuthProvider>, document.getElementById('root')!);
