import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  length: 0, end: 108000, context: null as unknown, silent: false, buses: 0,
  computed: {} as any, playback: { playing: [], loop: [], speed: [] } as any,
  portClosed: vi.fn(),
}));
vi.mock('@diffusionstudio/runtime', () => ({
  Root:'root', Computed:'computed', Playback:'playback', FrameRate:'fps', RenderSurface:'surface',
  AudioEngine:'audio-engine', AudioPlayback:'audio-playback', Workarea:'workarea', Silent:'silent',
  ChildOf:()=>{}, Geometry:'geometry', Paint:'paint', FramePromises:'promises', Time:'time', AudioBusHandle:'audio-bus',
  Position:'position', Offset:'offset', Rotation:'rotation', Scale:'scale', Skew:'skew',
  setActive:()=>{}, framesToSeconds:(frames:number,fps:number)=>frames/fps, isScene:()=>true,
  assert:(value:unknown,message:string)=>{if(!value)throw Error(message);},
  store:(_world:unknown,trait:string)=>trait==='computed'?state.computed:trait==='playback'?state.playback:{contextOffsetInSeconds:[],timelineOffsetInSeconds:[]},
  assetSystem:()=>{}, playbackSystem:()=>{}, motionSystem:()=>{}, transformSystem:()=>{}, renderSystem:()=>{},
  AudioBus:class{constructor(){state.buses++;}connect(){}},
}));
vi.mock('mediabunny', () => ({
  canEncodeVideo:async()=>true, canEncodeAudio:async()=>true,
  Output:class{state='pending'; addAudioTrack(){} addVideoTrack(){} async start(){} async cancel(){this.state='canceled';}},
  CanvasSource:class{}, AudioSampleSource:class{}, AudioSample:class{},
}));
vi.mock('./buffer', () => ({TargetBuffer:{create:async()=>({target:{}})}}));
vi.mock('./format', () => ({createOutputFormat:async()=>({})}));
vi.mock('./utils', () => ({computeOutputSize:()=>({scale:1,width:1920,height:1080}),createRenderEventDetail:()=>({})}));
import { createEncoder } from './encoder';

const scene={id:()=>0,has:()=>false,get:()=>undefined,add:()=>{},set:()=>{}};
let canvas:unknown;
const world=()=>({query:()=>[scene],add:(trait:string)=>{if(trait==='silent')state.silent=true;},
  get:(trait:string)=>trait==='fps'?{value:30}:trait==='surface'?{canvas}:null,
  set:(trait:string,value:any)=>{if(trait==='audio-engine')state.context=value.context;},
}) as any;
beforeEach(()=>{
  state.length=0; state.end=108000; state.context=null; state.silent=false; state.buses=0; state.portClosed.mockClear();
  state.computed={width:[1920],height:[1080],end:[state.end],localTimeInSeconds:[],localTime:[]};
  vi.stubGlobal('HTMLCanvasElement',class{}); canvas=new HTMLCanvasElement();
  const node=()=>({connect:()=>{},disconnect:()=>{}});
  vi.stubGlobal('OfflineAudioContext',class{
    audioWorklet={addModule:async()=>{}}; destination={};
    constructor(_channels:number,length:number){state.length=length;}
    createGain=node;
  });
  vi.stubGlobal('AudioWorkletNode',class{
    port={onmessage:null,close:state.portClosed}; connect(){} disconnect(){}
  });
});
afterEach(()=>vi.unstubAllGlobals());

describe('export memory preparation',()=>{
  it('does not allocate one hour of PCM or construct audio buses for video-only exports',async()=>{
    const encoder=await createEncoder(world(),{audio:{enabled:false}} as any);
    expect(state.length).toBe(1); expect(state.context).toBeNull(); expect(state.silent).toBe(true); expect(state.buses).toBe(0);
    encoder.cancel(); expect(await encoder.render()).toEqual({type:'canceled'});
    expect(state.portClosed).toHaveBeenCalledOnce();
  });
  it('retains offline audio when the user enables it',async()=>{
    state.computed.end=[90];
    const encoder=await createEncoder(world(),{audio:{enabled:true,sampleRate:48000}} as any);
    expect(state.length).toBe(144000); expect(state.context).not.toBeNull(); expect(state.silent).toBe(false); expect(state.buses).toBe(1);
    encoder.cancel(); await encoder.render(); expect(state.portClosed).toHaveBeenCalledOnce();
  });
  it('rejects an empty workarea before opening an offline context or output',async()=>{
    state.computed.end=[0];
    await expect(createEncoder(world(),{} as any)).rejects.toThrow('No hay fotogramas');
    expect(state.length).toBe(0);
  });
});
