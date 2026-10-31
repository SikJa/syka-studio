const RATE=48000;
/** Original, quiet two-note UI cue; no remote media or provider. */
export function noticeSamples(){
 const samples=new Float32Array(Math.round(RATE*.23));
 for(let i=0;i<samples.length;i++){
  const t=i/RATE;
  for(const [offset,hz] of [[0,880],[.085,1174.659]]){
   const local=t-offset;if(local<0||local>.14)continue;
   const attack=Math.min(1,local/.007),decay=Math.pow(Math.max(0,1-local/.14),2.5);
   samples[i]+=.032*attack*decay*(Math.sin(2*Math.PI*hz*local)+.12*Math.sin(4*Math.PI*hz*local));
  }
 }
 return samples;
}
let context:AudioContext|undefined,played=0;
export async function unlockNoticeAudio(){
 try{context??=new AudioContext({sampleRate:RATE});if(context.state!=='running')await context.resume();return context.state==='running';}catch{return false;}
}
export function playNotice(){
 if(!context||context.state!=='running')return false;
 const samples=noticeSamples(),buffer=context.createBuffer(1,samples.length,RATE);buffer.copyToChannel(samples,0);
 const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>source.disconnect();source.start();played++;return true;
}
export function noticeAudioStatus(){return{state:context?.state??'locked',played,durationSeconds:.23};}
