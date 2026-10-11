import { describe, expect, it } from 'vitest';
import { videoDownloadError } from '../src/host/video-download-error';

describe('download error explanations', () => {
  it('does not call rate limits or HTTP 403 an authentication requirement', () => {
    expect(videoDownloadError('HTTP Error 429: Too Many Requests')).toContain('limitó las solicitudes');
    expect(videoDownloadError('HTTP Error 403: Forbidden')).toContain('No confirma');
  });
  it('explains an antibot sign-in challenge independently of the video duration or privacy', () => {
    const message = videoDownloadError("Sign in to confirm you're not a bot. Use --cookies-from-browser");
    expect(message).toContain('verificación antibot'); expect(message).toContain('duración');
    expect(message).not.toContain('requiere una cuenta autorizada');
  });
  it('makes the missing session connection explicit for restricted videos and login failures', () => {
    for (const raw of ['Private video', 'Sign in to confirm your age', 'This video is members-only', 'Login required']) {
      const message = videoDownloadError(raw);
      expect(message).toContain('todavía no permite conectar'); expect(message).toContain('archivo local');
      expect(message).not.toContain('configurar una conexión');
    }
  });
  it('retains readable format errors and strips URLs from bounded unknown failures', () => {
    expect(videoDownloadError('No video formats found')).toContain('formato de video');
    const result = videoDownloadError('x'.repeat(1000) + ' https://example.com/sensitive?token=secret', 700);
    expect(result).toHaveLength(700); expect(result).not.toContain('secret'); expect(result).toContain('[enlace]');
  });
});
