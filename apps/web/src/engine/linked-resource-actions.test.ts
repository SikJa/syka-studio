import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetLibrary } from '@diffusionstudio/assets';
import type { World } from 'koota';
const mocks = vi.hoisted(() => ({ insert: vi.fn(() => ({})), newScene: vi.fn(() => ({})), command: vi.fn((fn: () => unknown) => fn()) }));
vi.mock('@diffusionstudio/runtime', () => ({ Computed:'computed',FrameRate:'fps',Library:'library',Root:'root',Source:'source',
  getActiveEntity:(world: {scene:unknown})=>world.scene,
  store:(world:{time:number})=>({localTimeInSeconds:{1:world.time}}),
}));
vi.mock('./insert-asset', () => ({insertAsset:mocks.insert}));
vi.mock('./new-scene', () => ({insertAssetsInNewScene:mocks.newScene}));
vi.mock('./history', () => ({getEditHistory:()=>({command:mocks.command})}));
import { insertLinkedResource } from './linked-resource-actions';

const sound = {kind:'sounds' as const,path:'F:/public/whoosh.wav',title:'Barrido corto 3',audioType:'sfx' as const};
function fixture() {
  const asset = {type:'AUDIO',path:'assets/sounds/whoosh.wav',duration:0.62};
  const importFile = vi.fn(async()=>({assets:[asset],failed:[]}));
  const library = {import:importFile} as unknown as AssetLibrary;
  const scene = {id:()=>1,isAlive:()=>true};
  const root = {get:()=>({value:'project.tsx'})};
  const world = {scene:scene as unknown,time:3.25,currentLibrary:library,
    get(trait:string) {return trait==='root'?root:trait==='library'?this.currentLibrary:trait==='fps'?{value:30}:undefined;}};
  return {world,library,asset,importFile};
}
beforeEach(()=>{vi.clearAllMocks();mocks.insert.mockReturnValue({});mocks.newScene.mockReturnValue({});});
describe('portable linked audio insertion',()=>{
  it('captures the playhead before import and uses the same native path for clicks and exact-time drops',async()=>{
    const f=fixture();
    let finish!:()=>void;
    f.importFile.mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({assets:[f.asset],failed:[]});}));
    const pending=insertLinkedResource(f.world as unknown as World,f.library,sound);
    f.world.time=9;finish();await pending;
    expect(f.importFile).toHaveBeenCalledWith([sound.path],{folder:'sounds',copy:true});
    expect(mocks.insert).toHaveBeenLastCalledWith(f.world,f.asset,expect.objectContaining({start:3.25,volume:-12,label:'Barrido corto 3',parent:f.world.scene}));
    await insertLinkedResource(f.world as unknown as World,f.library,sound,{start:6.5});
    expect(mocks.insert).toHaveBeenLastCalledWith(f.world,f.asset,expect.objectContaining({start:6.5,volume:-12}));
    expect(mocks.command).toHaveBeenCalledTimes(2);
  });
  it('creates a first scene with the same gain when dropping into an empty project',async()=>{
    const f=fixture();f.world.scene=undefined;
    await insertLinkedResource(f.world as unknown as World,f.library,{...sound,audioType:'music'},{start:2});
    expect(mocks.newScene).toHaveBeenCalledWith(f.world,[f.asset],expect.objectContaining({start:2,volume:-16}));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('does not insert into a different scene or a newly opened project after an import finishes',async()=>{
    for(const change of ['scene','project']){
      const f=fixture();let finish!:()=>void;
      f.importFile.mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({assets:[f.asset],failed:[]});}));
      const pending=insertLinkedResource(f.world as unknown as World,f.library,sound,{start:2});
      if(change==='scene')f.world.scene={id:()=>3,isAlive:()=>true};else f.world.currentLibrary={} as AssetLibrary;
      finish();await expect(pending).rejects.toThrow('Cambió el proyecto o la escena');
    }
    expect(mocks.insert).not.toHaveBeenCalled();expect(mocks.newScene).not.toHaveBeenCalled();
  });
  it('rejects invalid times before copying and leaves source untouched if import fails',async()=>{
    const f=fixture();
    for(const start of [NaN,Infinity,-Infinity,-1,Number.MAX_VALUE])
      await expect(insertLinkedResource(f.world as unknown as World,f.library,sound,{start})).rejects.toThrow('tiempo');
    expect(f.importFile).not.toHaveBeenCalled();
    f.importFile.mockRejectedValueOnce(Error('Archivo no disponible'));
    await expect(insertLinkedResource(f.world as unknown as World,f.library,sound)).rejects.toThrow('Archivo no disponible');
    expect(mocks.insert).not.toHaveBeenCalled();expect(mocks.command).not.toHaveBeenCalled();
  });
});
