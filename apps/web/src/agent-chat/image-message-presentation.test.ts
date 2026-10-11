import { describe, expect, it } from 'vitest';
import type { Item } from '@diffusionstudio/agent-chat';
import { imagePathsForMessage, withoutDuplicateImageLinks } from './image-message-presentation';

const path = '03 Assets reutilizables/Generados/Codex/codex-9df30299-bbcf-4347-8091-093d55fa76cc.png';
const absolutePath = `D:/Proyecto de prueba/${path}`;
const image = (id: string, source = absolutePath): Item => ({
  id, kind: 'tool', name: 'imageGeneration', title: 'Imagen', status: 'done',
  output: JSON.stringify({ provider: 'Codex subscription', path, absolutePath: source, bytes: 1024 }),
});

describe('generated image message presentation', () => {
  it('collects native images from the same user turn, including a later completed tool', () => {
    const items: Item[] = [
      { id: 'u1', kind: 'user', text: 'Primera imagen' }, image('old', 'D:/Anterior/old.png'),
      { id: 'u2', kind: 'user', text: 'Nueva imagen' },
      { id: 'progress', kind: 'assistant', phase: 'commentary', text: 'Preparando' }, image('new'),
      { id: 'final', kind: 'assistant', phase: 'final', text: 'Lista' },
      { id: 'u3', kind: 'user', text: 'Otra imagen' }, image('next', 'D:/Siguiente/next.png'),
    ];
    expect(imagePathsForMessage(items, 'progress')).toEqual([absolutePath]);
    expect(imagePathsForMessage(items, 'final')).toEqual([absolutePath]);
    expect(imagePathsForMessage(items, 'missing')).toEqual([]);
  });

  it('excludes failed generation and model or browser output from duplicate suppression', () => {
    const items: Item[] = [
      { id: 'u', kind: 'user', text: 'Una imagen' },
      { ...image('failed'), status: 'failed' } as Item,
      { ...image('browser'), name: 'syka_browser_screenshot' } as Item,
      { id: 'a', kind: 'assistant', text: JSON.stringify({ absolutePath }) },
    ];
    expect(imagePathsForMessage(items, 'a')).toEqual([]);
  });

  it('removes only the matching duplicate download and inline image, preserving the original message', () => {
    const original = `Listo: portada guardada.\n[Descargar portada](<${absolutePath}>)\n![Portada](<${absolutePath}>)`;
    expect(withoutDuplicateImageLinks(original, [absolutePath])).toBe('Listo: portada guardada.\n\n');
    expect(original).toContain('[Descargar portada]');
  });

  it('preserves other downloads and ordinary links to the same image', () => {
    const original = `[Ver archivo](<${absolutePath}>)\n[Descargar informe](D:/Proyecto/informe.pdf)\n[Descargar otra portada](D:/Proyecto/otra.png)`;
    expect(withoutDuplicateImageLinks(original, [absolutePath])).toBe(original);
    expect(withoutDuplicateImageLinks(original, [])).toBe(original);
  });

  it('matches Windows case and separators, without matching a different file', () => {
    const target = absolutePath.toUpperCase().replaceAll('/', '\\');
    expect(withoutDuplicateImageLinks(`[Download](<${target}>)`, [absolutePath])).toBe('');
    expect(withoutDuplicateImageLinks(`[Download](<${target}.bak>)`, [absolutePath])).toContain('[Download]');
  });
});
