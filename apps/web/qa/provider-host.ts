import { AgentHost } from '../../../packages/agent-chat/src/host/host';
import { ChatStore } from '../../../packages/agent-chat/src/host/store';
import { startServer } from '../../../packages/agent-chat/src/host/server';
import { readHarnessSettings, saveHarnessSettings } from '../../../packages/agent-chat/src/host/external-harnesses';
import type { Harness } from '../../../packages/agent-chat/src/host/harness';
import { HARNESS_IDS, HARNESS_LABELS } from '../../../packages/agent-chat/src/protocol';
import { acpModels } from '../../../packages/agent-chat/src/host/acp-models';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
// This host has no real provider, OAuth credentials, inference or editor turn.
const root=resolve(process.env.SYKA_QA_PROVIDER_ROOT ?? '.runtime/providers-ui-qa');await mkdir(root,{recursive:true});
const signed=new Set(['codex','antigravity']);
const hermesModels=acpModels({models:{currentModelId:'openai-codex:gpt-5.6-sol',availableModels:[
  {modelId:'openai-codex:gpt-5.6-sol',name:'ChatGPT or Codex Subscription · gpt-5.6-sol',_meta:{syka:{reasoningEfforts:['none','low','medium','high','xhigh','max'],defaultEffort:'medium'}}},
  {modelId:'nous:hermes-4-70b',name:'Nous Portal · Hermes 4 70B',_meta:{syka:{reasoningEfforts:['low','medium','high'],defaultEffort:'medium'}}},
]}},'hermes');
const methods=(id:string)=>id==='hermes'?[{id:'hermes-nous-device',label:'Nous Portal · código (simulado)'},{id:'hermes-chatgpt-device',label:'ChatGPT / Codex · código (simulado)'}]:[{id:'qa-login',label:'Login simulado QA'}];
const harnesses:Harness[]=HARNESS_IDS.map(id=>({id,
  async authMethods(){return methods(id);},
  async probe(){return {id,label:HARNESS_LABELS[id],status:signed.has(id)?'ready':'signed-out',detail:'QA simulada: cuenta y catálogo ficticios; sin OAuth ni inferencia.',models:signed.has(id)?(id==='codex'?['GPT-6.1-Sol','GPT-6-Astra','GPT-6-Sol','GPT-6-Luna','GPT-5.6-Sol','GPT-5.6-Terra','GPT-5.6-Luna','GPT-5.5'].map(label=>({id:label,label,efforts:['low','medium','high','xhigh','max','ultra'],defaultEffort:'medium',supportsFast:true})):id==='hermes'?hermesModels:[{id:'qa-model',label:'Modelo de prueba'}]):[],authMethods:methods(id)};},
  async authenticate(_env,methodId,signal,hooks){
    if(!hooks||!methods(id).some(method=>method.id===methodId))throw Error('Método QA no disponible');
    const url=methodId==='hermes-nous-device'?'https://portal.nousresearch.com/device?syka_qa=simulado':'https://auth.openai.com/codex/device?syka_qa=simulado';
    hooks.update({phase:'waiting',message:'SIMULADO: enlace y código de prueba; no se inicia OAuth.',url,userCode:'QA12-AB34'});
    const approval=await hooks.requestCode('QA simulada: escribí APROBAR para simular la autorización.');
    if(signal.aborted)throw Error('Conexión QA cancelada');
    if(approval!=='APROBAR')throw Error('Aprobación QA inválida');
    signed.add(id);
  },
  async open(){throw Error('QA no ejecuta turnos');}
}));
const configFile=resolve(root,'harnesses.json'),profilesRoot=resolve(root,'profiles');
const host=new AgentHost({store:new ChatStore(resolve(root,'chats')),harnesses,env:Promise.resolve({env:{},extraDirs:[]}),mcp:null,version:'qa',providerSettings:{read:()=>readHarnessSettings(configFile,profilesRoot),save:async entry=>({settings:await saveHarnessSettings(configFile,profilesRoot,entry),harness:harnesses.find(h=>h.id===entry.id)!})}});
await host.start();const server=await startServer({agentHost:host,host:'127.0.0.1',port:0,token:randomBytes(32).toString('base64url'),allowedOrigins:(process.env.SYKA_QA_PROVIDER_ORIGINS ?? 'http://localhost:5188,http://127.0.0.1:5188,http://127.0.0.1:5197').split(','),log:()=>{}});
await writeFile(resolve(root,'endpoint.json'),JSON.stringify({url:server.url,pid:process.pid}));console.log('QA host ready (simulated accounts)');
const stop=async()=>{await host.stop();await server.close();process.exit(0)};process.on('SIGTERM',stop);process.on('SIGINT',stop);

