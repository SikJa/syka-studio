import { AssetLibrary } from '@diffusionstudio/assets';
import type { ProjectFS } from '@diffusionstudio/assets';

/** Explicit demonstration copy/timings, used only by disposable preview worlds. */
export function captionPreviewLibrary(): AssetLibrary {
  const words = [
    { text: 'Tu', start: 0, end: .38 },
    { text: 'voz.', start: .38, end: .9 },
    { text: 'Con', start: 1.2, end: 1.8 },
    { text: 'estilo.', start: 1.8, end: 2.8 },
  ];
  const file = new File([JSON.stringify([{ text: 'Tu voz. Con estilo.', words }])], 'sample.json', { type: 'application/json' });
  const fs: ProjectFS = {
    readManifest: async () => null, writeManifest: async () => {}, list: async () => [],
    stat: async source => source === 'sample.json' ? { size: file.size, mtime: 0 } : null,
    file: async source => { if (source !== 'sample.json') throw Error('Unknown preview asset'); return file; },
    write: async () => {}, remove: async () => {},
  };
  const library = new AssetLibrary(fs);
  void library.load();
  return library;
}
