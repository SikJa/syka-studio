import { posix, win32 } from 'node:path';

/** Compare directory paths using the host OS, rather than their UI spelling. */
export function sameProjectFolder(first: string, second: string, platform: NodeJS.Platform = process.platform): boolean {
  const key = platform === 'win32'
    ? (path: string) => win32.resolve(path).toLowerCase()
    : (path: string) => posix.resolve(path);
  return key(first) === key(second);
}
