import { Chars, Computed, Culled, Geometry, Group, Hidden, Key, Loop, Name, Source, entityQuad, getEntityChildren, getParentEntity, isAudio, isCaption, isPointerInEntity, isScene, isText, store } from '@diffusionstudio/runtime';
import { authoredElement } from '@diffusionstudio/reconciler';
import type { Entity, World } from 'koota';
import { nativeTextTarget } from './native-text-target';
export type CaptureBox={x:number;y:number;width:number;height:number};

/** Render order, including children inside a card even when the card isn't entered. */
export function nativeTargets(world:World,scene:Entity):Entity[]{
  const result:Entity[]=[];const computed=store(world,Computed);
  const visit=(parent:Entity)=>{for(const node of getEntityChildren(world,parent)){
    if(node.has(Hidden)||node.has(Culled)||computed.visibility[node.id()]===0)continue;
    if((node.has(Geometry)||node.has(Group))&&node.get(Source)?.value&&!isScene(node)&&authoredElement(node)?.tag!=='video'&&!isAudio(node))result.push(node);
    visit(node);
  }};visit(scene);return result;
}
export function pickNativeTarget(world:World,scene:Entity,point:{x:number;y:number}):Entity|null{
  return nativeTargets(world,scene).reverse().find(node=>isPointerInEntity(world,node,point))??null;
}
export function targetBox(world:World,node:Entity):CaptureBox{
  const ink=nativeTextTarget(world,node);if(ink)return ink.box;
  const quad=entityQuad(world,node),xs=quad.map(p=>p.x),ys=quad.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
export function clipCaptureBox(box:CaptureBox,width:number,height:number,padding=0):CaptureBox{
  const x=Math.max(0,Math.min(width,Math.floor(box.x-padding))),y=Math.max(0,Math.min(height,Math.floor(box.y-padding)));
  const right=Math.max(x,Math.min(width,Math.ceil(box.x+box.width+padding))),bottom=Math.max(y,Math.min(height,Math.ceil(box.y+box.height+padding)));
  return {x,y,width:right-x,height:bottom-y};
}
export function targetDetails(node:Entity){
  if(!node.isAlive())return {source:null,key:null,name:null,loopSource:null,type:'element'};
  return {source:node.get(Source)?.value??null,key:node.get(Key)?.value??null,name:node.get(Name)?.value??null,loopSource:node.get(Loop)?.value??null,type:isCaption(node)?'caption':isText(node)?'text':node.has(Group)?'group':'element',...(isText(node)?{text:node.get(Chars)?.value??''}:{})};
}
export function targetParents(node:Entity,scene:Entity):Entity[]{
  if(!node.isAlive())return [];
  const list=[node];for(let parent=getParentEntity(node);parent&&parent!==scene&&list.length<8;parent=getParentEntity(parent)){
    if(parent.get(Source)?.value&&(parent.has(Group)||parent.has(Geometry)))list.push(parent);
  }return list;
}
export async function croppedCapture(blob:Blob,box:CaptureBox,marks?:{strokes:{x:number;y:number}[][];pin?:{x:number;y:number};color?:string}):Promise<Blob>{
  const bitmap=await createImageBitmap(blob);
  try{
    const clipped=clipCaptureBox(box,bitmap.width,bitmap.height);if(clipped.width<2||clipped.height<2)throw Error('La zona quedó fuera del video.');
    const scale=Math.min(1,1920/Math.max(clipped.width,clipped.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(clipped.width*scale));canvas.height=Math.max(1,Math.round(clipped.height*scale));
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(bitmap,clipped.x,clipped.y,clipped.width,clipped.height,0,0,canvas.width,canvas.height);
    if(marks){
      ctx.save();ctx.scale(scale,scale);ctx.translate(-clipped.x,-clipped.y);
      ctx.strokeStyle=marks.color||'#72baff';ctx.fillStyle=ctx.strokeStyle;
      ctx.lineWidth=Math.max(3,bitmap.width/420);ctx.lineCap='round';ctx.lineJoin='round';
      for(const stroke of marks.strokes){if(!stroke.length)continue;ctx.beginPath();ctx.moveTo(stroke[0]!.x,stroke[0]!.y);for(const p of stroke.slice(1))ctx.lineTo(p.x,p.y);if(stroke.length===1)ctx.lineTo(stroke[0]!.x+.1,stroke[0]!.y);ctx.stroke();}
      if(marks.pin){ctx.beginPath();ctx.arc(marks.pin.x,marks.pin.y,Math.max(8,bitmap.width/140),0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('No se pudo guardar la captura.')),'image/png'));
  }finally{bitmap.close();}
}
