import {createSignal} from 'solid-js';
import type {ModelRef} from '@diffusionstudio/agent-chat';
import {send,summaryOf,chatState,transcriptOf} from './store';
export type LocalTask={id:string;projectId:string;cwd:string;prompt:string;runAt:number;model:ModelRef;status:'scheduled'|'paused'|'running'|'done'|'failed'|'missed';chatId?:string;error?:string};
const key='syka:scheduled-tasks:v1';
const load=():LocalTask[]=>{try{return JSON.parse(localStorage.getItem(key)??'[]').map((task:LocalTask)=>({...task,status:task.status==='running'?'missed':task.status}));}catch{return [];}};
const [tasks,setTasks]=createSignal<LocalTask[]>(load());
let context:{projectId:string;cwd:string;model:ModelRef|null;busy:boolean}|null=null;
const save=(next:LocalTask[])=>{localStorage.setItem(key,JSON.stringify(next));setTasks(next);};
export const localTasks=tasks;
export function setScheduleContext(next:typeof context){context=next;}
export function addLocalTask(prompt:string,runAt:number){if(!context?.model)throw Error('Elegí un modelo conectado.');if(!prompt.trim()||!Number.isFinite(runAt)||runAt<=Date.now())throw Error('Indicá una tarea y una fecha futura.');save([...tasks(),{id:crypto.randomUUID(),projectId:context.projectId,cwd:context.cwd,model:context.model,prompt:prompt.trim(),runAt,status:'scheduled'}]);}
export function updateLocalTask(id:string,action:'pause'|'resume'|'delete'|'run') {const task=tasks().find(t=>t.id===id);if(task?.status==='running')throw Error('Detené la sesión antes de cambiar una tarea en ejecución.');save(action==='delete'?tasks().filter(t=>t.id!==id):tasks().map(t=>t.id!==id?t:{...t,status:action==='pause'?'paused':'scheduled',runAt:action==='run'?Date.now():Math.max(Date.now()+1000,t.runAt)}));}
async function tick(){
 if(new URLSearchParams(window.location.hash.split("?")[1]??"").get("chatWindow")==="1")return;
 for(const task of tasks()){
  if(task.status==='running'&&task.chatId){const chat=summaryOf(task.projectId,task.chatId);if(chat&&chat.status!=='running'&&chat.status!=='waiting')save(tasks().map(t=>t.id===task.id?{...t,status:transcriptOf(task.chatId??null).items.some(i=>i.kind==='notice'&&i.level==='error')?'failed':'done'}:t));}
 }
 if(!context||!window.location.hash.startsWith('#/projects/'+encodeURIComponent(context.projectId))||Object.values(chatState.sending).some(Boolean)||(chatState.lists[context.projectId]??[]).some(c=>c.status==='running'||c.status==='waiting')||tasks().some(t=>t.status==='running'))return;
 const due=tasks().find(t=>t.projectId===context!.projectId&&t.status==='scheduled'&&t.runAt<=Date.now());if(!due)return;
 save(tasks().map(t=>t.id===due.id?{...t,status:'running'}:t));
 try{const chatId=await send({projectId:due.projectId,cwd:due.cwd,chatId:null,text:due.prompt,attachments:[],model:due.model});save(tasks().map(t=>t.id===due.id?{...t,chatId}:t));}
 catch(reason){save(tasks().map(t=>t.id===due.id?{...t,status:'failed',error:String(reason)}:t));}
}
const onStorage=(event:StorageEvent)=>{if(event.key===key){try{setTasks(JSON.parse(event.newValue??'[]'));}catch{}}};window.addEventListener('storage',onStorage);
const scheduleTimer=setInterval(()=>void tick(),1000);
if(import.meta.hot)import.meta.hot.dispose(()=>{clearInterval(scheduleTimer);window.removeEventListener('storage',onStorage);});
