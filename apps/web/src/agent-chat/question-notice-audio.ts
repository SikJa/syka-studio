const RATE=48000;
let context:AudioContext|undefined;
let users=0;
const unlock=()=>{try{context??=new AudioContext({sampleRate:RATE});void context.resume().catch(()=>{});}catch{/* Audio is optional when the device has no output. */}};

/** Unlock during Send/Enter, before the asynchronous host request opens. */
export function installQuestionAudio() {
  if(users++===0){document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,true);}
  return()=>{if(--users===0){document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);}};
}

/** Original two-note notification; no downloaded media, network or paid provider. */
export function playQuestionNotice() {
  if(window.desktop)return false; // The native overlay owns desktop sounds, once per request.
  if(localStorage.getItem('syka:chat-question-sound')==='off'||context?.state!=='running')return false;
  const buffer=context.createBuffer(1,Math.round(RATE*.23),RATE),samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)for(const [offset,hz] of [[0,880],[.085,1174.659]]){
    const t=i/RATE-offset;if(t<0||t>.14)continue;
    samples[i]+=.032*Math.min(1,t/.007)*Math.pow(Math.max(0,1-t/.14),2.5)*(Math.sin(2*Math.PI*hz*t)+.12*Math.sin(4*Math.PI*hz*t));
  }
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>source.disconnect();source.start();return true;
}
