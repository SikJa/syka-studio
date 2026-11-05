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
import deepseek from '@/assets/icons/provider.deepseek.svg?raw';
import pi from '@/assets/icons/provider.pi.svg?raw';

/** Trusted bundled SVGs. Claude, Gemini, Nous Research and MetaAI: LobeHub. */
export const PROVIDER_LOGOS: Record<HarnessId, string> = { codex, claude, antigravity, cursor, grok, muse, hermes, opencode, 'gemini-web': gemini, deepseek, pi };
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
export const PROVIDER_NAMES: Record<HarnessId, string> = { codex: 'Codex', claude: 'Claude', antigravity: 'Antigravity', hermes: 'Hermes', cursor: 'Cursor', grok: 'Grok', muse: 'Muse', opencode: 'OpenCode', 'gemini-web': 'Gemini Web · Experimental', deepseek: 'DeepSeek', pi: 'Pi' };
export const PROVIDER_NOTES: Record<HarnessId, string> = {
  'gemini-web': 'Usá la pestaña de Gemini que vinculaste con la extensión de Syka. Conector experimental: puede fallar cuando cambia la web.',
  codex: 'Editá con los modelos incluidos en tu cuenta de ChatGPT.',
  antigravity: 'Gemini y los modelos disponibles en Antigravity, con tu cuenta de Google.',
  claude: 'Claude Code con tu cuenta de Claude y una sesión propia del editor.',
  hermes: 'El asistente de Nous Research, con el proveedor que elijas en Hermes.',
  cursor: 'Usá el agente de Cursor con tu cuenta y sus modelos disponibles.',
  grok: 'Grok Build con tu cuenta de xAI.',
  muse: 'Proveedor retirado. Solo se conserva el historial anterior.',
  deepseek: 'El arnés de agente de DeepSeek (dsh), con tu clave de DeepSeek en DEEPSEEK_API_KEY.',
  pi: 'El agente Pi con los proveedores que conectes en Pi (/login) o las claves de Configuración › Proveedores.',
  opencode: 'Usá la cuenta y los modelos que ya configuraste en OpenCode. Los modelos gratuitos no requieren Go; Go es una suscripción y Zen puede cobrar por uso.',
};
type ProviderGuide = { url: string; linkLabel: string; steps: string[]; limitation?: string };
export const PROVIDER_GUIDES: Record<HarnessId, ProviderGuide> = {
  'gemini-web': { url: 'https://gemini.google.com/', linkLabel: 'Gemini Web', steps: ['Iniciá el puente local desde Conectar Gemini Web.', 'En tu pestaña de Gemini, abrí la extensión Syka y pulsá «Conectar esta pestaña». Se reutiliza la sesión de ese perfil.', 'Volvé a Syka y comprobá la conexión. Mantené abierta la pestaña vinculada mientras editás.'], limitation: 'Experimental. La identidad interna del modelo no está certificada. Por ahora utiliza OpenCode como componente de ejecución; no necesita que vuelvas a iniciar sesión si la pestaña ya está conectada a tu cuenta.' },
  pi: { url: 'https://www.npmjs.com/package/@earendil-works/pi-coding-agent', linkLabel: 'Pi · paquete oficial', steps: ['Instalá Pi con «npm install -g @earendil-works/pi-coding-agent».', 'Abrí «pi» en una terminal e iniciá sesión con /login, o guardá una clave de OpenRouter, DeepSeek u OpenAI en Configuración › Proveedores.', 'Syka detecta sus modelos y abre un proceso de Pi por chat.'], limitation: 'Los diálogos de las extensiones de Pi todavía no se muestran: se cancelan para que el turno no quede trabado.' },
  deepseek: { url: 'https://api-docs.deepseek.com/quick_start/agent_integrations', linkLabel: 'DeepSeek Harness · guía oficial', steps: ['Instalá DeepSeek Harness (dsh) con la guía oficial.', 'Configurá tu clave en la variable DEEPSEEK_API_KEY.', 'Volvé a comprobar la conexión: Syka lo detecta y lo abre con «dsh acp».'] },
  opencode: { url: 'https://opencode.ai/docs/providers/', linkLabel: 'Cuentas de OpenCode · guía oficial', steps: ['Conectar OpenCode detecta o prepara el componente oficial y recupera sus modelos gratuitos.', 'Para sumar una cuenta, usá Conectar otra cuenta y elegí uno de los métodos de navegador que anuncia OpenCode.', 'Autorizá la cuenta en el enlace oficial. Si el proveedor entrega un código, completalo en Syka.'], limitation: 'Detectar el catálogo no confirma cuota. La app visual y la terminal pueden usar perfiles distintos; se comprueba el perfil de la CLI oficial.' },
  codex: { url: 'https://learn.chatgpt.com/docs/auth', linkLabel: 'Autenticación de Codex · guía oficial', steps: ['Conectar Codex detecta o prepara el componente oficial y comprueba tu sesión existente.', 'Si falta una sesión, se abre el login de ChatGPT. También podés elegir la vinculación con código si tu cuenta la permite.', 'Elegí uno de los modelos comprobados. Para cambiar la cuenta, usá Conectar otra cuenta.'] },
  claude: { url: 'https://code.claude.com/docs/en/authentication', linkLabel: 'Autenticación de Claude · guía oficial', steps: ['Conectar Claude detecta o prepara Claude Code y comprueba la sesión.', 'Si falta una sesión, autorizá tu cuenta en el navegador. Si aparece un código de autorización, pegalo en Syka.', 'Elegí un modelo. Conectar otra cuenta inicia un login nuevo solamente cuando lo pedís.'] },
  antigravity: { url: 'https://www.antigravity.google/docs/cli/install/', linkLabel: 'Antigravity · guía oficial', steps: ['Conectar Antigravity detecta o prepara su componente oficial y comprueba si ya tenés una sesión.', 'Si falta la sesión, autorizá tu cuenta de Google en el navegador.', 'El selector muestra los modelos que habilita tu cuenta, incluidos Claude cuando estén disponibles.'], limitation: 'La sesión de la aplicación y la de la CLI pueden ser distintas. Los chats antiguos de ACP conservan su conexión: creá un chat nuevo para usar la CLI.' },
  hermes: { url: 'https://hermes-agent.nousresearch.com/docs/guides/run-hermes-with-nous-portal', linkLabel: 'Hermes · guía oficial', steps: ['Syka detecta la instalación y la cuenta configurada de Hermes.', 'Conectar Hermes permite elegir el login de Nous Portal o ChatGPT que admite esa instalación.', 'Se abre el enlace oficial y aparece el código de vinculación. Autorizá tu cuenta y volvé a Syka.'], limitation: 'Hermes debe estar instalado. Los modelos y el razonamiento dependen del proveedor conectado; la cuota se comprueba al enviar un mensaje.' },
  cursor: { url: 'https://cursor.com/docs/cli/reference/authentication', linkLabel: 'Autenticación de Cursor · guía oficial', steps: ['Conectar Cursor detecta o prepara su agente oficial y comprueba la sesión existente.', 'Si falta una sesión, autorizá tu cuenta en el enlace de Cursor que se abre en el navegador.', 'Syka comprueba la sesión y los modelos anunciados por el agente.'], limitation: 'Los modelos y las capacidades disponibles dependen de tu cuenta y de la versión del agente.' },
  grok: { url: 'https://docs.x.ai/build/cli/reference', linkLabel: 'Grok Build · guía oficial', steps: ['Conectar Grok detecta o prepara Grok Build y comprueba su sesión.', 'Si falta una sesión, autorizá tu cuenta de xAI en el navegador y completá el código si el proveedor lo solicita.', 'Syka comprueba la conexión del agente y obtiene sus modelos.'], limitation: 'La cuenta de la web de Grok y la conexión de Grok Build se comprueban por separado.' },
  muse: { url: '#', linkLabel: 'Proveedor retirado', steps: ['Los chats anteriores se conservan. Elegí un proveedor activo para continuar.'], limitation: 'Muse ya no forma parte de las conexiones de Syka Studio.' },
};
