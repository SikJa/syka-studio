import { MCP_URL } from '@diffusionstudio/dapi';

/** Agent shells inherit their own instance/project endpoint. Never discover another editor. */
export function mcpEndpoint(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.SYKA_PROJECT_MCP_URL) return MCP_URL;
  const url = new URL(env.SYKA_PROJECT_MCP_URL);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || !url.searchParams.get('projectId') || !url.searchParams.get('projectDir')) {
    throw Error('El endpoint del proyecto es inválido. No se usará otra instancia del editor.');
  }
  return url.href;
}
