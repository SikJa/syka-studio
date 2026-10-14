import {describe,expect,it} from 'vitest';
import {isFreshMascotCue,isMascotTargetVisible,mascotJourneyActivity,mascotRectsOverlap,referenceMascotSlot,sampleMascotJourney} from './mascot-journey';
const from={x:20,y:150,size:28},target={x:600,y:420,size:60},home={x:100,y:40,size:28};
describe('bounded editor mascot journeys',()=>{
  it('leaves its current slot, holds at the action and returns to the latest home',()=>{
    expect(sampleMascotJourney(from,target,home,0)).toMatchObject({...from,phase:'outbound',done:false});
    expect(sampleMascotJourney(from,target,home,1500)).toMatchObject({...target,phase:'action',done:false});
    expect(sampleMascotJourney(from,target,home,3000)).toMatchObject({...home,phase:'return',done:true});
  });
  it('takes an arc rather than crossing controls in a straight line',()=>{
    const mid=sampleMascotJourney(from,target,home,400);
    expect(mid.y+mid.size/2).toBeLessThan((from.y+14+target.y+30)/2);
    for(let t=0;t<=4000;t+=16)expect(JSON.stringify(sampleMascotJourney(from,target,home,t))).not.toMatch(/NaN|Infinity/);
  });
  it('collects the reference at arrival and only carries it on the way back',()=>{
    expect(mascotJourneyActivity('reference','outbound')).toBe('thinking');
    expect(mascotJourneyActivity('reference','action')).toBe('reference');
    expect(mascotJourneyActivity('reference','return')).toBe('reference');
    expect(mascotJourneyActivity('timeline','action')).toBe('editing');
  });
  it('never replays a stale reference or borrows another project cue',()=>{
    const cue={id:1,projectId:'a',createdAt:1000,kind:'timeline' as const};
    expect(isFreshMascotCue(cue,'a',1100)).toBe(true);
    expect(isFreshMascotCue(cue,'a',3000)).toBe(false);
    expect(isFreshMascotCue(cue,'b',1100)).toBe(false);
    expect(isFreshMascotCue(cue,'a',900)).toBe(false);
  });
  it('rejects targets outside the visible editor',()=>{
    const viewport={width:1000,height:700};
    expect(isMascotTargetVisible({x:30,y:40,width:64,height:32},viewport)).toBe(true);
    for(const x of [-1,990,NaN])expect(isMascotTargetVisible({x,y:40,width:64,height:32},viewport)).toBe(false);
    expect(isMascotTargetVisible({x:30,y:40,width:0,height:32},viewport)).toBe(false);
  });
  it('docks outside the complete reference card, including its title and action',()=>{
    const card={x:700,y:150,width:160,height:120};
    const slot=referenceMascotSlot(card,{width:1000,height:700})!;
    expect(slot).toEqual({x:628,y:180,size:60});
    expect(mascotRectsOverlap({...slot,width:60,height:60},card,4)).toBe(false);
  });
  it('tries another side when a neighbouring control occupies the first slot',()=>{
    const card={x:700,y:150,width:160,height:120};
    expect(referenceMascotSlot(card,{width:1000,height:700},[{x:620,y:170,width:80,height:80}])?.x).toBe(872);
  });
  it('omits the trip when every adjacent slot is outside the window or blocked',()=>{
    expect(referenceMascotSlot({x:0,y:0,width:160,height:120},{width:160,height:120})).toBeUndefined();
    expect(referenceMascotSlot({x:700,y:150,width:160,height:120},{width:1000,height:700},[{x:0,y:0,width:1000,height:700}])).toBeUndefined();
  });
});
