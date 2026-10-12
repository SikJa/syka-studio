import { execFile } from 'node:child_process';
import type { HarnessId } from '../protocol';

const LOGIN_HOSTS: Partial<Record<HarnessId, string[]>> = {
  codex: ['auth.openai.com', 'chatgpt.com', 'auth.chatgpt.com'],
  claude: ['claude.ai', 'claude.com', 'platform.claude.com', 'console.anthropic.com'],
  antigravity: ['accounts.google.com', 'antigravity.google', 'www.antigravity.google', 'auth.antigravity.google'],
  grok: ['accounts.x.ai', 'auth.x.ai', 'grok.com', 'accounts.grok.com', 'auth.grok.com'],
  cursor: ['cursor.com', 'www.cursor.com', 'authenticator.cursor.sh', 'auth.cursor.com'],
  hermes: ['portal.nousresearch.com', 'auth.nousresearch.com', 'auth.openai.com', 'chatgpt.com'],
  opencode: ['opencode.ai', 'auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com', 'claude.ai', 'claude.com', 'platform.claude.com', 'console.anthropic.com', 'github.com', 'accounts.x.ai', 'auth.x.ai', 'grok.com', 'accounts.grok.com', 'auth.grok.com'],
};

export function validateProviderLoginUrl(provider: HarnessId, value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !LOGIN_HOSTS[provider]?.includes(url.hostname)) throw Error('El proveedor no devolvió una página de inicio de sesión oficial.');
  return url.href;
}

export function validateCodexLoginUrl(value: string): string {
  return validateProviderLoginUrl('codex', value);
}

/** Called only after an explicit sign-in action; never passes URL text to a shell. */
export function openCodexLogin(value: string): Promise<void> {
  const url = validateCodexLoginUrl(value);
  return openUrl(url);
}

export function openProviderLogin(provider: HarnessId, value: string): Promise<void> {
  return openUrl(validateProviderLoginUrl(provider, value));
}

function openUrl(url: string): Promise<void> {
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise((resolve, reject) => execFile(command, args, { windowsHide: true, timeout: 30_000 }, error => error ? reject(Error('No se pudo abrir el navegador predeterminado.')) : resolve()));
}
