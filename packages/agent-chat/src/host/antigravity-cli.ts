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
import { runCliLogin } from './cli-login';
import { harnessTraceFor } from './harness-telemetry';

type Config = { command: string; args?: string[]; profileDir: string };
const MAX_OUTPUT = 4_000_000;

/** Classify provider diagnostics without surfacing prompts, credentials or raw stderr. */
export function agyFailureMessage(model: string, diagnostics: readonly string[]): string | undefined {
  const detail = diagnostics.join('\n');
  const prefix = `Antigravity (${model})`;
  const reset = /resets? in (\d+(?:h\d*m?\d*s?|m\d*s?|s))/i.exec(detail)?.[1];
  const retry = `${reset ? ` Reintento disponible según el proveedor en ${reset}.` : ''} No se cambió de modelo ni se reintentó automáticamente.`;
  if (/individual quota reached|quota exceeded/i.test(detail)) {
    return `${prefix}: el proveedor informó que se agotó la cuota para esta solicitud.${retry}`;
  }
  if (/RESOURCE_EXHAUSTED|\b429\b/i.test(detail)) {
    return `${prefix}: el proveedor limitó esta solicitud. El saldo de cuota no fue informado.${retry}`;
  }
  if (/tool .* is not enabled for server|unknown mcp server|mcp server .* not found/i.test(detail)) return `${prefix}: una herramienta apunta a una conexión MCP que ya no está disponible. No se confirmó una respuesta final; reintentá el mensaje para usar las herramientas actuales de esta sesión.`;
  if (/permission check failed|permission denied|PERMISSION_DENIED|user denied permission/i.test(detail)) return `${prefix}: una herramienta fue rechazada por los permisos de la CLI y no se confirmó una respuesta final. Revisá la configuración de acceso de Antigravity; no se cambió de modelo.`;
  if (/not logged into antigravity|unauthenticated|authentication required/i.test(detail)) return `${prefix}: la CLI no pudo recuperar la sesión de Google. Revisá la conexión de Antigravity.`;
  if (/INVALID_ARGUMENT|invalid arguments|invalid tool call|invalid_args|additional properties .*not allowed/i.test(detail)) return `${prefix}: la CLI rechazó los argumentos de una herramienta por incompatibilidad con su esquema. No se confirmó una respuesta final.`;
  if (/model.*(?:not found|unknown|unsupported|not available)|modelo.*no disponible/i.test(detail)) return `${prefix}: el proveedor no confirmó acceso a ese modelo. No se cambió de modelo ni de cuenta.`;
  if (/UNAVAILABLE|DEADLINE_EXCEEDED|connection refused|network unreachable|timed? ?out/i.test(detail)) return `${prefix}: el proveedor o la conexión no respondió a tiempo. No se cambió de modelo ni se reintentó automáticamente.`;
  return undefined;
}

function errorText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const error = value as {message?: unknown; code?: unknown; status?: unknown};
  return [error.code, error.status, error.message].filter(part => typeof part === 'string' || typeof part === 'number').join(' ') || undefined;
}

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
    let output = '', errors = '', settled = false;
    const stop = () => void killTree(child);
    const timer = setTimeout(stop, 20_000);
    const finish = (error?: Error) => { if (settled) return; settled=true; clearTimeout(timer); signal.removeEventListener('abort', stop); error ? reject(error) : resolve(output); };
    signal.addEventListener('abort', stop, {once:true});
    if (signal.aborted) stop();
    child.stdin!.end(); child.stderr!.setEncoding('utf8'); child.stdout!.setEncoding('utf8');
    child.stderr!.on('data', chunk => { errors = (errors + chunk).slice(-16_000); });
    child.stdout!.on('data', chunk => { output += chunk; if (output.length > MAX_OUTPUT) stop(); });
    child.once('error', () => finish(Error('No se pudo ejecutar Antigravity CLI.')));
    child.once('close', code => finish(code === 0 && !signal.aborted ? undefined : Error(
      !signal.aborted && /not authenticated|sign[ -]?in|log[ -]?in|authentication required|unauthenticated/i.test(errors)
        ? 'Antigravity necesita iniciar sesión con Google.'
        : 'No se pudo consultar la sesión de Antigravity CLI.'
    )));
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
      // The native CLI keeps one Google account in the OS keyring for the whole
      // computer: there is no second account beside it. Switching means /logout
      // and a new login in its own terminal, offered as exactly that.
      return this.models.length ? {...base, status:'ready', authMethods:[{id:'google-switch',label:'Cambiar de cuenta de Google'}], version, models:this.models, defaultModel:this.models[0]?.id, detail:'Conectado mediante la CLI oficial y tu sesión existente. Los modelos provienen de agy models.'}
        : {...base,status:'signed-out',authMethods:[{id:'google-browser',label:'Iniciar sesión con Google'}],detail:'Conectá tu cuenta de Google desde Syka.'};
    } catch (error) {
      const signedOut = error instanceof Error && /necesita iniciar sesión/.test(error.message);
      return {...base,status:signedOut?'signed-out':'error',authMethods:[{id:'google-browser',label:'Iniciar sesión con Google'}],detail:signedOut?'Conectá tu cuenta de Google para comprobar los modelos de Antigravity.':'No se pudieron comprobar los modelos de Antigravity. Reintentá la comprobación o revisá la conexión.'};
    }
  }
  async authenticate(env: HostEnv, methodId: string, signal: AbortSignal, hooks?: import('./harness').AuthHooks): Promise<void> {
    if (methodId !== 'google-browser' && methodId !== 'google-switch') throw Error('Método de conexión no soportado.');
    // The official interactive CLI owns browser authorization and the OS keyring.
    // Headless mode cannot initiate login; do not send a model prompt here.
    await runCliLogin({ provider: 'antigravity', command: this.config.command, args: this.config.args ?? [], cwd: this.config.profileDir, env: env.env, signal, hooks, terminal: true, verify: async () => {
      const status = (await this.probe(env, signal)).status;
      if (status !== 'ready' && status !== 'signed-out') throw Error('No se pudo comprobar la sesión de Antigravity. Reintentá cuando vuelva la conexión.');
      return status === 'ready';
    } });
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
  private mcpNamespace: string;
  constructor(config: Config, options: OpenOptions, profile: string, models: string[]) {
    this.config=config; this.options=options; this.profile=profile; this.models=models;
    const previous = options.resume && 'antigravityCli' in options.resume ? options.resume.antigravityCli : undefined;
    this.mcpNamespace = previous?.mcpNamespace && /^syka_[a-f0-9]{12}$/.test(previous.mcpNamespace) ? previous.mcpNamespace : 'syka_' + randomUUID().replaceAll('-', '').slice(0, 12);
    this.resume = {antigravityCli:{sessionId:previous?.sessionId ?? '',profile,mcpNamespace:this.mcpNamespace}};
  }
  send(text: string, model: string, emit: Emit, effort?: string, fast?: boolean): Promise<TurnOutcome> {
    if (this.active || this.closed || !this.models.includes(model) || effort || fast) return Promise.resolve({status:'failed',error:'Sesión ocupada o modelo/opción no anunciado por Antigravity CLI.'});
    this.cancelled = false;
    this.active = this.run(text, model, emit).catch((error): TurnOutcome => {
      harnessTraceFor(this.options)?.error(error);
      return this.cancelled ? {status:'interrupted'} : {status:'failed',error:agyFailureMessage(model,[error instanceof Error ? error.message : '']) ?? `Antigravity (${model}): no se pudo iniciar o completar la conexión de la CLI. No se cambió de modelo.`};
    }).finally(() => {this.active=null;});
    return this.active;
  }
  private async run(text: string, model: string, emit: Emit): Promise<TurnOutcome> {
    const trace = harnessTraceFor(this.options);
    const bridge = await startEditorToolBridge(this.options);
    // Google prefixes server and tool names. Keep the resulting function name
    // under the model's 64-character limit or tools disappear from discovery.
    // The native conversation remembers tool names. Preserve their namespace
    // across turns and native resume; only the ephemeral endpoint changes.
    const name = this.mcpNamespace;
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
      // Keep temporary discovery rules scoped to this session's local servers;
      // the process flag below supplies the full access selected for Syka.
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
      // Official headless mode otherwise soft-denies terminal/file tools without
      // a visible permission prompt, including native preview captures on E:.
      const args = [...(this.config.args ?? []), '--input-format','stream-json','--output-format','stream-json','--dangerously-skip-permissions','--model',model];
      if (cursor) args.push('--conversation',cursor);
      const child = spawn(this.config.command,args,{cwd:this.options.cwd,env:this.options.env.env,windowsHide:true,shell:false,stdio:'pipe'});
      this.child=child;
      return await new Promise<TurnOutcome>(resolve => {
        let buffer='', result: TurnOutcome | undefined, terminal=false, settled=false, timedOut=false, oversized=false;
        let finalResponse: string | undefined;
        const toolDiagnostics: string[] = [], terminalDiagnostics: string[] = [];
        const assistant = new Map<number, Extract<Item,{kind:'assistant'}>>();
        const tools = new Map<number, string>();
        const timer=setTimeout(()=>{timedOut=true;void killTree(child);},30*60_000);
        child.stderr!.setEncoding('utf8');
        let stderr = '';
        child.stderr!.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
        child.stdin!.on('error',()=>{}); child.stdout!.setEncoding('utf8');
        const processLine = (line: string) => {
          let message: any; try {message=JSON.parse(line);} catch {return;}
          if (terminal) return;
          if (message.event==='init' && typeof message.conversation_id==='string') this.resume={antigravityCli:{sessionId:message.conversation_id,profile:this.profile,mcpNamespace:this.mcpNamespace}};
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
              const diagnostic = errorText(step.tool_info?.error);
              if (diagnostic) {toolDiagnostics.push(diagnostic.slice(0,4000));if(toolDiagnostics.length>12)toolDiagnostics.shift();}
              trace?.nativeTool(String(step.step_index),name,'antigravity_cli',completed?(step.state==='ERROR'||step.tool_info?.error?'failed':'done'):'running',step.tool_info?.output ?? step.tool_info?.error,step.tool_info?.input ?? step.tool_info?.arguments);
              if(diagnostic)trace?.error(diagnostic);
              const item: Item={id,kind:'tool',name,title:name,status:completed?(step.state==='ERROR'||step.tool_info?.error?'failed':'done'):'running',output:truncateDetail(typeof step.tool_info?.output==='string'?step.tool_info.output:typeof step.tool_info?.error?.message==='string'?step.tool_info.error.message:undefined)};
              emit({type:completed?'item.completed':'item.started',item});
            }
          }
          if (message.event==='result') {
            terminal=true;
            const data=message.result ?? {};
            if (typeof data.conversation_id==='string') this.resume={antigravityCli:{sessionId:data.conversation_id,profile:this.profile,mcpNamespace:this.mcpNamespace}};
            const diagnostic = errorText(data.error ?? message.error);
            if (diagnostic) terminalDiagnostics.push(diagnostic.slice(0,4000));
            const tokens = tokenCounts(data.usage, 'agy');
            if (tokens && 'antigravityCli' in this.resume) emit({ type: 'usage.reported', usage: { sessionId: this.resume.antigravityCli.sessionId, kind: 'cumulative', tokens, model, historical: !!cursor } });
            if (data.status==='SUCCESS' && !diagnostic && typeof data.response==='string' && data.response.trim()) finalResponse=data.response;
            result=this.cancelled || ['CANCELED','INTERRUPTED'].includes(data.status) ? {status:'interrupted'} : finalResponse ? {status:'completed'} : {status:'failed',error:agyFailureMessage(model,terminalDiagnostics.length?terminalDiagnostics:toolDiagnostics) ?? `Antigravity (${model}) terminó sin una respuesta final confirmada. No se cambió de modelo.`};
            child.stdin!.end();
          }
        };
        child.stdout!.on('data',chunk=>{
          buffer+=chunk;
          if (buffer.length>MAX_OUTPUT) {oversized=true;void killTree(child);return;}
          let end; while ((end=buffer.indexOf('\n'))>=0) {const line=buffer.slice(0,end);buffer=buffer.slice(end+1);processLine(line);}
        });
        const finish=(exitCode?: number|null)=>{
          if(settled)return;settled=true;
          clearTimeout(timer);if(buffer.trim()&&!oversized)processLine(buffer);this.child=null;
          // Ignore startup's transient silent-auth warnings. Only native terminal
          // failures can replace the generic result; never echo raw stderr.
          const failures=stderr.split(/\r?\n/).filter(line=>/agent executor error:|run ended with error|^error:/i.test(line));
          const terminalFailure=agyFailureMessage(model,[...terminalDiagnostics,...failures]);
          const diagnostic=terminalFailure ?? agyFailureMessage(model,toolDiagnostics);
          const outcome:TurnOutcome=this.cancelled?{status:'interrupted'}:timedOut?{status:'failed',error:`Antigravity (${model}): la CLI superó el tiempo de espera. No se reintentó automáticamente.`}:oversized?{status:'failed',error:`Antigravity (${model}): la CLI excedió el límite de salida admitido. No se confirmó el resultado.`}:terminalFailure?{status:'failed',error:terminalFailure}:exitCode!==undefined&&exitCode!==null&&exitCode!==0?{status:'failed',error:diagnostic ?? `Antigravity (${model}): la CLI terminó con un error de ejecución. No se confirmó el resultado.`}:result?.status==='completed'?result:diagnostic?{status:'failed',error:diagnostic}:result ?? {status:'failed',error:`La conexión de Antigravity (${model}) terminó sin confirmar el resultado.`};
          if(outcome.status==='completed'&&finalResponse)emit({type:'item.completed',item:{id:[...assistant.values()].at(-1)?.id ?? newItemId('agy-final'),kind:'assistant',text:finalResponse,phase:'final'}});
          if(outcome.error)trace?.error(outcome.error);
          resolve(outcome);
        };
        child.once('error',()=>finish(1)); child.once('close',finish);
        const instructions=[this.options.instructions,`Los únicos MCP vigentes para este turno son: ${Object.keys(owned).join(', ')}. Son las herramientas locales del proyecto. Si el historial menciona otros servidores syka_*, ya no están disponibles: descubrí las herramientas de estos servidores vigentes y no reutilices nombres anteriores.`,text].filter(Boolean).join('\n\n');
        const request=JSON.stringify({event:'user',message:{content:instructions}})+'\n';
        trace?.payload('antigravity_cli','instructions',this.options.instructions);
        trace?.payload('antigravity_cli','user',text);
        trace?.payload('antigravity_cli','wire_request',request);
        trace?.instructions('per_invocation_unverified_persistence');
        child.stdin!.write(request);
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
