/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { resolve } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodexHarness, appServerArgs } from "../src/host/codex";
import {chatInstructions} from '../src/host/harness';
import type { ChatEvent } from "../src/protocol";

const state = vi.hoisted(() => ({
  accountType: "chatgpt" as string | null,
  failMethod: "",
  calls: [] as { method: string; params: Record<string, unknown> }[],
  items: [] as Array<Record<string, unknown>>,
  notifications: [] as Array<{method:string;params:Record<string,unknown>}>,
  dynamic: [] as Array<Record<string, unknown>>,
  responses: [] as Array<{result?: {success:boolean;contentItems:{text?:string}[]};error?:unknown}>,
  metadata: {} as Record<string,Record<string,unknown>>,
  childCompletes: false,
  tiers: undefined as Array<{id:string}> | undefined,
  legacyTiers: undefined as string[] | undefined,
  holdTurn: false,
  completeWithQuestion: false,
}));

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  return {
    ...actual,
    spawn: () => {
      const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, pid: 12345 });
      child.stdin.on("data", (chunk: Buffer) => {
        const request = JSON.parse(chunk.toString()) as { id?: number; method: string; params: Record<string, unknown> };
        if (!request.id) return;
        if (!request.method) {
          state.responses.push(request as unknown as typeof state.responses[number]);
          if(state.responses.length===state.dynamic.length) child.stdout.write(JSON.stringify({method:'turn/completed',params:{threadId:'ephemeral-thread',turn:{id:'turn',status:'completed'}}})+'\n');
          return;
        }
        state.calls.push({ method: request.method, params: request.params });
        queueMicrotask(() => {
          if (request.method === state.failMethod) {
            child.stdout.write(JSON.stringify({ id: request.id, error: { code: -32603, message: "transport test failure" } }) + "\n");
            return;
          }
          const result = request.method === "initialize" ? { userAgent: "codex-cli/0.159.0" }
            : request.method === "account/read" ? { account: state.accountType ? { type: state.accountType } : null, requiresOpenaiAuth: true }
            : request.method === "model/list" ? { data: [{ id: "account-model", displayName: "Available model", isDefault: true,serviceTiers:state.tiers,additionalSpeedTiers:state.legacyTiers }, { id: "hidden-model", hidden: true }] }
            : (request.method === "thread/start" || request.method === "thread/resume") ? { thread: { id: "ephemeral-thread" } }
            : request.method === 'thread/read' ? {thread:{id:request.params.threadId,...state.metadata[String(request.params.threadId)]}}
            : { turn: { id: "turn" } };
          child.stdout.write(JSON.stringify({ id: request.id, result }) + "\n");
          if (request.method === "turn/start") queueMicrotask(() => {
            child.stdout.write(JSON.stringify({method:'thread/tokenUsage/updated',params:{threadId:'ephemeral-thread',turnId:'turn',tokenUsage:{last:{totalTokens:1200},total:{totalTokens:9000},modelContextWindow:32000}}})+'\n');
            for(const notification of state.notifications)child.stdout.write(JSON.stringify(notification)+'\n');
            for (const item of state.items) child.stdout.write(JSON.stringify({ method: "item/completed", params: { threadId: "ephemeral-thread", turnId: "turn", item } }) + "\n");
            if(state.childCompletes) {
              child.stdout.write(JSON.stringify({method:'item/completed',params:{threadId:'child',turnId:'child-turn',item:{id:'child-output',type:'agentMessage',phase:'final',text:'Child-only report'}}})+'\n');
              child.stdout.write(JSON.stringify({method:'turn/completed',params:{threadId:'child',turn:{id:'child-turn',status:'completed'}}})+'\n');
            }
            if(state.dynamic.length) {
              state.dynamic.forEach((params,index)=>child.stdout.write(JSON.stringify({id:700+index,method:'item/tool/call',params})+'\n'));
              if(state.completeWithQuestion) setTimeout(()=>child.stdout.write(JSON.stringify({method:'turn/completed',params:{threadId:'ephemeral-thread',turn:{id:'turn',status:'completed'}}})+'\n'),10);
            }
            else if (!state.holdTurn) child.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "ephemeral-thread", turn: { id: "turn", status: "completed" } } }) + "\n");
          });
          if (request.method === 'turn/interrupt') child.stdout.write(JSON.stringify({ method: 'turn/completed', params: { threadId: 'ephemeral-thread', turn: { id: 'turn', status: 'interrupted' } } }) + '\n');
        });
      });
      return child;
    },
  };
});

vi.mock("../src/host/env", async () => {
  const actual = await vi.importActual<typeof import("../src/host/env")>("../src/host/env");
  return { ...actual, resolveBinary: () => process.execPath, killTree: async (child: { emit(name: string, code: number): void }) => { child.emit("exit", 0); } };
});

const env = { env: {}, extraDirs: [] };
beforeEach(() => { state.calls = []; state.items = []; state.notifications=[]; state.accountType = "chatgpt"; state.failMethod = ""; state.dynamic=[];state.responses=[];state.metadata={};state.childCompletes=false;state.tiers=undefined;state.legacyTiers=undefined; state.holdTurn=false; state.completeWithQuestion=false; });

describe("Codex app-server bridge without provider calls", () => {
  it('counts only the main thread and verified descendants for project usage', async () => {
    state.metadata.child = { parentThreadId: 'ephemeral-thread' };
    state.notifications = ['child', 'unrelated'].map(threadId => ({ method: 'thread/tokenUsage/updated', params: { threadId, tokenUsage: { total: { totalTokens: 500 } } } }));
    const events: ChatEvent[] = [];
    const session = await new CodexHarness().open({ cwd: resolve('open-project'), model: 'account-model', env, mcp: null, emit() {} });
    try {
      await session.send('Fixture', 'account-model', event => events.push(event));
      expect(events.filter(e => e.type === 'usage.reported').map(e => e.type === 'usage.reported' && [e.usage.sessionId, e.usage.tokens.totalTokens])).toEqual([['ephemeral-thread', 9000], ['child', 500]]);
    } finally { await session.close(); }
  });
  it('keeps final export under user control without disabling native editor checks',()=>{
    const args=appServerArgs({},'http://127.0.0.1:3275/mcp');
    const enabled=JSON.parse(args.find(a=>a.startsWith('mcp_servers.syka.enabled_tools='))!.split('=')[1]);
    expect(enabled).not.toContain('export');
    expect(enabled).toEqual(expect.arrayContaining(['capture','check']));
    expect(chatInstructions(resolve('project'))).toContain('Export belongs to the user');
  });
  it('delivers public provider summaries instead of private content and keeps all web queries',async()=>{
    state.items=[{id:'r',type:'reasoning',summary:['Revisaré las fuentes antes de editar.'],content:['private content']},
      {id:'empty',type:'reasoning',content:['private content only']},
      {id:'search',type:'webSearch',action:{type:'search',queries:['Hermes Index methodology','Hermes Index cost']}}];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd:resolve('project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try{await session.send('Review sources','account-model',e=>events.push(e));
      const completed=events.filter(e=>e.type==='item.completed').map(e=>e.type==='item.completed'?e.item:null);
      expect(completed).toContainEqual({id:'r',kind:'reasoning',text:'Revisaré las fuentes antes de editar.',summary:true});
      expect(completed).toContainEqual({id:'empty',kind:'reasoning',text:'',summary:true});
      expect(completed.find(i=>i?.id==='search')).toMatchObject({detail:'Hermes Index methodology\nHermes Index cost'});
      expect(JSON.stringify(events)).not.toContain('private content');
      expect(state.calls.find(c=>c.method==='turn/start')?.params.summary).toBe('auto');
    }finally{await session.close();}
  });
  it('persists a streamed public summary when completion omits it and ignores private deltas',async()=>{
    state.notifications=[
      {method:'item/started',params:{threadId:'ephemeral-thread',item:{id:'r',type:'reasoning'}}},
      {method:'item/reasoning/textDelta',params:{threadId:'ephemeral-thread',itemId:'r',delta:'private delta'}},
      {method:'item/reasoning/summaryTextDelta',params:{threadId:'ephemeral-thread',itemId:'r',delta:'Resumen público.'}},
    ];
    state.items=[{id:'r',type:'reasoning'}];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd:resolve('project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try{await session.send('Revisá','account-model',e=>events.push(e));
      expect(events).toContainEqual({type:'item.delta',itemId:'r',text:'Resumen público.'});
      expect(events).toContainEqual({type:'item.completed',item:{id:'r',kind:'reasoning',text:'Resumen público.',summary:true}});
      expect(JSON.stringify(events)).not.toContain('private delta');
    }finally{await session.close();}
  });
  it('lets the model open a contextual question and waits for the user response',async()=>{
    state.dynamic=[{threadId:'ephemeral-thread',turnId:'turn',callId:'ask-format',tool:'syka_ask_user',arguments:{questions:[{id:'format',question:'¿Dónde lo vas a publicar?',options:[{label:'Horizontal'},{label:'Vertical'}]}]}}];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd:resolve('open-project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try{
      const turn=session.send('Podés armarme una pieza con esta referencia?','account-model',event=>events.push(event));
      await vi.waitFor(()=>expect(events.some(event=>event.type==='request.opened')).toBe(true));
      const request=events.find(event=>event.type==='request.opened');
      if(request?.type!=='request.opened')throw Error('Missing question');
      expect(state.responses).toHaveLength(0);
      expect(request.request.questions[0].question).toBe('¿Dónde lo vas a publicar?');
      session.respond(request.request.id,{answers:{format:['Horizontal, con mi captura de referencia.']}});
      await expect(turn).resolves.toEqual({status:'completed'});
      expect(state.responses[0].result?.success).toBe(true);
      expect(state.responses[0].result?.contentItems[0].text).toContain('Horizontal, con mi captura de referencia.');
      expect(events.some(event=>event.type==='item.completed'&&event.item.kind==='question')).toBe(true);
    }finally{await session.close();}
  });
  it('keeps an asynchronous question answerable after the provider ends its turn', async () => {
    state.completeWithQuestion=true;
    state.dynamic=[{threadId:'ephemeral-thread',turnId:'turn',callId:'late-question',tool:'syka_ask_user',arguments:{questions:[{id:'intent',question:'¿Qué te interesa de esta referencia?'}]}}];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd:resolve('open-project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try {
      await expect(session.send('Revisá esta referencia','account-model',event=>events.push(event))).resolves.toEqual({status:'completed'});
      const opened=events.find(event=>event.type==='request.opened');
      if(opened?.type!=='request.opened')throw Error('Missing question');
      expect(events.some(event=>event.type==='request.resolved')).toBe(false);
      expect(state.responses).toHaveLength(0);
      session.respond(opened.request.id,{answers:{intent:['Subtítulos y ritmo']}});
      await vi.waitFor(()=>expect(state.responses).toHaveLength(1));
      expect(state.responses[0].result?.contentItems[0].text).toContain('Subtítulos y ritmo');
    } finally {await session.close();}
  });
  it('routes the code graph dynamic tool and honestly reports an unconfigured host', async () => {
    state.dynamic = [{ threadId: 'ephemeral-thread', turnId: 'turn', callId: 'graph-status', tool: 'syka_code_graph', arguments: { action: 'status' } }];
    const session = await new CodexHarness().open({ cwd: resolve('open-project'), model: 'account-model', env, mcp: null, emit: () => {} });
    try {
      expect(state.calls.find(call => call.method === 'thread/start')!.params.dynamicTools).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'syka_code_graph' })]));
      await session.send('Read the code map status', 'account-model', () => {});
      expect(state.responses[0]?.result?.success).toBe(true);
      expect(JSON.parse(state.responses[0]!.result!.contentItems[0]!.text!)).toMatchObject({ status: { state: 'unavailable', current: false } });
    } finally { await session.close(); }
  });
  it('passes the current editor endpoint and project guard into the actual thread instructions', async () => {
    const session = await new CodexHarness().open({ cwd: resolve('open-project'), model: 'account-model', env, mcp: { name: 'syka', url: 'http://127.0.0.1:43278/mcp?client=chat' }, emit: () => {} });
    try {
      const start = state.calls.find(call => call.method === 'thread/start')!.params;
      expect(start.developerInstructions).toContain('http://127.0.0.1:43278/mcp?client=chat');
      expect(start.developerInstructions).toContain('confirm context.projectDir matches');
      expect(start.developerInstructions).toContain('Never scan ports');
    } finally { await session.close(); }
  });
  it('dispatches the advertised onboarding memory tool to its workspace implementation',async()=>{
    const cwd=await mkdtemp(resolve(tmpdir(),'syka-memory-routing-'));
    await writeFile(resolve(cwd,'package.json'),JSON.stringify({projectId:'memory-routing-project'}));
    state.dynamic=[{threadId:'ephemeral-thread',turnId:'turn',callId:'memory-read',tool:'syka_onboarding_memory',arguments:{action:'read',relevant:[]}}];
    const session=await new CodexHarness().open({cwd,model:'account-model',env,mcp:null,emit:()=>{}});
    try {
      const start=state.calls.find(call=>call.method==='thread/start')!.params;
      expect(start.dynamicTools).toEqual(expect.arrayContaining([expect.objectContaining({name:'syka_onboarding_memory'})]));
      await session.send('Read editing preferences','account-model',()=>{});
      expect(state.responses[0]?.result?.success).toBe(true);
      expect(JSON.parse(state.responses[0]!.result!.contentItems[0]!.text!)).toMatchObject({kind:'quoted-editing-data',projectId:'memory-routing-project',revision:0});
    } finally {await session.close();await rm(cwd,{recursive:true,force:true});}
  });
  it('uses the active turn id precondition for native steering and retains the running turn after a rejected insertion', async () => {
    state.holdTurn = true;
    const session = await new CodexHarness().open({ cwd: resolve('open-project'), model: 'account-model', env, mcp: null, emit: () => {} });
    try {
      const turn = session.send('Work', 'account-model', () => {});
      await vi.waitFor(() => expect(state.calls.some(call => call.method === 'turn/start')).toBe(true));
      await new Promise(resolve => setTimeout(resolve, 0));
      await session.steer!('Use the orb');
      expect(state.calls.find(call => call.method === 'turn/steer')?.params).toEqual({ threadId: 'ephemeral-thread', expectedTurnId: 'turn', input: [{ type: 'text', text: 'Use the orb' }] });
      state.failMethod = 'turn/steer';
      await expect(session.steer!('Rejected correction')).rejects.toThrow('transport test failure');
      expect(state.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
      await session.interrupt(); await expect(turn).resolves.toEqual({ status: 'interrupted' });
      await expect(session.steer!('Too late')).rejects.toThrow('todavía no admite');
    } finally { await session.close(); }
  });
  it('returns actual skill and reference contents to a verified descendant, despite child completion',async()=>{
    const cwd=await mkdtemp(resolve(tmpdir(),'syka-child-read-'));
    const docs=resolve(cwd,'docs'), profile=resolve(cwd,'profile'), skill=resolve(profile,'skills','qa-skill');
    await mkdir(resolve(docs,'reference','jsx'),{recursive:true});await mkdir(skill,{recursive:true});
    await writeFile(resolve(skill,'SKILL.md'),'# Reusable subtitles skill');
    await writeFile(resolve(docs,'reference','jsx','elements.md'),'# Elements reference');
    await writeFile(resolve(docs,'reference','jsx','rect.md'),'# Rect reference');
    state.metadata.child={parentThreadId:'ephemeral-thread'};state.childCompletes=true;
    state.dynamic=[{threadId:'child',turnId:'child-turn',callId:'skill-read',tool:'syka_skills',arguments:{action:'read',path:skill}},
      ...['elements','rect'].map(name=>({threadId:'child',turnId:'child-turn',callId:name,tool:'syka_read_reference',arguments:{path:`reference/jsx/${name}.md`}}))];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd,model:'account-model',env:{...env,env:{CODEX_HOME:profile,SYKA_REFERENCE_DOCS_DIR:docs}},mcp:null,emit:()=>{}});
    try {
      await expect(session.send('Read three documents','account-model',event=>events.push(event))).resolves.toEqual({status:'completed'});
      expect(state.responses).toHaveLength(3);
      for(const response of state.responses){expect(response.error).toBeUndefined();expect(response.result?.success).toBe(true);}
      expect(state.responses.map(response=>JSON.parse(response.result!.contentItems[0].text!).content)).toEqual(expect.arrayContaining(['# Reusable subtitles skill','# Elements reference','# Rect reference']));
      expect(events.some(event=>event.type==='item.completed'&&event.item.id==='child-output')).toBe(false);
    } finally {await session.close();await rm(cwd,{recursive:true,force:true});}
  });
  it('returns an explicit failure to unrelated threads instead of the opaque dynamic request error',async()=>{
    state.dynamic=[{threadId:'unrelated',turnId:'other',callId:'bad-read',tool:'syka_read_reference',arguments:{path:'reference/jsx/rect.md'}}];
    const session=await new CodexHarness().open({cwd:resolve('open-project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try {await session.send('Read','account-model',()=>{});expect(state.responses[0].error).toBeUndefined();expect(state.responses[0].result?.success).toBe(false);expect(state.responses[0].result?.contentItems[0].text).toContain('verified descendant');}
    finally{await session.close();}
  });
  it("preserves commentary and final phases instead of turning progress into answers", async () => {
    state.items=[{id:'progress',type:'agentMessage',phase:'commentary',text:'Voy a revisar'}, {id:'answer',type:'agentMessage',phase:'final',text:'Listo'}];
    const events:ChatEvent[]=[];
    const session=await new CodexHarness().open({cwd:resolve('open-project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try {
      await session.send('Revisá', 'account-model',event=>events.push(event));
      expect(events).toContainEqual({type:'item.completed',item:{id:'progress',kind:'assistant',phase:'commentary',text:'Voy a revisar'}});
      expect(events).toContainEqual({type:'item.completed',item:{id:'answer',kind:'assistant',phase:'final',text:'Listo'}});
    } finally {await session.close();}
  });
  it("lists only models available to the signed-in ChatGPT account", async () => {
    const result = await new CodexHarness().probe(env, new AbortController().signal);
    expect(result.status).toBe("ready");
    expect(result.models).toEqual([{ id: "account-model", label: "Available model",supportsFast:false }]);
    expect(result.defaultModel).toBe("account-model");
    expect(state.calls.find((call) => call.method === "account/read")!.params).toEqual({ refreshToken: false });
  });

  it("refuses API-key authentication and does not fall back to invented models", async () => {
    state.accountType = "apiKey";
    const result = await new CodexHarness().probe(env, new AbortController().signal);
    expect(result.status).toBe("signed-out");
    expect(result.models).toEqual([]);
    expect(state.calls.some((call) => call.method === "model/list")).toBe(false);
  });

  it('offers Fast only when the signed-in model catalog advertises it',async()=>{
    state.tiers=[{id:'fast'}];
    const harness=new CodexHarness();
    expect((await harness.probe(env,new AbortController().signal)).models[0].supportsFast).toBe(true);
    state.tiers=[{id:'ultrafast'}];
    expect((await harness.probe(env,new AbortController().signal)).models[0].supportsFast).toBe(false);
    state.tiers=undefined;state.legacyTiers=['fast'];
    expect((await harness.probe(env,new AbortController().signal)).models[0].supportsFast).toBe(true);
  });
  it('changes service tier independently of reasoning and explicitly resets it to Normal',async()=>{
    const session=await new CodexHarness().open({cwd:resolve('open-project'),model:'account-model',env,mcp:null,emit:()=>{}});
    try{
      await session.send('Fast','account-model',()=>{},'high',true);
      await session.send('Normal','account-model',()=>{},'high',false);
      const turns=state.calls.filter(call=>call.method==='turn/start');
      expect(turns[0].params).toMatchObject({effort:'high',serviceTier:'fast'});
      expect(turns[1].params).toMatchObject({effort:'high',serviceTier:null});
    }finally{await session.close();}
  });

  it("fails closed when the model probe fails", async () => {
    state.failMethod = "model/list";
    const result = await new CodexHarness().probe(env, new AbortController().signal);
    expect(result.status).toBe("error");
    expect(result.models).toEqual([]);
  });

  it("resumes a persistent project thread and keeps the same sandbox on turns", async () => {
    const cwd = resolve("open-project");
    const events: ChatEvent[] = [];
    const session = await new CodexHarness().open({ cwd, model: "account-model", env, mcp: null, resume: { codex: { threadId: "old-thread" } }, instructions: "Edit this project", previousConversation: "Quoted recent context", emit: (event) => events.push(event) });
    const start = state.calls.find((call) => call.method === "thread/resume")!.params;
    expect(start).toMatchObject({ cwd, modelProvider: "openai", runtimeWorkspaceRoots: [cwd], sandbox: "danger-full-access", ephemeral: false });
    expect(start.developerInstructions).toContain("Quoted recent context");
    expect(start.developerInstructions).toContain('no connected Syka MCP endpoint');
    expect(start.developerInstructions).toContain("media_transcribe");
    expect(start.developerInstructions).toContain("03 Assets reutilizables/Transcripciones");
    expect(start.developerInstructions).toContain("never invent speech or word timings");
    expect(start.dynamicTools).toEqual(expect.arrayContaining([expect.objectContaining({ name: "syka_read_transcript" })]));
    expect(state.calls.some((call) => call.method === "thread/resume")).toBe(true);
    await expect(session.send("Make a reversible edit", "account-model", event => events.push(event), "high")).resolves.toEqual({ status: "completed" });
    expect(events).toContainEqual({type:'context.updated',usage:{usedTokens:1200,maxTokens:32000}});
    expect(events).toContainEqual(expect.objectContaining({ type: 'usage.reported', usage: expect.objectContaining({ sessionId: 'ephemeral-thread', kind: 'cumulative', tokens: { totalTokens: 9000 } }) }));
    const turn = state.calls.find((call) => call.method === "turn/start")!.params;
    expect(turn).toMatchObject({ effort: "high", cwd, runtimeWorkspaceRoots: [cwd], sandboxPolicy: { type: "dangerFullAccess" } });
    await session.close();
  });

  it("waits for native image import and renders web/image items without duplicate callback rows", async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), "syka-rpc-image-"));
    const events: ChatEvent[] = [];
    state.items = [
      { id: "web", type: "webSearch", query: "official documentation", action: { type: "openPage", url: "https://docs.example" } },
      { id: "callback", type: "dynamicToolCall", tool: "syka_browser_read", status: "completed" },
      { id: "image", type: "imageGeneration", status: "completed", result: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=", failure: null },
    ];
    const session = await new CodexHarness().open({ cwd, model: "account-model", env, mcp: null, emit: () => {} });
    try {
      await session.send("Generate the requested image", "account-model", (event) => events.push(event));
      const tools = events.filter((event) => event.type === "item.completed" && event.item.kind === "tool").map((event) => event.type === "item.completed" ? event.item : null);
      expect(tools).toHaveLength(2);
      expect(tools[0]).toMatchObject({ name: "webSearch", title: "Abrir fuente" });
      expect(tools[1]).toMatchObject({ name: "imageGeneration", status: "done", images: [{ mediaType: "image/png" }] });
      expect(tools[1]?.kind === "tool" && tools[1].output).toContain("03 Assets reutilizables");
    } finally { await session.close(); await rm(cwd, { recursive: true, force: true }); }
  });
});
