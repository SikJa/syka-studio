import { describe, expect, it } from 'vitest';
import type { Item } from '@diffusionstudio/agent-chat';
import { visibleTranscriptItems, transcriptPresentation, currentActivity, publicProgressSummary } from './transcript-visibility';

describe('transient turn activity', () => {
  it('keeps native image generation at its conversation position with public progress, including after completion',()=>{
    const trace: Item[]=[{id:'u',kind:'user',text:'generá una imagen'},
      {id:'summary',kind:'reasoning',summary:true,text:'Voy a preparar una portada.'},
      {id:'comment',kind:'assistant',phase:'commentary',text:'Preparando la portada.'},
      {id:'image',kind:'tool',name:'imageGeneration',title:'Generar imagen',status:'running'},
      {id:'private',kind:'reasoning',text:'never expose'}];
    expect(visibleTranscriptItems(trace,true).map(i=>i.id)).toEqual(['u','comment','image']);
    expect(currentActivity([trace[3]])).toEqual({label:'Generando imagen',text:''});
    trace[3]={...trace[3] as Extract<Item,{kind:'tool'}>,status:'done'};
    trace.push({id:'final',kind:'assistant',phase:'final',text:'Listo.'});
    expect(visibleTranscriptItems(trace,false).map(i=>i.id)).toEqual(['u','image','final']);
    expect(trace).toHaveLength(6);
  });
  const items: Item[] = [
    { id: 'u1', kind: 'user', text: 'antes' },
    { id: 'r1', kind: 'reasoning', text: 'actividad anterior' },
    { id: 'a1', kind: 'assistant', text: 'resultado anterior' },
    { id: 'u2', kind: 'user', text: 'ahora' },
    { id: 'r2', kind: 'reasoning', text: 'actividad actual' },
    { id: 'a2', kind: 'assistant', text: 'resultado actual' },
  ];
  it('separates current activity from the durable messages while running', () => {
    expect(visibleTranscriptItems(items, true).map(x => x.id)).toEqual(['u1','a1','u2']);
    expect(transcriptPresentation(items, true).activity.map(x=>x.id)).toEqual(['r2','a2']);
  });
  it('retains messages and hides activity on completion and reopen without deleting history', () => {
    expect(visibleTranscriptItems(items, false).map(x => x.id)).toEqual(['u1','a1','u2','a2']);
    expect(items).toHaveLength(6);
  });
  it('hides legacy intermediate assistant updates after tools and on reopen', () => {
    const legacy: Item[] = [
      {id:'u',kind:'user',text:'creá la skill'},
      {id:'progress',kind:'assistant',text:'Voy a guardar el borrador'},
      {id:'tool',kind:'tool',name:'mcp',title:'syka_skills',status:'done'},
      {id:'final',kind:'assistant',text:'Borrador guardado'},
    ];
    expect(visibleTranscriptItems(legacy,false).map(x=>x.id)).toEqual(['u','final']);
    expect(legacy).toHaveLength(4);
  });
  it('respects explicit phases, including commentary-only interrupted turns', () => {
    const explicit: Item[] = [{id:'u',kind:'user',text:'editá'},
      {id:'comment',kind:'assistant',text:'Voy a revisar',phase:'commentary'},
      {id:'answer',kind:'assistant',text:'Resultado',phase:'final'},
      {id:'late',kind:'tool',name:'tool',title:'Tool',status:'done'}];
    expect(visibleTranscriptItems(explicit,false).map(x=>x.id)).toEqual(['u','answer']);
    expect(visibleTranscriptItems(explicit.slice(0,2),false).map(x=>x.id)).toEqual(['u','comment']);
  });
  it('does not restore previous activity when a new turn starts', () => {
    const restarted:Item[]=[...items,{id:'u3',kind:'user',text:'seguí'}];
    expect(transcriptPresentation(restarted,true).activity).toEqual([]);
    expect(visibleTranscriptItems(restarted,true).map(x=>x.id)).toEqual(['u1','a1','u2','a2','u3']);
  });
  it('preserves a legacy final answer when a subagent completes after it', () => {
    const late:Item[]=[{id:'u',kind:'user',text:'revisá'},
      {id:'progress',kind:'assistant',text:'Voy a revisar'},
      {id:'answer',kind:'assistant',text:'Resultado final'},
      {id:'subagent',kind:'tool',name:'subagentActivity',title:'Subagent complete',status:'done'}];
    expect(visibleTranscriptItems(late,false).map(x=>x.id)).toEqual(['u','answer']);
  });
  it('keeps failures and questions visible while activity is transient', () => {
    const trace:Item[]=[{id:'u',kind:'user',text:'editá'},
      {id:'c',kind:'assistant',text:'Voy a revisar',phase:'commentary'},
      {id:'n',kind:'notice',level:'error',text:'No se pudo guardar'},
      {id:'q',kind:'question',questions:[],answers:null}];
    expect(visibleTranscriptItems(trace,false).map(x=>x.id)).toEqual(['u','c','n','q']);
  });
  it('uses public activity labels without exposing internal tool names or outputs', () => {
    expect(currentActivity([{id:'r',kind:'reasoning',text:'private reasoning'}]).text).not.toContain('private');
    expect(currentActivity([{id:'t',kind:'tool',name:'syka_read_source',title:'syka_read_source',status:'running',output:'secret output'}])).toEqual({label:'Revisando archivos',text:''});
    expect(currentActivity([{id:'w',kind:'tool',name:'webSearch',title:'Search',status:'running'}])).toEqual({label:'Consultando la web',text:''});
    expect(currentActivity([],true)).toEqual({label:'Esperando tu respuesta',text:''});
  });
  it('hides public summaries on final answer, keeps sources and durable events',()=>{
    const trace:Item[]=[{id:'u',kind:'user',text:'editá'},
      {id:'private',kind:'reasoning',text:'not a public summary'},
      {id:'summary',kind:'reasoning',text:'Voy a comparar las fuentes.',summary:true},
      {id:'web',kind:'tool',name:'webSearch',title:'Buscar en la web',detail:'Hermes Index metodología',status:'done'},
      {id:'shell',kind:'tool',name:'commandExecution',title:'Run',status:'done'},
      {id:'answer',kind:'assistant',text:'Guardado',phase:'final'}];
    expect(visibleTranscriptItems(trace,false).map(i=>i.id)).toEqual(['u','web','answer']);
    expect(visibleTranscriptItems(trace.slice(0,-1),true).map(i=>i.id)).toEqual(['u','web']);
    expect(visibleTranscriptItems(trace,true).map(i=>i.id)).toEqual(['u','web','answer']);
    expect(currentActivity([trace[2]]).text).toBe('Voy a comparar las fuentes.');
    expect(trace).toHaveLength(6);
  });
  it('uses a brief public Spanish summary without exposing English or private thoughts', () => {
    expect(publicProgressSummary('Investigating internal details in English.')).toBe('');
    expect(publicProgressSummary('Voy a revisar el audio. Luego viene un párrafo largo.')).toBe('Voy a revisar el audio.');
    expect(publicProgressSummary('Estoy revisando ' + 'el proyecto '.repeat(100)).length).toBeLessThanOrEqual(221);
    expect(currentActivity([{id:'r',kind:'reasoning',text:'Voy a revelar pensamiento privado.'}]).text).toBe('Analizando el proyecto');
  });
});
