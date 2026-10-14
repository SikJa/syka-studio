/** Local presentation cues only. They never edit a project or report progress. */
export type MascotRect = {x:number; y:number; width:number; height:number};
export type MascotSlot = {x:number; y:number; size:number};
export type MascotCue = {id:number; projectId:string; createdAt:number} & (
  {kind:'timeline'} | {kind:'reference'; origin:MascotRect}
);
export const MASCOT_JOURNEY_MS = 3000;
const EVENT = 'syka:mascot-cue';
let serial = 0;
let recent: MascotCue | undefined;

export function emitMascotCue(projectId:string, target:{kind:'timeline'}|{kind:'reference';origin:MascotRect}) {
  const cue:MascotCue = {...target,projectId,id:++serial,createdAt:Date.now()};
  recent=cue;
  window.dispatchEvent(new CustomEvent<MascotCue>(EVENT,{detail:cue}));
}
export function isFreshMascotCue(cue:MascotCue,projectId:string,now=Date.now()) {
  return cue.projectId===projectId && now>=cue.createdAt && now-cue.createdAt<2000;
}
/** A short replay window lets the chat mount after using a library reference. */
export function subscribeMascotCues(listener:(cue:MascotCue)=>void) {
  const receive=(event:Event)=>listener((event as CustomEvent<MascotCue>).detail);
  window.addEventListener(EVENT,receive);
  if(recent)listener(recent);
  return ()=>window.removeEventListener(EVENT,receive);
}

const smooth=(value:number)=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
function arc(from:MascotSlot,to:MascotSlot,p:number) {
  const t=smooth(p),u=1-t;
  const ax=from.x+from.size/2,ay=from.y+from.size/2,bx=to.x+to.size/2,by=to.y+to.size/2;
  const cx=(ax+bx)/2,cy=Math.min(ay,by)-Math.min(110,Math.abs(bx-ax)*.18+40);
  const size=from.size+(to.size-from.size)*t;
  return {x:u*u*ax+2*u*t*cx+t*t*bx-size/2,y:u*u*ay+2*u*t*cy+t*t*by-size/2,size};
}
export function sampleMascotJourney(from:MascotSlot,target:MascotSlot,home:MascotSlot,elapsed:number) {
  const ms=Math.max(0,elapsed);
  if(ms<800)return {...arc(from,target,ms/800),phase:'outbound' as const,done:false};
  if(ms<2200)return {...target,phase:'action' as const,done:false};
  return {...arc(target,home,(ms-2200)/800),phase:'return' as const,done:ms>=MASCOT_JOURNEY_MS};
}
export function mascotJourneyActivity(kind:MascotCue['kind'],phase:'outbound'|'action'|'return') {
  return kind==='reference'?(phase==='outbound'?'thinking':'reference'):'editing';
}

/** Full target visibility is required; don't fly to hidden/scrolled controls. */
export function isMascotTargetVisible(rect:MascotRect,viewport:{width:number;height:number}) {
  return [rect.x,rect.y,rect.width,rect.height].every(Number.isFinite) && rect.width>0 && rect.height>0
    && rect.x>=0 && rect.y>=0 && rect.x+rect.width<=viewport.width && rect.y+rect.height<=viewport.height;
}

export function mascotRectsOverlap(a:MascotRect,b:MascotRect,gap=0) {
  return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
}
/** Pick a clear neighbour of the reference, never the reference itself.
 * If the interface has no room, omit the decorative trip. */
export function referenceMascotSlot(origin:MascotRect,viewport:{width:number;height:number},obstacles:readonly MascotRect[]=[],size=60):MascotSlot|undefined {
  const gap=12,cx=origin.x+(origin.width-size)/2,cy=origin.y+(origin.height-size)/2;
  const candidates=[{x:origin.x-size-gap,y:cy},{x:origin.x+origin.width+gap,y:cy},
    {x:cx,y:origin.y+origin.height+gap},{x:cx,y:origin.y-size-gap}];
  for(const candidate of candidates){
    const rect={...candidate,width:size,height:size};
    if(isMascotTargetVisible(rect,viewport)&&![origin,...obstacles].some(block=>mascotRectsOverlap(rect,block,4)))return {...candidate,size};
  }
}
