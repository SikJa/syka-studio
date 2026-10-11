import { createEffect, createSignal, onCleanup } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { requireGroqTranscription, transcribeWithGroq } from '@/lib/syka-transcription';

/** Microphone -> existing local Groq pipeline. No key enters the renderer. */
export function createGroqDictation(chatKey: () => string, append: (text: string) => void) {
  const [available,setAvailable]=createSignal(false),[recording,setRecording]=createSignal(false),[transcribing,setTranscribing]=createSignal(false),[error,setError]=createSignal<string|null>(null);
  let recorder:MediaRecorder|undefined,stream:MediaStream|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  let generation=0,alive=true,abort:AbortController|undefined;
  const release=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=undefined;};
  const cancel=()=>{generation++;abort?.abort();if(recorder?.state==='recording')recorder.stop();release();setRecording(false);setTranscribing(false);};
  createEffect(()=>{chatKey();cancel();setError(null);void mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS,undefined).then(s=>{if(alive)setAvailable(s.configured);}).catch(()=>{if(alive)setAvailable(false);});});
  const toggle=async()=>{
    if(recording()){recorder?.stop();return;}
    if(transcribing())return;
    const current=++generation,key=chatKey();setError(null);
    try{
      await requireGroqTranscription();
      const input=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!alive||generation!==current){input.getTracks().forEach(t=>t.stop());return;}
      stream=input;const mimeType=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
      recorder=new MediaRecorder(input,mimeType?{mimeType}:undefined);const chunks:Blob[]=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{
        if(!alive||generation!==current||key!==chatKey())return;release();
        setRecording(false);setTranscribing(true);abort=new AbortController();
        try{const segments=await transcribeWithGroq(new Blob(chunks,{type:recorder!.mimeType}),abort.signal);if(alive&&generation===current&&key===chatKey())append(segments.map(s=>s.text).join(' '));}
        catch(reason){if(alive&&generation===current)setError(reason instanceof Error?reason.message:String(reason));}
        finally{if(alive&&generation===current)setTranscribing(false);}
      };
      recorder.onerror=()=>{if(generation===current){cancel();setError('No se pudo grabar el micrófono.');}};
      recorder.start();setRecording(true);timer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),120000);
    }catch(reason){release();if(alive&&generation===current){setRecording(false);setError(reason instanceof Error?reason.message:String(reason));}}
  };
  onCleanup(()=>{alive=false;cancel();});
  return {available,recording,transcribing,error,toggle};
}
