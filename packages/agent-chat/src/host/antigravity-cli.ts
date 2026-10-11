/* MPL-2.0. Official agy headless transport; no private OAuth/model endpoints. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { killTree, type HostEnv } from './env';
import { startEditorToolBridge } from './editor-tool-bridge';
import { newItemId, truncateDetail, type Harness, type HarnessSession, type OpenOptions, type Emit, type ResumeCursor, type TurnOutcome } from './harness';
import type { HarnessInfo, Item } from '../protocol';
import { tokenCounts } from './token-usage';

type Config = { command: string; args?: string[]; profileDir: string };
const MAX_OUTPUT = 4_000_000;

export function parseAgyModels(output: string): HarnessInfo['models'] {
  const models = new Map<string, HarnessInfo['models'][number]>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([a-z0-9][a-z0-9._-]{0,127})\t(.{1,160})$/.exec(line.trim());
    if (match) models.set(match[1]!, {id: match[1]!, label: match[2]!.trim()});
  }
  return [...models.values()];
}

function runOutput(config: Config, args: string[], env: HostEnv, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, [...(config.args ?? []), ...args], {env:env.env, cwd:config.profileDir, stdio:'pipe', windowsHide:true, shell:false});
    let output = '', settled = false;
    const stop = () => void killTree(child);
    const timer = setTimeout(stop, 20_000);
    const finish = (error?: Error) => { if (settled) return; settled=true; clearTimeout(timer); signal.removeEventListener('abort', stop); error ? reject(error) : resolve(output); };
    signal.addEventListener('abort', stop, {once:true});
    if (signal.aborted) stop();
    child.stdin!.end(); child.stderr!.resume(); child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', chunk => { output += chunk; if (output.length > MAX_OUTPUT) stop(); });
    child.once('error', () => finish(Error('No se pudo ejecutar Antigravity CLI.')));
    child.once('close', code => finish(code === 0 && !signal.aborted ? undefined : Error('No se pudo consultar la sesión de Antigravity CLI.')));
  });
}

// Only ephemeral Syka-owned entries are merged into the official workspace
// configuration. Never replace personal/global MCP servers or copy auth tokens.
const configWrites = new Map<string, Promise<unknown>>();
async function editDocument(path: string, edit: (data: Record<string, any>) => void) {
  const previous = configWrites.get(path) ?? Promise.resolve();
  const action = previous.catch(() => {}).then(async () => {
    let data: Record<string, any> = {};
    try { data = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('La configuración MCP del proyecto necesita revisión; no se sobrescribió.'); }
    if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Configuración inválida.');
    edit(data);
    await mkdir(dirname(path), {recursive:true});
    const tmp = path + '.' + randomUUID() + '.tmp';
    try { await writeFile(tmp, JSON.stringify(data, null, 2), {mode:0o600}); await rename(tmp, path); }
    finally { await unlink(tmp).catch(() => {}); }
  });
  configWrites.set(path, action);
  try { await action; } finally { if (configWrites.get(path) === action) configWrites.delete(path); }
}
async function editConfig(path: string, edit: (servers: Record<string, unknown>) => void) {
  await editDocument(path, data => {
    if (data.mcpServers && (typeof data.mcpServers !== 'object' || Array.isArray(data.mcpServers))) throw Error('Configuración MCP inválida.');
    data.mcpServers ??= {}; edit(data.mcpServers);
  });
}

export class AntigravityCliHarness implements Harness {
  readonly id = 'antigravity' as const;
  private models: HarnessInfo['models'] = [];
  private config: Config;
  constructor(config: Config) { this.config = config; }
  async probe(env: HostEnv, signal: AbortSignal): Promise<HarnessInfo> {
    const base = {id:this.id, label:'Google Antigravity', models:[]};
    try {
      await mkdir(this.config.profileDir, {recursive:true});
      const version = (await runOutput(this.config, ['--version'], env, signal)).trim();
      if (!/^\d+\.\d+\.\d+$/.test(version)) return {...base,status:'error',detail:'El ejecutable no se identifica como Antigravity CLI.'};
      this.models = parseAgyModels(await runOutput(this.config, ['models'], env, signal));
      return this.models.length ? {...base, status:'ready', version, models:this.models, defaultModel:this.models[0]?.id, detail:'Conectado mediante la CLI oficial y tu sesión existente. Los modelos provienen de agy models.'}
        : {...base,status:'signed-out',detail:'Abrí Antigravity CLI e iniciá sesión; después comprobá la conexión.'};
    } catch { return {...base,status:'error',detail:'No se pudo consultar Antigravity CLI. Comprobá su instalación y sesión.'}; }
  }
  async open(options: OpenOptions): Promise<HarnessSession> {
    const profile = createHash('sha256').update(this.config.command + '\0' + (options.env.env.USERPROFILE ?? options.env.env.HOME ?? '')).digest('hex');
    if (options.resume && (!('antigravityCli' in options.resume) || options.resume.antigravityCli.profile !== profile)) throw Error('Este chat usaba otra conexión de Antigravity. Conservamos su historial; creá un chat nuevo para usar la CLI.');
    return new AgySession(this.config, options, profile, this.models.map(m => m.id));
  }
}

class AgySession implements HarnessSession {
  resume: ResumeCursor;
  private child: ChildProcess | null = null;
  private active: Promise<TurnOutcome> | null = null;
  private cancelled = false;
  private closed = false;
  get isClosed() { return this.closed; }
  private config: Config;
  private options: OpenOptions;
  private profile: string;
  private models: string[];
  constructor(config: Config, options: OpenOptions, profile: string, models: string[]) {
    this.config=config; this.options=options; this.profile=profile; this.models=models;
    this.resume = options.resume ?? {antigravityCli:{sessionId:'',profile}};
  }
  send(text: string, model: string, emit: Emit, effort?: string, fast?: boolean): Promise<TurnOutcome> {
    if (this.active || this.closed || !this.models.includes(model) || effort || fast) return Promise.resolve({status:'failed',error:'Sesión ocupada o modelo/opción no anunciado por Antigravity CLI.'});
    this.cancelled = false;
    this.active = this.run(text, model, emit).catch((): TurnOutcome => ({status:this.cancelled?'interrupted':'failed',error:'No se pudo completar el turno de Antigravity CLI.'})).finally(() => {this.active=null;});
    return this.active;
  }
  private async run(text: string, model: string, emit: Emit): Promise<TurnOutcome> {
    const bridge = await startEditorToolBridge(this.options);
    // Google prefixes server and tool names. Keep the resulting function name
    // under the model's 64-character limit or tools disappear from discovery.
    const name = 'syka_' + randomUUID().replaceAll('-', '').slice(0, 12);
    const configPath = join(this.options.cwd, '.agents', 'mcp_config.json');
    const userHome = this.options.env.env.USERPROFILE ?? this.options.env.env.HOME;
    if (!userHome) { await bridge.close(); throw Error('No se pudo localizar la sesión oficial de Antigravity.'); }
    const permissionsPath = join(userHome, '.gemini', 'antigravity-cli', 'settings.json');
    const addedRules: string[] = [];
    const owned: Record<string, {serverUrl:string}> = {[name + '_workspace']:{serverUrl:bridge.url}};
    if (this.options.mcp) owned[name + '_editor'] = {serverUrl:this.options.mcp.url};
    try {
      await editConfig(configPath, servers => {
        if (Object.keys(owned).some(key => key in servers)) throw Error('Nombre MCP ocupado; no se reemplazó la conexión existente.');
        Object.assign(servers, owned);
      });
      // Headless soft-denies MCP by default. Grant only this session's two
      // local Syka servers, keeping all existing ask/deny rules authoritative.
      await editDocument(permissionsPath, data => {
        if (data.permissions && (typeof data.permissions !== 'object' || Array.isArray(data.permissions))) throw Error('Revisá los permisos de Antigravity.');
        data.permissions ??= {};
        if (data.permissions.allow && !Array.isArray(data.permissions.allow)) throw Error('Revisá los permisos de Antigravity.');
        data.permissions.allow ??= [];
        for (const key of Object.keys(owned)) {
          const rule = `mcp(${key}/*)`;
          if (!data.permissions.allow.includes(rule)) {data.permissions.allow.push(rule);addedRules.push(rule);}
        }
      });
      if (this.cancelled) return {status:'interrupted'};
      const cursor = 'antigravityCli' in this.resume ? this.resume.antigravityCli.sessionId : '';
      const args = [...(this.config.args ?? []), '--input-format','stream-json','--output-format','stream-json','--model',model];
      if (cursor) args.push('--conversation',cursor);
      const child = spawn(this.config.command,args,{cwd:this.options.cwd,env:this.options.env.env,windowsHide:true,shell:false,stdio:'pipe'});
      this.child=child;
      return await new Promise<TurnOutcome>(resolve => {
        let buffer='', result: TurnOutcome | undefined, terminal=false;
        const assistant = new Map<number, Extract<Item,{kind:'assistant'}>>();
        const tools = new Map<number, string>();
        const timer=setTimeout(()=>void killTree(child),30*60_000);
        child.stderr!.resume(); child.stdin!.on('error',()=>{}); child.stdout!.setEncoding('utf8');
        const processLine = (line: string) => {
          let message: any; try {message=JSON.parse(line);} catch {return;}
          if (terminal) return;
          if (message.event==='init' && typeof message.conversation_id==='string') this.resume={antigravityCli:{sessionId:message.conversation_id,profile:this.profile}};
          if (message.event==='step_update') {
            const step=message.step_update;
            if (!step || !Number.isInteger(step.step_index)) return;
            const stepTokens = tokenCounts(step.usage, 'agy');
            if (step.state === 'DONE' && stepTokens && 'antigravityCli' in this.resume) emit({ type: 'usage.reported', usage: { sessionId: this.resume.antigravityCli.sessionId, kind: 'turn', measurementId: `step:${step.step_index}`, tokens: stepTokens, model } });
            if (step.step_type==='agent_response' && typeof step.text_delta==='string') {
              let item=assistant.get(step.step_index);
              if (!item) {item={id:newItemId('agy'),kind:'assistant',text:'',phase:'commentary'};assistant.set(step.step_index,item);emit({type:'item.started',item:{...item}});}
              item.text+=step.text_delta; emit({type:'item.delta',itemId:item.id,text:step.text_delta});
              if (step.state==='DONE') emit({type:'item.completed',item:{...item}});
            }
            if (step.step_type==='tool') {
              const id=tools.get(step.step_index) ?? newItemId('agy-tool'); tools.set(step.step_index,id);
              const name=String(step.tool_name ?? step.tool_info?.name ?? 'Herramienta');
              const completed=step.state==='DONE'||step.state==='ERROR';
              const item: Item={id,kind:'tool',name,title:name,status:completed?(step.state==='ERROR'||step.tool_info?.error?'failed':'done'):'running',output:truncateDetail(typeof step.tool_info?.output==='string'?step.tool_info.output:typeof step.tool_info?.error?.message==='string'?step.tool_info.error.message:undefined)};
              emit({type:completed?'item.completed':'item.started',item});
            }
          }
          if (message.event==='result') {
            terminal=true;
            const data=message.result ?? {};
            if (typeof data.conversation_id==='string') this.resume={antigravityCli:{sessionId:data.conversation_id,profile:this.profile}};
            const tokens = tokenCounts(data.usage, 'agy');
            if (tokens && 'antigravityCli' in this.resume) emit({ type: 'usage.reported', usage: { sessionId: this.resume.antigravityCli.sessionId, kind: 'cumulative', tokens, model, historical: !!cursor } });
            const last=[...assistant.values()].at(-1);
            if (typeof data.response==='string' && data.response.trim()) emit({type:'item.completed',item:{id:last?.id ?? newItemId('agy-final'),kind:'assistant',text:data.response,phase:'final'}});
            result=this.cancelled || ['CANCELED','INTERRUPTED'].includes(data.status) ? {status:'interrupted'} : data.status==='SUCCESS' && typeof data.response==='string' && data.response.trim() ? {status:'completed'} : {status:'failed',error:'Antigravity CLI terminó sin una respuesta final confirmada. No se cambió de modelo.'};
            child.stdin!.end();
          }
        };
        child.stdout!.on('data',chunk=>{
          buffer+=chunk;
          if (buffer.length>MAX_OUTPUT) {void killTree(child);return;}
          let end; while ((end=buffer.indexOf('\n'))>=0) {const line=buffer.slice(0,end);buffer=buffer.slice(end+1);processLine(line);}
        });
        const finish=()=>{clearTimeout(timer);if(buffer.trim())processLine(buffer);this.child=null;resolve(this.cancelled?{status:'interrupted'}:result ?? {status:'failed',error:'La conexión de Antigravity terminó sin confirmar el resultado.'});};
        child.once('error',finish); child.once('close',finish);
        const instructions=[this.options.instructions,`Usá los MCP de esta sesión: ${Object.keys(owned).join(', ')}. Son las herramientas locales del proyecto.`,text].filter(Boolean).join('\n\n');
        child.stdin!.write(JSON.stringify({event:'user',message:{content:instructions}})+'\n');
      });
    } finally {
      if (addedRules.length) await editDocument(permissionsPath,data=>{
        if (Array.isArray(data.permissions?.allow)) data.permissions.allow=data.permissions.allow.filter((rule: unknown)=>!addedRules.includes(rule as string));
      }).catch(()=>{});
      await editConfig(configPath,servers=>{for(const [key,value] of Object.entries(owned)) if(JSON.stringify(servers[key])===JSON.stringify(value)) delete servers[key];}).catch(()=>{});
      await bridge.close();
    }
  }
  respond(): void { /* Official headless CLI soft-denies permissions; no invented approval protocol. */ }
  async interrupt() {this.cancelled=true;if(this.child)await killTree(this.child);await this.active;}
  async close() {await this.interrupt();this.closed=true;}
}
