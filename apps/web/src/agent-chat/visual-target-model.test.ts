import { describe, expect, it, vi } from 'vitest';
// The runtime barrel also initializes a rendering matrix. These tests exercise
// real hierarchy/hit geometry, without running a browser canvas renderer.
vi.hoisted(()=>{
  globalThis.DOMMatrix=class {} as typeof DOMMatrix;
  globalThis.HTMLCanvasElement=class {} as typeof HTMLCanvasElement;
  globalThis.HTMLElement=class {} as typeof HTMLElement;
  globalThis.Element=class {} as typeof Element;
  globalThis.HTMLImageElement=class {} as typeof HTMLImageElement;
});
import { createRuntimeDocument } from '@diffusionstudio/reconciler';
import { SOURCE_ATTR } from '@diffusionstudio/jsx';
import { createRuntimeWorld, Computed, Hidden, RenderSurface, transformSystem } from '@diffusionstudio/runtime';
import { clipCaptureBox, nativeTargets, pickNativeTarget, targetBox, targetParents } from './visual-target-model';

describe('visual references from native composition elements',()=>{
  it('selects the front child of a card, offers its parent and ignores recorded footage',()=>{
    const world=createRuntimeWorld('visual-reference-fixture'),doc=createRuntimeDocument(world);
    world.set(RenderSurface,{canvas:{width:600,height:400} as HTMLCanvasElement});
    const scene=doc.createElement('Scene');
    doc.setProperty(scene,'width',600);doc.setProperty(scene,'height',400);doc.insertNode(doc.stage,scene);
    const make=(tag:string,parent:typeof scene,key:string,x=20,y=20,width=100,height=100)=>{
      const node=doc.createElement(tag);
      for(const [name,value] of Object.entries({[SOURCE_ATTR]:'fixture.tsx:'+key,x,y,width,height}))doc.setProperty(node,name,value);
      doc.insertNode(parent,node);node.entity.set(Computed,{visibility:1});return node;
    };
    const footage=make('Video',scene,'footage',0,0,600,400);
    const card=make('Rect',scene,'card',100,100,200,120);
    const detail=make('Rect',card,'detail',10,10,60,30);
    const hidden=make('Rect',card,'hidden',10,10,60,30);hidden.entity.add(Hidden);
    transformSystem(world);
    const box=targetBox(world,detail.entity);
    expect(nativeTargets(world,scene.entity)).not.toContain(footage.entity);
    expect(pickNativeTarget(world,scene.entity,{x:box.x+box.width/2,y:box.y+box.height/2})).toBe(detail.entity);
    expect(targetParents(detail.entity,scene.entity)).toEqual([detail.entity,card.entity]);
    expect(pickNativeTarget(world,scene.entity,{x:500,y:350})).toBeNull();
    doc.dispose();world.destroy();
  });
  it('clamps screenshot padding to the frame and rejects areas entirely outside it',()=>{
    expect(clipCaptureBox({x:-20,y:5,width:60,height:25},100,50,12)).toEqual({x:0,y:0,width:52,height:42});
    expect(clipCaptureBox({x:120,y:10,width:20,height:20},100,50)).toEqual({x:100,y:10,width:0,height:20});
  });
});
