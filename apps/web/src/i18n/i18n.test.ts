import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, createComputed } from 'solid-js';
import { translations } from './translations';
import { sourcePhrases } from './source-phrases';

// Node resolves Solid's server export by default. Use its actual browser signal
// implementation so changing the preference must notify real reactive owners.
vi.mock('solid-js', async () => vi.importActual<typeof import('solid-js')>('solid-js/dist/solid.js'));

const languageKey = 'syka.settings.language.v1';
let storage: Map<string, string>;
let html: { lang: string };
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  html = { lang: '' };
  setItem = vi.fn((key: string, value: string) => storage.set(key, String(value)));
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem });
  vi.stubGlobal('navigator', { language: 'es-AR' });
  vi.stubGlobal('document', { documentElement: html });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('interface locale preference', () => {
  it('normalizes supported locale families and defaults unsupported or invalid values to Spanish', async () => {
    const { parseLocale } = await import('./index');
    for (const input of ['en', 'en-US', 'en-GB']) expect(parseLocale(input)).toBe('en');
    for (const input of ['pt', 'pt-BR', 'pt-PT']) expect(parseLocale(input)).toBe('pt-BR');
    for (const input of ['es', 'es-AR', 'fr-FR', '', null, undefined, 1, {}]) expect(parseLocale(input)).toBe('es');
  });

  it('uses the browser locale initially and sets the HTML language', async () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    const i18n = await import('./index');
    expect(i18n.locale()).toBe('pt-BR');
    expect(html.lang).toBe('pt-BR');
    expect(i18n.t('Guardar')).toBe('Salvar');
  });

  it('keeps a saved preference ahead of the browser locale', async () => {
    storage.set(languageKey, 'en');
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    const i18n = await import('./index');
    expect(i18n.locale()).toBe('en');
    expect(html.lang).toBe('en');
    expect(i18n.t('Guardar')).toBe('Save');
  });

  it('persists a new locale, updates the DOM and leaves unrelated project storage intact', async () => {
    storage.set('project.name', 'Copy');
    storage.set('chat.message', 'Guardar');
    const i18n = await import('./index');
    i18n.setLocale('en');
    expect(storage.get(languageKey)).toBe('en');
    expect(html.lang).toBe('en');
    expect(i18n.locale()).toBe('en');
    expect(i18n.t('Guardar')).toBe('Save');
    expect(storage.get('project.name')).toBe('Copy');
    expect(storage.get('chat.message')).toBe('Guardar');
    expect(setItem).toHaveBeenCalledOnce();
  });

  it('notifies Solid reactive readers when switching among all three locales', async () => {
    const i18n = await import('./index');
    const seen: string[] = [];
    createRoot(dispose => {
      createComputed(() => { seen.push(i18n.t('Guardar')); });
      i18n.setLocale('en');
      i18n.setLocale('pt-BR');
      i18n.setLocale('es');
      expect(seen).toEqual(['Guardar', 'Save', 'Salvar', 'Guardar']);
      dispose();
    });
  });

  it('still changes the visible locale if storage cannot persist a preference', async () => {
    const i18n = await import('./index');
    setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => i18n.setLocale('en')).not.toThrow();
    expect(i18n.locale()).toBe('en');
    expect(html.lang).toBe('en');
    expect(i18n.t('Guardar')).toBe('Save');
  });

  it('imports without browser globals and falls back to Spanish', async () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('document', undefined);
    const i18n = await import('./index');
    expect(i18n.locale()).toBe('es');
    expect(i18n.t('Guardar')).toBe('Guardar');
  });
});

describe('UI text lookup and source coverage', () => {
  it('contains three nonempty strings for every phrase extracted from the authored UI', () => {
    const included = new Set(translations.flatMap(row => [...row]));
    expect(sourcePhrases).toHaveLength(2125);
    expect(sourcePhrases.filter(phrase => !included.has(phrase))).toEqual([]);
    expect(sourcePhrases.filter((phrase, index) => !translations[index]?.includes(phrase))).toEqual([]);
    expect(translations.filter(row => row.length !== 3 || row.some(value => typeof value !== 'string' || !value.trim()))).toEqual([]);
  });

  it('preserves nonstring values by identity and performs no replacement inside arbitrary content', async () => {
    const i18n = await import('./index');
    i18n.setLocale('en');
    const project = { title: 'Guardar', messages: ['Copy'], media: [{ title: 'Copy' }] };
    expect(i18n.t(project)).toBe(project);
    expect(i18n.t(17)).toBe(17);
    expect(i18n.t(null)).toBe(null);
    for (const text of ['Guardar el nombre personal', 'https://example.test/Guardar', 'file:///Copy.mp4', "console.log('Guardar')", '{"title":"Copy"}']) expect(i18n.t(text)).toBe(text);
    expect(project.title).toBe('Guardar');
    expect(project.messages).toEqual(['Copy']);
    expect(project.media[0].title).toBe('Copy');
  });

  it('preserves surrounding whitespace for known UI phrases', async () => {
    const i18n = await import('./index');
    i18n.setLocale('en');
    expect(i18n.t(' \tGuardar\n ')).toBe(' \tSave\n ');
    i18n.setLocale('pt-BR');
    expect(i18n.t('\nGuardar  ')).toBe('\nSalvar  ');
  });

  it('keeps the Delete action separate from the keyboard key in all locales', async () => {
    const i18n = await import('./index');
    for (const [locale, action, key] of [
      ['es', 'Delete', 'Supr'], ['en', 'Delete', 'Del'], ['pt-BR', 'Excluir', 'Delete'],
    ] as const) {
      i18n.setLocale(locale);
      expect(i18n.t('Delete')).toBe(action);
      expect(i18n.t('Supr')).toBe(key);
    }
  });

  it('translates UI labels passed into the React composer without changing draft data', async () => {
    const i18n = await import('./index');
    const draft = { value: 'Mensaje al editor', command: 'Buscá en la web referencias para Mensaje al editor' };
    for (const [locale, label, placeholder, effort, next, review, send, homePlaceholder] of [
      ['en', 'Message to the editor', 'What would you like to change in this video?', 'No effort', 'Next question', 'Add to review', 'Send message', 'Use my references and brand to create animated cards with a consistent style.'],
      ['pt-BR', 'Mensagem para o editor', 'O que você quer mudar neste vídeo?', 'Sem esforço', 'Próxima pergunta', 'Adicionar à revisão', 'Enviar mensagem', 'Use minhas referências e minha marca para criar cartões animados com um estilo consistente.'],
    ] as const) {
      i18n.setLocale(locale);
      expect(i18n.t('Mensaje al editor')).toBe(label);
      expect(i18n.t('¿Qué querés cambiar en este video?')).toBe(placeholder);
      expect(i18n.t('Sin esfuerzo')).toBe(effort);
      expect(i18n.t('Siguiente pregunta')).toBe(next);
      expect(i18n.t('Añadir a revisión')).toBe(review);
      expect(i18n.t('Enviar mensaje')).toBe(send);
      expect(i18n.t('Usá mis referencias y mi marca para crear tarjetas animadas con un estilo consistente.')).toBe(homePlaceholder);
      expect(i18n.t(draft)).toBe(draft);
      expect(draft).toEqual({ value: 'Mensaje al editor', command: 'Buscá en la web referencias para Mensaje al editor' });
    }
  });

  it('preserves every authored UI phrase and existing product term verbatim in Spanish', async () => {
    const i18n = await import('./index');
    i18n.setLocale('es');
    for (const phrase of [...sourcePhrases, 'Assets', 'Snapping', 'Syka Studio', 'Exportar', 'Deshacer']) {
      expect(i18n.t(phrase)).toBe(phrase);
    }
  });
});
