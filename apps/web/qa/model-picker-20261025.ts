import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentComposer} from '../src/mirel-chat/features/agents/agent-composer';
import {PROVIDER_LOGOS} from '../src/agent-chat/provider-catalog';
import '../src/agent-chat/mirel-adapter.css';
const style=document.createElement('style');style.textContent=`:root{--color-foreground:#eee;--color-muted-foreground:#aaa;--color-border:#333}body{margin:0;background:#111;color:#eee;font:14px Arial}main{width:min(600px,calc(100% - 32px));margin:180px auto 0}h1{font-size:16px;margin-bottom:18px}.syka-mirel-composer{--surface-active:#303030;--surface:#1c1c1c;--text:#eee;--text-soft:#ccc;--muted:#aaa;--line-strong:#444;--agent-composer-accent:#bd2451}`;document.head.append(style);
const names=['GPT-6.1-Sol','GPT-6-Astra','GPT-6-Sol','GPT-6-Luna','GPT-5.6-Sol','GPT-5.6-Terra','GPT-5.6-Luna','Modelo largo de prueba para revisar el ajuste del texto'];
const models=names.map((label,i)=>({id:'codex:'+i,label,providerLabel:'Codex',description:'Codex',logoSvg:PROVIDER_LOGOS.codex}));
function App(){const [text,setText]=useState(''),[selected,setSelected]=useState(models[0].id),[effort,setEffort]=useState('medium');return React.createElement(React.Fragment,null,
React.createElement('h1',null,'Selector aislado · modelos de prueba'),React.createElement('div',{className:'syka-mirel-composer'},React.createElement(AgentComposer,{value:text,onChange:setText,onSubmit:()=>{},models,selectedModelId:selected,onModelChange:setSelected,efforts:[{id:'low',label:'Bajo'},{id:'medium',label:'Medio'},{id:'high',label:'Alto'}],selectedEffortId:effort,onEffortChange:setEffort,onConfigureProviders:()=>{},placeholder:'¿Qué querés cambiar en este video?'})),React.createElement('output',{'data-selected':true,'data-effort':effort},selected));}
createRoot(document.getElementById('root')!).render(React.createElement(App));
