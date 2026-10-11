import { validateImage } from './core.mjs';
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function dataUri(material) {
  const ext = material.file.slice(material.file.lastIndexOf('.'));
  validateImage(material.bytes, ext);
  return `data:image/${ext === '.svg' ? 'svg+xml' : ext === '.jpg' ? 'jpeg' : ext.slice(1)};base64,${material.bytes.toString('base64')}`;
}
export function composeCover({ frame, logo, title, subtitle = '' }) {
  if (!frame || frame.kind !== 'frame') throw new Error('Elegí un fotograma para preparar la portada');
  if (logo && logo.kind !== 'logo') throw new Error('Elegí un logo original de biblioteca');
  if (typeof title !== 'string' || !title.trim() || title.length > 72 || subtitle.length > 100) throw new Error('Título de portada: 1–72 caracteres; bajada: hasta 100');
  const words = title.trim().split(/\s+/); const lines = [''];
  for (const word of words) { if (word.length > 25) throw new Error('Acortá las palabras del título'); if ((lines.at(-1) + word).length > 25) lines.push(''); lines[lines.length - 1] += `${word} `; }
  if (lines.length > 3) throw new Error('Acortá el título a tres líneas');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${esc(title)}">
  <defs><linearGradient id="shade"><stop stop-color="#090a0c" stop-opacity=".98"/><stop offset=".7" stop-color="#090a0c" stop-opacity=".83"/><stop offset="1" stop-color="#090a0c" stop-opacity=".18"/></linearGradient></defs>
  <image width="1280" height="720" href="${dataUri(frame)}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1280" height="720" fill="url(#shade)"/>
  <rect x="64" y="100" width="44" height="5" rx="2" fill="#008cff"/>
  <text x="64" y="153" fill="#c3c8d1" font-family="Arial,sans-serif" font-size="19" letter-spacing="4">VIDEO · SYKA</text>
  <text fill="white" font-family="Arial,sans-serif" font-size="66" font-weight="700">${lines.map((line, i) => `<tspan x="60" y="${260 + i * 78}">${esc(line.trim())}</tspan>`).join('')}</text>
  <text x="64" y="564" fill="#c3c8d1" font-family="Arial,sans-serif" font-size="23">${esc(subtitle)}</text>
  ${logo ? `<image x="64" y="618" width="190" height="38" href="${dataUri(logo)}" preserveAspectRatio="xMinYMid meet"/>` : ''}
  </svg>`;
}
