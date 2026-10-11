import {createSignal,For} from 'solid-js';
import {DashboardSurfaceSection} from './shared';
import {Button} from '@/components/ui/button';

const storageKey='syka:dictation:v1:local';
export function DictationSettings(){
 const [shortcut,setShortcut]=createSignal(localStorage.getItem(storageKey+':shortcut')??'Alt+Shift+V');
 const [capturing,setCapturing]=createSignal(false);
 const [history,setHistory]=createSignal<Array<{id:string;text:string;at:string}>>((()=>{try{return JSON.parse(localStorage.getItem(storageKey)??'[]');}catch{return [];}})());
 return <DashboardSurfaceSection title="Dictado de voz">
   <p class="text-sm text-muted-foreground">Usa la misma cuenta de Groq que la transcripción. El texto se agrega al borrador.</p>
   <div class="flex items-center gap-3 py-3"><span class="text-sm">Atajo</span><Button variant="secondary" onClick={()=>setCapturing(true)}>{shortcut()}</Button></div>
   {capturing()&&<input autofocus class="rounded border p-2 text-sm" aria-label="Atajo de dictado" placeholder="Alt o Ctrl + tecla" readOnly onKeyDown={event=>{event.preventDefault();event.stopPropagation();if(event.key==='Escape'){setCapturing(false);return;}if((!event.ctrlKey&&!event.altKey)||['Control','Alt','Shift','Meta'].includes(event.key))return;const next=[event.ctrlKey?'Ctrl':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',event.metaKey?'Meta':'',event.key.toUpperCase()].filter(Boolean).join('+');localStorage.setItem(storageKey+':shortcut',next);setShortcut(next);setCapturing(false);}}/>}
   <div class="flex items-center justify-between py-3"><span class="text-sm">Últimos dictados · guardados localmente</span><Button variant="secondary" onClick={()=>{localStorage.removeItem(storageKey);setHistory([]);}}>Borrar historial</Button></div>
   <For each={history()}>{entry=><article class="border-t py-2 text-sm"><time class="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString('es-AR')}</time><p>{entry.text}</p></article>}</For>
 </DashboardSurfaceSection>;
}
