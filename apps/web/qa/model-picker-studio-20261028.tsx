import { createSignal, Show, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { HashRouter, Route } from '@solidjs/router';
import { Composer } from '../src/agent-chat/mirel-composer';
import { ChatSettings } from '../src/components/settings/chat';
import { mainBridge } from '../src/lib/ipc';
import { initializeAppearance, previewAccent } from '../src/lib/appearance/controller';
import { chatState } from '../src/agent-chat/store';
import type { ModelRef } from '@diffusionstudio/agent-chat';
import '../src/index.css';
import '../src/components/settings/settings.css';
import '../src/styles/light-mode.css';

// QA ONLY: exercises the actual Solid→React adapter against a test WS catalog.
// No credentials, inference, project edits or model fixtures enter the product.
window.desktop = {platform:'win32',on:()=>()=>{},send:()=>{}} as typeof window.desktop;
mainBridge.call = (async (channel: string) => {
  if(channel === 'agent-chat:endpoint') return {url:'ws://127.0.0.1:65498/studio-picker-qa'};
  if(channel.includes('groq')) return {configured:false};
  if(channel === 'window:is-fullscreen') return false;
  if(channel === 'syka:fonts') return {fonts:[]};
  throw Error('Unexpected fixture IPC: '+channel);
}) as typeof mainBridge.call;

function Fixture() {
  const [chat,setChat]=createSignal('terra');
  const [models,setModels]=createSignal<Record<string,ModelRef>>({terra:{harness:'codex',model:'gpt-6.1-terra',effort:'high'},sol:{harness:'codex',model:'gpt-6.1-sol',effort:'low',fast:true}});
  const [text,setText]=createSignal('');
  const [settings,setSettings]=createSignal(false);
  const [readonly,setReadonly]=createSignal(false);
  onMount(()=>{onCleanup(initializeAppearance());});
  Object.assign(window,{studioPickerQA:{models,chat,harnesses:()=>chatState.harnesses,setAccent:previewAccent,setTheme:(value:string)=>{document.documentElement.dataset.kbTheme=value;document.documentElement.classList.toggle('dark',value==='dark');}}});
  return <main class="studio-picker-fixture">
    <header><strong>Studio · Componentes reales, catálogo de prueba</strong><span>Sin inferencia ni cambios de proyectos</span></header>
    <nav><button onClick={()=>setChat('terra')}>Chat Terra</button><button onClick={()=>setChat('sol')}>Chat Sol</button><button onClick={()=>setSettings(v=>!v)}>Configuración del chat</button><button onClick={()=>setReadonly(v=>!v)}>Solo lectura</button></nav>
    <Show when={settings()}><section class="studio-fixture-settings"><ChatSettings/></section></Show>
    <section class="studio-fixture-composer"><h1>Prueba del selector en Studio</h1><Composer projectDir="qa-picker" chatKey={chat()} answering={readonly()} text={text()} attachments={[]} running={false} waiting={false} blocked={null} model={models()[chat()]} onText={setText} onAttachments={()=>{}} onModel={value=>setModels(old=>({...old,[chat()]:value}))} onSend={()=>{throw Error('No inference in UI fixture')}} onStop={()=>{}}/></section>
    <output>{JSON.stringify(models())}</output>
  </main>;
}
const style=document.createElement('style');style.textContent=`body{margin:0;background:var(--background);color:var(--foreground);font:13px Inter,Arial,sans-serif}.studio-picker-fixture{min-height:100vh;padding:24px;box-sizing:border-box}.studio-picker-fixture>header{display:flex;gap:14px;align-items:center}.studio-picker-fixture>header>span{color:var(--muted-foreground)}.studio-picker-fixture>nav{display:flex;gap:10px;margin-top:20px}.studio-picker-fixture>nav>button{padding:8px;border:1px solid var(--border);border-radius:8px}.studio-fixture-composer{width:min(680px,100%);margin:430px auto 0}.studio-fixture-composer h1{font-size:20px;margin:0 12px 20px}.studio-fixture-settings{max-width:800px;margin:20px auto}.studio-picker-fixture>output{display:block;font:11px monospace;white-space:pre-wrap;max-width:680px;margin:20px auto;color:var(--muted-foreground)}@media(max-width:500px){.studio-picker-fixture{padding:14px}.studio-picker-fixture>header{display:block}.studio-fixture-composer{margin-top:430px}}`;document.head.append(style);
render(()=><HashRouter><Route path="*" component={Fixture}/></HashRouter>,document.getElementById('root')!);
