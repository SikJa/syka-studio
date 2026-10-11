import type { HarnessId } from '@diffusionstudio/agent-chat';
import codex from '@/assets/providers/codex.svg?raw';
import claude from '@/assets/providers/claude.svg?raw';
import cursor from '@/assets/icons/agent.cursor.svg?raw';
import gemini from '@/assets/icons/provider.gemini.svg?raw';
import antigravity from '@/assets/icons/agent.google-antigravity.svg?raw';
import grok from '@/assets/icons/provider.grok.svg?raw';
import muse from '@/assets/icons/provider.muse.svg?raw';
import hermes from '@/assets/icons/provider.hermes.svg?raw';
import opencode from '@/assets/icons/agent.opencode.svg?raw';

/** Trusted bundled SVGs. Claude, Gemini, Nous Research and MetaAI: LobeHub. */
export const PROVIDER_LOGOS: Record<HarnessId, string> = { codex, claude, antigravity, cursor, grok, muse, hermes, opencode };
const svgBody=(svg:string)=>svg.replace(/^\s*<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title>/g,'');
function routedLogo(family:string){
  return `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" data-route="antigravity"><g transform="translate(-2 -2) scale(1.25)">${svgBody(antigravity)}</g><circle cx="21" cy="21" r="7" fill="var(--surface-2,#202022)"/><g transform="translate(16 16) scale(.42)">${svgBody(family)}</g></svg>`;
}
export function modelLogo(harness: HarnessId, model: string): string {
  if(harness!=='antigravity')return PROVIDER_LOGOS[harness];
  return routedLogo(model.startsWith('claude-')?claude:model.startsWith('gpt-')?codex:gemini);
}
export function modelRouteDescription(harness:HarnessId,model:string):string{
  if(harness!=='antigravity')return PROVIDER_NAMES[harness];
  return `${model.startsWith('claude-')?'Claude':model.startsWith('gpt-')?'OpenAI':'Gemini'} · vía Antigravity`;
}
export const PROVIDER_NAMES: Record<HarnessId, string> = { codex: 'Codex', claude: 'Claude', antigravity: 'Antigravity', hermes: 'Hermes', cursor: 'Cursor', grok: 'Grok', muse: 'Muse', opencode: 'OpenCode' };
export const PROVIDER_NOTES: Record<HarnessId, string> = {
  codex: 'Editá con los modelos incluidos en tu cuenta de ChatGPT.',
  antigravity: 'Gemini y los modelos disponibles en Antigravity, con tu cuenta de Google.',
  claude: 'Claude Code con tu cuenta de Claude y una sesión propia del editor.',
  hermes: 'El asistente de Nous Research, con el proveedor que elijas en Hermes.',
  cursor: 'Usá el agente de Cursor con tu cuenta y sus modelos disponibles.',
  grok: 'Grok Build con tu cuenta de xAI.',
  muse: 'Proveedor retirado. Solo se conserva el historial anterior.',
  opencode: 'Usá la cuenta y los modelos que ya configuraste en OpenCode. Los modelos gratuitos no requieren Go; Go es una suscripción y Zen puede cobrar por uso.',
};
type ProviderGuide = { url: string; linkLabel: string; steps: string[]; limitation?: string };
export const PROVIDER_GUIDES: Record<HarnessId, ProviderGuide> = {
  opencode: { url: 'https://opencode.ai/docs/', linkLabel: 'Preparar OpenCode · guía oficial', steps: ['Syka detecta la CLI de OpenCode en este equipo. El free tier requiere la versión 1.18.0 o superior.', 'Podés usar sus modelos gratuitos sin contratar Go. Para agregar otra cuenta, abrí OpenCode y usá /connect.', 'Si ya conectaste Go u otro proveedor en OpenCode, se usa esa misma cuenta sin copiar credenciales. Volvé a comprobar conexiones y elegí un modelo.'], limitation: 'Detectar el catálogo no confirma cuota. La app visual y la terminal pueden usar perfiles distintos; se comprueba el perfil de la CLI oficial.' },
  codex: { url: 'https://learn.chatgpt.com/docs/quickstart', linkLabel: 'Preparar Codex · guía oficial', steps: ['Necesitás Codex instalado en este equipo y una cuenta de ChatGPT compatible.', 'Usá Conectar cuenta: se abre el inicio de sesión oficial en tu navegador.', 'Volvé al editor. Los modelos aparecerán al completar el inicio de sesión.'] },
  claude: { url: 'https://code.claude.com/docs/en/quickstart', linkLabel: 'Preparar Claude Code · guía oficial', steps: ['Prepará Claude Code desde su página oficial.', 'El editor detecta la instalación compatible. Usá Conectar cuenta para abrir el inicio de sesión oficial.', 'Autorizá tu cuenta en el navegador y volvé al editor.'] },
  antigravity: { url: 'https://antigravity.google/docs/cli/install', linkLabel: 'Instalar Antigravity CLI oficial', steps: ['Syka detecta Antigravity CLI y reutiliza su sesión. Si no está instalada, abrí la guía oficial.', 'Iniciá sesión en Antigravity CLI con tu cuenta de Google y volvé a comprobar la conexión en Syka.', 'El selector muestra los modelos que habilita tu cuenta, incluidos Claude cuando estén disponibles.'], limitation: 'La sesión de la aplicación y la de la CLI pueden ser distintas. Los chats antiguos de ACP conservan su conexión: creá un chat nuevo para usar la CLI.' },
  hermes: { url: 'https://hermes-agent.nousresearch.com/docs/guides/run-hermes-with-nous-portal', linkLabel: 'Conectar Hermes · Nous Portal', steps: ['Si ya tenés Hermes, Syka busca su instalación y el perfil activo.', 'Se usa la sesión que ya configuraste en Hermes, sin copiar claves ni volver a crear la cuenta.', 'Usá Volver a comprobar conexiones si instalaste Hermes después de abrir Syka.'], limitation: 'El proveedor y los modelos dependen de tu configuración de Hermes. La disponibilidad de cuota se comprueba al enviar un mensaje.' },
  cursor: { url: 'https://cursor.com/docs/cli/overview', linkLabel: 'Preparar el agente de Cursor', steps: ['Prepará el agente de Cursor siguiendo su guía oficial.', 'Conectá la cuenta correspondiente a ese agente.', 'Volvé al editor y comprobá la conexión.'], limitation: 'La integración depende de que la instalación ofrezca una conexión compatible con el editor.' },
  grok: { url: 'https://grok.com/', linkLabel: 'Abrir Grok', steps: ['Grok y Groq son servicios distintos: Groq se configura en su propio apartado.', 'Para editar necesitás el agente Grok Build compatible, además de tu cuenta de xAI.', 'Una vez preparado, volvé y comprobá la disponibilidad.'], limitation: 'Iniciar sesión en la web de Grok no instala ni conecta Grok Build.' },
  muse: { url: '#', linkLabel: 'Proveedor retirado', steps: ['Los chats anteriores se conservan. Elegí un proveedor activo para continuar.'], limitation: 'Muse ya no forma parte de las conexiones de Syka Studio.' },
};
