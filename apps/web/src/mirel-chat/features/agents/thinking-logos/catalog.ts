import catalog from './catalog.json';
import type { LogoState } from './vendor/logoPresets';

export type BrandMark = (typeof catalog)[number];
export const BRAND_MARKS: readonly BrandMark[] = catalog;
export const BRAND_BY_ID = new Map(BRAND_MARKS.map(mark => [mark.id, mark]));
export type ToolBrandInput = { toolName?: string; label: string; summary?: string; state?: string };
export type ToolBrand = { mark: BrandMark; via?: BrandMark; state: LogoState; active: boolean };
const syka = BRAND_BY_ID.get('syka')!;
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasRules = BRAND_MARKS.flatMap(mark => mark.aliases.map(alias => ({
  mark, test: new RegExp(`(?:^|[^a-z0-9])${escaped(alias).replace(/[_-]/g, '[_ -]+')}(?:$|[^a-z0-9])`, 'i'),
}))).sort((a,b) => b.mark.id.length-a.mark.id.length);
const domainRules = BRAND_MARKS.flatMap(mark => mark.domains.map(domain => ({ mark, domain })))
  .sort((a,b) => b.domain.length-a.domain.length);

const words=(value:string)=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').toLowerCase();
function shellCommand(input:ToolBrandInput):string {
  let command=input.summary?.trim()||input.label.trim();
  try{const parsed=JSON.parse(command);if(typeof parsed==='string')command=parsed;else if(parsed&&typeof parsed==='object')command=parsed.cmd??parsed.command??command;}catch{/* Plain command metadata. */}
  if(typeof command!=='string')return '';
  for(let depth=0;depth<3;depth++){
    const wrapped=command.match(/(?:pwsh|powershell)(?:\.exe)?["']?\s+[\s\S]*?-(?:command|c)\s+([\s\S]+)/i)
      ??command.match(/\bcmd(?:\.exe)?["']?\s+\/c\s+([\s\S]+)/i)
      ??command.match(/\bbash(?:\.exe)?["']?\s+-(?:lc|c)\s+([\s\S]+)/i);
    if(!wrapped)break;command=wrapped[1].trim();
    // Native host summaries can truncate the closing quote. The opening
    // wrapper quote still identifies the shell command unambiguously.
    if(command.startsWith('"')||command.startsWith("'")){
      const quote=command[0];command=command.slice(1);
      if(command.endsWith(quote))command=command.slice(0,-1);
    }
  }
  return command;
}
function executable(command:string):string|undefined {
  const match=command.match(/^\s*(?:&\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;]+))/);
  const first=match?.slice(1).find(Boolean)?.split(/[\\/]/).pop()?.replace(/\.(?:exe|cmd|ps1)$/i,'').toLowerCase();
  if(first==='npx'||first==='uvx')return command.slice(match![0].length).trim().replace(/^(?:--yes|-y)\s+/,'').split(/\s+/)[0];
  return first;
}
function operationState(input:ToolBrandInput,command:string):LogoState {
  const action=words(input.toolName??'');
  const label=input.label.trim().toLowerCase();
  const has=(pattern:string)=>new RegExp(`(?:^|\\s)(?:${pattern})(?:$|\\s)`).test(action);
  if(has('listen|listening|transcribe|transcription|stt')||/^(?:escuchando|transcribiendo)\b/.test(label))return 'listening';
  if(has('generate|generation|generating|render|rendering|synthesize')||/^(?:generando|renderizando)\b/.test(label))return 'generating';
  if(has('wait|waiting|await|approval|approve|confirm')||/^esperando\b/.test(label))return 'waiting';
  if(has('debug|test|testing|fix|compile|check|validate')||/^(?:validando|probando|compilando|depurando)\b/.test(label)||/^(?:npm|pnpm|bun)\s+(?:run\s+)?(?:test|check|build)\b/i.test(command)||/^python(?:3)?\s+-m\s+(?:json\.tool|py_compile|pytest)\b/i.test(command))return 'solving';
  if(has('search|browse|fetch|read|list|inspect|query|find|navigate|get|view')||/^(?:buscando|consultando|leyendo|navegando|abrir fuente)\b/.test(label)||/^git\s+(?:status|diff|log|show)\b/i.test(command))return 'searching';
  return 'working';
}

/** Resolve only the actual operation's metadata. Never inspect results, chat prose or provider credentials. */
export function resolveToolBrand(input: ToolBrandInput): ToolBrand {
  const operation = words(`${input.toolName ?? ''} ${input.label}`.slice(0,4096));
  const context = `${input.label} ${input.summary ?? ''}`.slice(0,8192);
  const native = aliasRules.find(rule => rule.test.test(input.toolName ?? ''))?.mark;
  let destination: BrandMark | undefined;
  for (const value of context.match(/https?:\/\/[^\s<>"'`]+/gi) ?? []) {
    try {
      const url = new URL(value);
      if (url.hostname === 'docs.google.com') {
        const id = url.pathname.startsWith('/spreadsheets/') ? 'google-sheets'
          : url.pathname.startsWith('/presentation/') ? 'google-slides'
          : url.pathname.startsWith('/document/') ? 'google-docs' : 'google-drive';
        destination = BRAND_BY_ID.get(id);
      } else destination = domainRules.find(({domain}) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))?.mark;
      if (destination) break;
    } catch { /* Incomplete streaming URL: keep the known tool. */ }
  }
  // Shells carry their executable in title/detail. Match commands, not arbitrary mentions in prose.
  const shell = /(?:^|[_ -])(?:exec|shell|command|bash|powershell|run)(?:[_ -]|$)/i.test(operation);
  const commandText=shell?shellCommand(input):'';
  const command = shell ? executable(commandText) : undefined;
  const commandAliases: Record<string,string> = { twitter:'x', gh:'github', cf:'cloudflare', wrangler:'cloudflare', hf:'hugging-face', 'agent-reach':'agent-reach', 'yt-dlp':'youtube', ffprobe:'ffmpeg', python3:'python', node:'nodejs', pwsh:'powershell' };
  const commanded = command ? BRAND_BY_ID.get(commandAliases[command] ?? command) : undefined;
  const labelWithoutUrls=input.label.replace(/https?:\/\/[^\s<>"'`]+/gi,'');
  const explicitTarget=/^(?:consultando|usando|ejecutando|navegando|opening|browsing|using)(?:\s+(?:en|con|vía|in|on|with))?\s+(.+)$/i.exec(labelWithoutUrls)?.[1];
  const named = !shell&&explicitTarget?aliasRules.find(rule => rule.test.test(explicitTarget))?.mark:undefined;
  const mark = destination ?? commanded ?? native ?? named ?? syka;
  const state=operationState(input,commandText);
  const intermediary=native??commanded;
  return { mark, via: intermediary && intermediary.id !== mark.id ? intermediary : undefined, state,
    active: input.state === 'started' || input.state === 'progress' || input.state === 'running' };
}
