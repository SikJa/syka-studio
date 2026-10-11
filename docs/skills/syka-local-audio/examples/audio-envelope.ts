export type SpeechSpan = { start: number; end: number };
export type AudioEnvelopeOptions = {
  duration: number; start?: number; sourceIn?: number; playbackRate?: number;
  speech?: SpeechSpan[]; baselineDb?: number; duckDb?: number;
  attack?: number; hold?: number; release?: number; fadeIn?: number; fadeOut?: number;
};
export type AudioPoint = { timelineTime: number; sourceTime: number; volumeDb: number };

/** Native editable duck/fade curve. Speech spans and clip start share the timeline clock. */
export function audioEnvelope(options: AudioEnvelopeOptions): AudioPoint[] {
  const {duration,start=0,sourceIn=0,playbackRate=1,speech=[],baselineDb=-16,duckDb=-27,
    attack=.15,hold=.08,release=.35,fadeIn=.2,fadeOut=.5}=options;
  if(![duration,start,sourceIn,playbackRate,baselineDb,duckDb,attack,hold,release,fadeIn,fadeOut].every(Number.isFinite)
    ||duration<=0||start<0||sourceIn<0||playbackRate<=0||duckDb>baselineDb
    ||[attack,hold,release,fadeIn,fadeOut].some(x=>x<0)||fadeIn+fadeOut>duration
    ||speech.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start))throw Error('Invalid audio envelope');
  const end=start+duration;
  const spans=speech.filter(s=>s.end+hold+release>start&&s.start-attack<end).map(s=>({...s})).sort((a,b)=>a.start-b.start);
  const merged:SpeechSpan[]=[];
  for(const span of spans){const previous=merged.at(-1);if(previous&&span.start-attack<=previous.end+hold+release)previous.end=Math.max(previous.end,span.end);else merged.push(span);}
  const times=new Set([start,end]);
  if(fadeIn)times.add(start+fadeIn);if(fadeOut)times.add(end-fadeOut);
  for(const span of merged)for(const t of [span.start-attack,span.start,span.end+hold,span.end+hold+release])if(t>start&&t<end)times.add(t);
  const gainAt=(t:number)=>{
    let duck=baselineDb;
    for(const s of merged){
      if(t<s.start-attack||t>s.end+hold+release)continue;
      const amount=t<s.start?(attack?(t-s.start+attack)/attack:1):t<=s.end+hold?1:release?1-(t-s.end-hold)/release:0;
      duck=Math.min(duck,baselineDb+(duckDb-baselineDb)*Math.max(0,Math.min(1,amount)));
    }
    let fade=0;
    if(fadeIn&&t<start+fadeIn)fade=-80*(1-(t-start)/fadeIn);
    if(fadeOut&&t>end-fadeOut)fade=Math.min(fade,-80*(t-end+fadeOut)/fadeOut);
    return Math.max(-96,duck+fade);
  };
  return [...times].sort((a,b)=>a-b).map(t=>({timelineTime:t,sourceTime:sourceIn+(t-start)*playbackRate,volumeDb:gainAt(t)}));
}
