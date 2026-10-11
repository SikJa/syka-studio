import { execFile } from 'node:child_process';

export function validateCodexLoginUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['auth.openai.com', 'chatgpt.com', 'auth.chatgpt.com'].includes(url.hostname)) throw Error('El proveedor no devolvió una página de inicio de sesión oficial.');
  return url.href;
}

/** Called only after an explicit sign-in action; never passes URL text to a shell. */
export function openCodexLogin(value: string): Promise<void> {
  const url = validateCodexLoginUrl(value);
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise((resolve, reject) => execFile(command, args, { windowsHide: true, timeout: 30_000 }, error => error ? reject(Error('No se pudo abrir el navegador predeterminado.')) : resolve()));
}
