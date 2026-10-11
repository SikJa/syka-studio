/** Only project-owned raster images may be previewed automatically. */
export function projectImageSource(target: string, root: string): string | null {
  if (!/\.(png|jpe?g|webp|gif)$/iu.test(target) || /[\0\r\n?#]/u.test(target)) return null;
  const windows = /^[a-z]:[\\/]/iu.test(root);
  const normalize = (value: string) => value.replaceAll('\\', '/').replace(/\/+$/u, '');
  const base = normalize(root), image = normalize(target);
  const parts = image.split('/');
  if (parts.some(part => part === '..' || part === '.' || part.startsWith('.'))) return null;
  if (windows ? !image.toLowerCase().startsWith(base.toLowerCase() + '/') : !image.startsWith(base + '/')) return null;
  return image.slice(base.length + 1);
}

export function localFileTarget(target: string): boolean {
  return /^(?:[a-z]:[\\/]|\/(?!\/))[^\n\r\0]+\.(?:mp4|mov|m4v|webm|mkv|wav|mp3|ogg|png|jpe?g|webp|gif|svg|pdf|md|txt)$/iu.test(target);
}

export type ProjectArtifactKind = 'image' | 'document';
export function projectArtifactKind(target: string): ProjectArtifactKind | null {
  if (/\.(png|jpe?g|webp|gif|svg)$/iu.test(target)) return 'image';
  if (/\.(md|txt)$/iu.test(target)) return 'document';
  return null;
}

/** Lexical containment is checked again against real paths before reading bytes. */
export function projectArtifactSource(target: string, root: string): string | null {
  if (!localFileTarget(target) || !projectArtifactKind(target)) return null;
  const base = root.replaceAll('\\', '/').replace(/\/+$/u, '');
  const value = target.replaceAll('\\', '/');
  if (/[\0\r\n?#]/u.test(value) || value.split('/').some(part => part === '..' || part.startsWith('.'))) return null;
  const matches = /^[a-z]:\//iu.test(base) ? value.toLowerCase().startsWith(base.toLowerCase() + '/') : value.startsWith(base + '/');
  return matches ? value.slice(base.length + 1) : null;
}
