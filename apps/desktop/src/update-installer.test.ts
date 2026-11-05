import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { INSTALLER_NAME, installerDownloader } from './update-installer';

const FEED = 'https://github.com/SikJa/syka-studio/releases/download/v1.1.0';
let folder = '';
afterEach(async () => { if (folder) await rm(folder, { recursive: true, force: true }); folder = ''; });

function serve(body: Buffer, sums: string) {
  return (async (url: string | URL) => {
    const name = String(url).slice(FEED.length + 1);
    if (name === 'SHA256SUMS') return new Response(sums);
    if (name === INSTALLER_NAME) return new Response(body, { headers: { 'content-length': String(body.length) } });
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
}

describe('installer updates', () => {
  it('keeps the Setup only when it matches the published SHA-256 and reports progress', async () => {
    folder = await mkdtemp(join(tmpdir(), 'syka-installer-'));
    const body = Buffer.alloc(300_000, 7);
    const sha = createHash('sha256').update(body).digest('hex');
    const fractions: number[] = [];
    const path = await installerDownloader(folder, serve(body, `${sha}  RELEASES\n${sha}  ${INSTALLER_NAME}\n`))(FEED, f => fractions.push(f));
    expect(await readFile(path)).toEqual(body);
    expect(fractions.at(-1)).toBe(1);
  });
  it('refuses a Setup whose hash differs and leaves nothing behind', async () => {
    folder = await mkdtemp(join(tmpdir(), 'syka-installer-'));
    const download = installerDownloader(folder, serve(Buffer.from('tampered'), `${'0'.repeat(64)}  ${INSTALLER_NAME}\n`));
    await expect(download(FEED, () => {})).rejects.toThrow('huella');
    expect(await readdir(join(folder, 'syka-studio-update'))).toEqual([]);
  });
  it('only downloads from a GitHub release folder', async () => {
    await expect(installerDownloader(tmpdir())('https://example.com/setup', () => {})).rejects.toThrow('inválido');
  });
});
