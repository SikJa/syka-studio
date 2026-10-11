/** @jsxImportSource react */
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { AgentProjectsState } from './agent-projects';
export function ChatProjectPicker({state,conversationId,title,onAssigned,onError}:{state:AgentProjectsState;conversationId:string;title:string;onAssigned():void;onError():void}) {
  const [open,setOpen]=useState(false);
  const selected=state.assignments[conversationId]??'';
  const options=[{id:'',name:'Sin proyecto',archived:false},...state.projects.filter(project=>!project.archived||project.id===selected)];
  return <div className="agent-project-move"><span>Proyecto</span>
    <button className="agent-project-choice" aria-label={`Proyecto de ${title}`} aria-expanded={open} disabled={!state.ready||state.busy} onClick={()=>setOpen(value=>!value)}><span>{options.find(option=>option.id===selected)?.name??'Sin proyecto'}</span><ChevronDown size={13}/></button>
    {open&&<div className="agent-project-options" role="group" aria-label="Elegir proyecto">{options.map(option=><button key={option.id} disabled={state.busy||option.archived} aria-pressed={selected===option.id} onClick={()=>{
      if(option.id===selected){setOpen(false);return;}
      void state.change({action:'assign',conversationId,projectId:option.id||null}).then(onAssigned).catch(onError);
    }}><span>{option.name}{option.archived?' (archivado)':''}</span>{selected===option.id&&<Check size={13}/>}</button>)}</div>}
  </div>;
}
