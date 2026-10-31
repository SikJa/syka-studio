import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentComposer} from '../src/mirel-chat/features/agents/agent-composer';
import {SykaOrganicMascot} from '../src/mirel-chat/features/agents/syka-organic-mascot';
import '../src/agent-chat/mirel-adapter.css';
const style=document.createElement('style');
style.textContent=`:root{color-scheme:dark;--primary:#bd2451;--color-primary:#bd2451;--background:#111;--color-background:#111;--foreground:#eee;--color-foreground:#eee;--muted:#aaa;--color-muted-foreground:#aaa;--color-border:#333;--color-border-strong:#444;--radius:10px}body{margin:0;background:#111;color:#eee;font:14px Arial}main{padding:28px;max-width:900px;margin:auto}h1{font-size:20px}h2{font-size:14px;font-weight:500}.actors{display:flex;flex-wrap:wrap;gap:28px;align-items:center}.actors>section{display:grid;justify-items:center;gap:16px}.chat{max-width:470px;margin-top:35px}.syka-mirel-composer{--surface-active:#303030;--surface:#1c1c1c;--text:#eee;--text-soft:#ccc;--muted:#aaa;--line-strong:#444;--agent-composer-accent:#bd2451}.log{font-size:12px;color:#aaa;min-height:20px}`;
document.head.append(style);
const models=[{id:'codex:sol',label:'GPT-6.1-Sol',providerLabel:'Codex',description:'Cuenta de ChatGPT'},
 {id:'codex:astra',label:'GPT-6-Astra',providerLabel:'Codex',description:'Cuenta de ChatGPT'},
 {id:'claude:opus',label:'Claude Opus',providerLabel:'Claude',description:'Claude Code'},
 {id:'hermes:some-long-route',label:'Modelo con nombre largo para verificar legibilidad',providerLabel:'Hermes',description:'Cuenta configurada en Hermes'},
 {id:'opencode:deepseek',label:'DeepSeek Flash',providerLabel:'OpenCode',description:'Proveedor configurado en OpenCode'}];
function App(){
 const [text,setText]=useState(''),[selected,setSelected]=useState(models[0].id),[effort,setEffort]=useState('medium');
 return React.createElement('main',{'data-ui':true},React.createElement('h1',null,'Syka · Controles del editor'),
 React.createElement('div',{className:'actors'},...(['idle','thinking','question','ready'] as const).map(activity=>React.createElement('section',{key:activity},
 React.createElement('h2',null,activity),...([32,48,96] as const).map(size=>React.createElement(SykaOrganicMascot,{key:size,activity,size,paused:true,finish:'accent',accent:'#bd2451'}))))),
 React.createElement('div',{className:'chat syka-mirel-composer'},React.createElement(AgentComposer,{value:text,onChange:setText,onSubmit:()=>{},attachments:[],onRemoveAttachment:()=>{},models,selectedModelId:selected,onModelChange:setSelected,efforts:[{id:'low',label:'Bajo'},{id:'medium',label:'Medio'},{id:'high',label:'Alto'}],selectedEffortId:effort,onEffortChange:setEffort,onConfigureProviders:()=>{},placeholder:'¿Qué querés cambiar en este video?',ariaLabel:'Mensaje de prueba'})),
 React.createElement('p',{className:'log','data-testid':'selected'},selected+' · '+effort));
}
createRoot(document.getElementById('root')!).render(React.createElement(App));
