import {describe,expect,it} from 'vitest';
import {createMascotActor, mascotFaceLayout, mascotFaceMaterial, type MascotActivity} from './syka-mascot';

describe('Syka orb expression layer',()=>{
  it('returns the same frame after rewinding past a changed expression',()=>{
    const actor=createMascotActor(),first=actor.sample('idle',1);
    actor.sample('ready',5);actor.sample('ready',6);
    expect(actor.sample('idle',1)).toEqual(first);
  });
  it('holds a static frame under reduced motion, with the requested expression',()=>{
    const actor=createMascotActor();actor.sample('idle',100);
    expect(actor.sample('question',101,true)).toEqual(actor.sample('question',999,true));
    expect(actor.sample('question',999,true)).not.toEqual(actor.sample('ready',999,true));
  });
  it('does not contaminate another canvas actor',()=>{
    const a=createMascotActor(),b=createMascotActor();
    a.sample('question',1);a.sample('ready',2);
    expect(b.sample('idle',3)).toEqual(createMascotActor().sample('idle',3));
  });
  it('keeps valid geometry for every task across a full minute',()=>{
    const actor=createMascotActor();
    const activities:MascotActivity[]=['idle','thinking','editing','captions','audio','review','question','notification','reference','ready','error'];
    for(let t=0;t<60;t+=.2){
      const frame=actor.sample(activities[Math.floor(t)%activities.length],t);
      expect(JSON.stringify(frame)).not.toMatch(/NaN|Infinity/);
      expect(frame.eyes).toHaveLength(2);
    }
  });
  it('keeps the mouth below both eyes during thinking/listening, morphs, blinks and pointer tracking',()=>{
    const actor=createMascotActor();
    for(let t=0;t<60;t+=.05){
      const activity:MascotActivity=t%6<3?'thinking':'question';
      const pointer=t%10<7?{x:Math.sin(t),y:Math.cos(t)}:null;
      const layout=mascotFaceLayout(actor.sample(activity,t,false,pointer));
      expect(layout.mouthTop-layout.eyeBottom).toBeGreaterThanOrEqual(2.99);
      expect(layout.mouthBottom).toBeLessThanOrEqual(65.001);
    }
  });
  it('tracks the pointer, releases it and ignores tracking under reduced motion',()=>{
    const actor=createMascotActor();actor.sample('idle',1,false,{x:-1,y:-1});
    const left=actor.sample('idle',2,false,{x:-1,y:-1});
    actor.sample('idle',3,false,{x:1,y:1});
    expect(actor.sample('idle',4,false,{x:1,y:1})).not.toEqual(left);
    actor.sample('idle',5,false,null);
    expect(actor.sample('idle',6,false,null)).toEqual(createMascotActor().sample('idle',6));
    expect(actor.sample('idle',10,true,{x:1,y:1})).toEqual(actor.sample('idle',20,true,null));
  });
  it('changes the entire facial material with the accent while neutral finishes stay neutral',()=>{
    expect(mascotFaceMaterial('accent','#008CFF')).not.toEqual(mascotFaceMaterial('accent','#43BE95'));
    expect(mascotFaceMaterial('accent','#43BE95').middle.toLowerCase()).toBe('#43be95');
    expect(mascotFaceMaterial('pearl','#008CFF')).toEqual(mascotFaceMaterial('pearl','#43BE95'));
    expect(mascotFaceMaterial('grok').middle).toBe(mascotFaceMaterial('grok').top);
  });
});
