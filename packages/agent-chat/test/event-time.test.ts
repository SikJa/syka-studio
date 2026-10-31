import { describe,it,expect } from 'vitest';
import { timestampEvent } from '../src/host/event-time';
import { reduce,emptyTranscript } from '../src/reduce';
describe('durable message times',()=>{
  it('keeps the first receipt while the reply streams and completes',()=>{
    const started=timestampEvent({type:'item.started',item:{id:'a',kind:'assistant',text:''}},[],1000);
    let transcript=reduce(emptyTranscript(),started);
    transcript=reduce(transcript,{type:'item.delta',itemId:'a',text:'Hola'});
    const done=timestampEvent({type:'item.completed',item:{id:'a',kind:'assistant',text:'Hola'}},transcript.items,3000);
    expect(reduce(transcript,done).items[0]).toMatchObject({createdAt:1000,completedAt:3000,text:'Hola'});
  });
  it('timestamps a new user turn but never invents timestamps while replaying legacy events',()=>{
    const event={type:'turn.started' as const,turnId:'t',model:'m',user:{id:'u',kind:'user' as const,text:'Hola'}};
    expect(reduce(emptyTranscript(),timestampEvent(event,[],2000)).items[0]?.createdAt).toBe(2000);
    expect(reduce(emptyTranscript(),event).items[0]?.createdAt).toBeUndefined();
  });
});
