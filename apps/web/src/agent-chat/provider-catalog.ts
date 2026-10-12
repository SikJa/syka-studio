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
  opencode: { url: 'https://opencode.ai/docs/providers/', linkLabel: 'Cuentas de OpenCode · guía oficial', steps: ['Conectar OpenCode detecta o prepara el componente oficial y recupera sus modelos gratuitos.', 'Para sumar una cuenta, usá Conectar otra cuenta y elegí uno de los métodos de navegador que anuncia OpenCode.', 'Autorizá la cuenta en el enlace oficial. Si el proveedor entrega un código, completalo en Syka.'], limitation: 'Detectar el catálogo no confirma cuota. La app visual y la terminal pueden usar perfiles distintos; se comprueba el perfil de la CLI oficial.' },
  codex: { url: 'https://learn.chatgpt.com/docs/auth', linkLabel: 'Autenticación de Codex · guía oficial', steps: ['Conectar Codex detecta o prepara el componente oficial.', 'Se abre el inicio de sesión de ChatGPT en tu navegador. También podés elegir la vinculación con código si tu cuenta la permite.', 'Al autorizar la cuenta, Syka comprueba la sesión y obtiene los modelos disponibles.'] },
  claude: { url: 'https://code.claude.com/docs/en/authentication', linkLabel: 'Autenticación de Claude · guía oficial', steps: ['Conectar Claude detecta o prepara Claude Code.', 'Autorizá tu cuenta en el navegador. Si aparece un código de autorización, pegalo en Syka.', 'Al completar el login, Syka comprueba la sesión de Claude Code.'] },
  antigravity: { url: 'https://www.antigravity.google/docs/cli/install/', linkLabel: 'Antigravity · guía oficial', steps: ['Conectar Antigravity detecta o prepara su componente oficial y comprueba si ya tenés una sesión.', 'Si falta la sesión, autorizá tu cuenta de Google en el navegador.', 'El selector muestra los modelos que habilita tu cuenta, incluidos Claude cuando estén disponibles.'], limitation: 'La sesión de la aplicación y la de la CLI pueden ser distintas. Los chats antiguos de ACP conservan su conexión: creá un chat nuevo para usar la CLI.' },
  hermes: { url: 'https://hermes-agent.nousresearch.com/docs/guides/run-hermes-with-nous-portal', linkLabel: 'Hermes · guía oficial', steps: ['Syka detecta la instalación y la cuenta configurada de Hermes.', 'Conectar Hermes permite elegir el login de Nous Portal o ChatGPT que admite esa instalación.', 'Se abre el enlace oficial y aparece el código de vinculación. Autorizá tu cuenta y volvé a Syka.'], limitation: 'Hermes debe estar instalado. Los modelos y el razonamiento dependen del proveedor conectado; la cuota se comprueba al enviar un mensaje.' },
  cursor: { url: 'https://cursor.com/docs/cli/reference/authentication', linkLabel: 'Autenticación de Cursor · guía oficial', steps: ['Conectar Cursor detecta o prepara su agente oficial.', 'Autorizá tu cuenta en el enlace de Cursor que se abre en el navegador.', 'Syka comprueba la sesión y los modelos anunciados por el agente.'], limitation: 'Los modelos y las capacidades disponibles dependen de tu cuenta y de la versión del agente.' },
  grok: { url: 'https://docs.x.ai/build/cli/reference', linkLabel: 'Grok Build · guía oficial', steps: ['Conectar Grok detecta o prepara Grok Build.', 'Autorizá tu cuenta de xAI en el navegador y completá el código si el proveedor lo solicita.', 'Syka comprueba la conexión del agente y obtiene sus modelos.'], limitation: 'La cuenta de la web de Grok y la conexión de Grok Build se comprueban por separado.' },
  muse: { url: '#', linkLabel: 'Proveedor retirado', steps: ['Los chats anteriores se conservan. Elegí un proveedor activo para continuar.'], limitation: 'Muse ya no forma parte de las conexiones de Syka Studio.' },
};
