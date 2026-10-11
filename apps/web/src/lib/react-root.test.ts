import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEffect, createRoot as createSolidRoot, onCleanup } from 'solid-js';
import { createElement } from 'react';
import type { Root } from 'react-dom/client';

const client = vi.hoisted(() => ({ createRoot: vi.fn() }));
vi.mock('react-dom/client', () => client);
// Signals must use Solid's browser implementation, as they do in the editor.
vi.mock('solid-js', async () => vi.importActual<typeof import('solid-js')>('solid-js/dist/solid.js'));

beforeEach(() => {
  vi.resetModules();
  client.createRoot.mockReset();
  vi.stubGlobal('localStorage', { getItem: () => 'es', setItem: vi.fn() });
  vi.stubGlobal('document', { documentElement: { lang: '' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('React roots owned by Solid', () => {
  it('renders each locale through the existing root without resetting the component or its draft', async () => {
    const nativeRender = vi.fn();
    const nativeRoot: Root = { render: nativeRender, unmount: vi.fn() };
    client.createRoot.mockReturnValue(nativeRoot);
    const { createRoot } = await import('./react-root');
    const { setLocale } = await import('@/i18n');
    const container = {} as HTMLDivElement;
    const options = { identifierPrefix: 'chat-' };
    const Composer = (_props: { value: string }) => null;
    const draft = 'No cambies este borrador';
    let dispose!: () => void;
    let root!: Root;

    createSolidRoot(cleanup => {
      dispose = cleanup;
      root = createRoot(container, options);
      createEffect(() => root.render(createElement(Composer, { value: draft })));
      onCleanup(() => root.unmount());
    });

    expect(nativeRender).toHaveBeenCalledOnce();
    for (const next of ['en', 'pt-BR', 'es'] as const) setLocale(next);
    expect(root).toBe(nativeRoot);
    expect(client.createRoot).toHaveBeenCalledExactlyOnceWith(container, options);
    expect(nativeRender).toHaveBeenCalledTimes(4);
    for (const [node] of nativeRender.mock.calls) {
      expect(node).toMatchObject({ type: Composer, key: null, props: { value: draft } });
    }
    expect(nativeRoot.unmount).not.toHaveBeenCalled();

    dispose();
    expect(nativeRoot.unmount).toHaveBeenCalledOnce();
    setLocale('en');
    expect(nativeRender).toHaveBeenCalledTimes(4);
  });

  it('delegates render outside a Solid effect without adding a lifecycle or a subscription', async () => {
    const nativeRender = vi.fn(function(this: Root) { expect(this).toBe(nativeRoot); });
    const nativeRoot: Root = { render: nativeRender, unmount: vi.fn() };
    client.createRoot.mockReturnValue(nativeRoot);
    const { createRoot } = await import('./react-root');
    const { setLocale } = await import('@/i18n');
    const root = createRoot({} as HTMLDivElement);
    root.render(null);
    setLocale('en');
    expect(nativeRender).toHaveBeenCalledExactlyOnceWith(null);
    expect(nativeRoot.unmount).not.toHaveBeenCalled();
  });
});
