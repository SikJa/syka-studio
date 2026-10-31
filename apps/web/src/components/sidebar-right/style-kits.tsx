import { SolidPaint } from '@diffusionstudio/reconciler';
import { Root, Source, Paint, PaintType, getEntityTree, getEntityChildren, getActiveEntity, getIntrinsicPaint, isText, isCaption, isShape } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import { getDocumentEditor } from '@/engine/editor';
import { getEditHistory } from '@/engine/history';

export type KitScope = 'selection' | 'scene' | 'project';
export type StyleKit = { id:string; label:string; description:string; font:string; weight:number; italic?:boolean; text:string; accent:string; background:string; caption:string; colors:string[] };
export const STYLE_KITS: readonly StyleKit[] = [
  {id:'editorial',label:'Editorial cálido',description:'Instrument Serif, títulos marfil y énfasis ámbar. Subtítulos con un tratamiento editorial.',font:'Instrument Serif',weight:400,italic:true,text:'#f4eddf',accent:'#e8b76a',background:'#23211e',caption:'bridgeclip-editorial',colors:['#e8b76a']},
  {id:'clear',label:'Claro y directo',description:'Inter Semibold, títulos blancos y acentos menta. Subtítulos limpios con énfasis en la palabra activa.',font:'Inter',weight:600,text:'#f5f5f2',accent:'#67b9a7',background:'#202725',caption:'bridgeclip-subtle',colors:['#67b9a7']},
  {id:'impact',label:'Impacto',description:'Archivo Black, titulares contundentes y acentos amarillos. Subtítulos sobre una placa oscura.',font:'Archivo Black',weight:400,text:'#fff7df',accent:'#ffd23f',background:'#24221c',caption:'bridgeclip-boxed',colors:['#ffd23f','#191919']},
];
export function styleKitTargets(world:World, scope:KitScope, selected:Entity[]):Entity[] {
  const roots = scope==='project' ? [world.get(Root)] : scope==='scene' ? [getActiveEntity(world)] : selected;
  const seen=new Set<number>();
  return roots.filter((e):e is Entity=>!!e&&e.isAlive()).flatMap(root=>getEntityTree(world,root)).filter(entity=>{
    if(seen.has(entity.id())||!entity.has(Source))return false;
    seen.add(entity.id());
    if(isText(entity)||isCaption(entity))return true;
    // Media, masks and vector illustrations keep their original appearance.
    return isShape(entity)&&getIntrinsicPaint(entity)===undefined&&getEntityChildren(world,entity).some(child=>child.get(Paint)?.value===PaintType.SOLID&&child.has(Source));
  });
}
export function applyStyleKit(world:World, kit:StyleKit, scope:KitScope, selected:Entity[]):number {
  const targets=styleKitTargets(world,scope,selected);
  if(!targets.length)throw Error('Este alcance no contiene textos, subtítulos o formas con color editable.');
  const editor=getDocumentEditor(world);
  getEditHistory(world).command(()=>{
    for(const target of targets){
      if(isCaption(target)){
        editor.editProperty(target,'preset',kit.caption);
        editor.editProperty(target,'colors',kit.colors);
        continue;
      }
      const text=isText(target);
      if(text){
        editor.editProperty(target,'fontFamily',kit.font);
        editor.editProperty(target,'fontWeight',kit.weight);
        editor.editProperty(target,'fontStyle',kit.italic?'italic':false);
      }
      const fills=getEntityChildren(world,target).filter(child=>child.get(Paint)?.value===PaintType.SOLID&&child.has(Source));
      if(!fills.length&&text)editor.insertElement(target,()=> <SolidPaint color={kit.text}/>);
      for(const fill of fills)editor.editProperty(fill,'color',text?kit.text:kit.accent);
    }
  });
  return targets.length;
}
