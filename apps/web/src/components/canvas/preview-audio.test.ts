import {describe,it,expect,vi} from 'vitest';
import type {Entity,World} from 'koota';
import {AudioEngine,Mode} from '../../../../../packages/runtime/src/traits';
const state = vi.hoisted(()=>({volume:[-6,-6]}));
vi.mock('../../../../../packages/runtime/src/world/store',()=>({store:()=>({volume:state.volume})}));
vi.mock('../../../../../packages/runtime/src/queries/hierarchy',()=>({getParentNode:(entity:{id:()=>number})=>entity.id()===0 ? null : {}}));
import {AudioBus} from '../../../../../packages/runtime/src/media/audio-bus';
function bus(mode:string,volume:number,muted:boolean,id=0,authoredMute=false) {
  const node={gain:{value:1},connect:()=>{},disconnect:()=>{}};
  const context={createGain:()=>node};
  const world={get:(trait:unknown)=>trait===Mode ? {value:mode}:trait===AudioEngine ? {context,previewVolume:volume,previewMuted:muted}:undefined} as unknown as World;
  const entity={id:()=>id,has:()=>authoredMute} as unknown as Entity;
  const audio=new AudioBus(world,entity); audio.sync(); return node.gain.value;
}
describe('preview volume does not alter an export',()=>{
  it('applies monitor volume once, without compounding nested clip gain',()=>{
    expect(bus('realtime',.25,false)).toBeCloseTo(Math.pow(10,-6/20)*.25);
    expect(bus('realtime',.25,false,1)).toBeCloseTo(Math.pow(10,-6/20));
  });
  it('mutes monitoring but ignores preview settings offline',()=>{
    expect(bus('realtime',1,true)).toBe(0);
    expect(bus('capture',0,true)).toBeCloseTo(Math.pow(10,-6/20));
    expect(bus('capture',1,false,0,true)).toBe(0);
  });
});
