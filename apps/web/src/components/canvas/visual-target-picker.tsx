import { createEffect, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { VisualNoteComposer } from '@/agent-chat/visual-note-composer';
import { useWorld } from '@diffusionstudio/koota-solid';
import { Computed, FrameRate, Playback, RenderSurface, Source, getActiveEntity } from '@diffusionstudio/runtime';
import { authoredTree } from '@diffusionstudio/reconciler';
import type { Entity } from 'koota';
import { useEngineContext } from '@/engine/context';
import { useDerived } from '@/engine/hooks';
import { useProject } from '@/context/project';
import { visualPickMode, setVisualPickMode } from '@/agent-chat/visual-target-state';
import { clipCaptureBox, croppedCapture, targetBox, targetDetails, targetParents, type CaptureBox } from '@/agent-chat/visual-target-model';
import { htmlTargetDetails, type HtmlVisualTarget } from '@/agent-chat/html-visual-target';
import { pickVisualTarget } from '@/agent-chat/visual-hit-target';
import { focusChatComposer } from '@/agent-chat/visual-context';
import { activeChatId, draftKey } from '@/agent-chat/store';
import { addVisualNote, visualNotes } from '@/agent-chat/visual-review-state';
import { drawingBounds, normalizedPoint, MAX_VISUAL_NOTES, type ReviewPoint } from '@/agent-chat/visual-review-model';
import { prepareChatFiles } from '@/agent-chat/local-attachments';
import { PreviewIcon } from './preview-icon';
import { requestScreenRecording } from '@/agent-chat/visual-target-state';
import { toast } from 'somoto';
import './visual-target-picker.css';

type ReviewMarks={strokes:ReviewPoint[][];pin?:ReviewPoint};
type Selection={entity:Entity;html?:HtmlVisualTarget;box:CaptureBox;fingerprint:string};
type Locked={box:CaptureBox;scene:Entity;frame:number;entity:Entity|null;html?:HtmlVisualTarget;targets:Selection[];fingerprint:string;context:Record<string,unknown>;marks?:ReviewMarks;blob?:Blob;preview?:string};
const dataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(Error('No se pudo preparar la imagen.'));reader.readAsDataURL(blob);});

/** A view-only pointer layer: no move/resize/source edits while identifying a target. */
export function VisualTargetPicker(){
  const world=useWorld(),engine=useEngineContext(),project=useProject();
  const [hover,setHover]=createSignal<Entity|null>(null),[region,setRegion]=createSignal<CaptureBox|null>(null),[locked,setLocked]=createSignal<Locked|null>(null);
  const [hoverHtml,setHoverHtml]=createSignal<HtmlVisualTarget|null>(null);
  const [selection,setSelection]=createSignal<Selection[]>([]),[adding,setAdding]=createSignal(false);
  const [collecting,setCollecting]=createSignal(false),[tutorial,setTutorial]=createSignal(false);
  const [intent,setIntent]=createSignal(''),[includeImage,setIncludeImage]=createSignal(true),[busy,setBusy]=createSignal(false),[problem,setProblem]=createSignal<string|null>(null);
  const [surfaceSize,setSurfaceSize]=createSignal({width:1,height:1});
  const [strokes,setStrokes]=createSignal<ReviewPoint[][]>([]);
  const [drawing,setDrawing]=createSignal(false);
  let origin:{x:number;y:number}|null=null,selectionScene:Entity|undefined,selectionFrame=0,revision=0,layer!:HTMLDivElement;
  const canvas=()=>world.get(RenderSurface)?.canvas as HTMLCanvasElement|null;
  const fingerprint=(entity:Entity|null,html?:HtmlVisualTarget)=>{if(!entity?.isAlive())return '';const tree=authoredTree(world,entity);return tree?JSON.stringify({tree,html:html?html.root.innerHTML:undefined}):'';};
  const title=(entity:Entity,html?:HtmlVisualTarget|null)=>html?.text?`Texto “${html.text.slice(0,80)}”`:html?`Elemento ${html.element.localName}`:targetDetails(entity).name??targetDetails(entity).type;
  const box=useDerived(()=>locked()?.box??region()??(hover()?.isAlive()?hoverHtml()?.box??targetBox(world,hover()!):null));
  const currentScene=useDerived(()=>getActiveEntity(world));
  const currentFrame=useDerived(()=>currentScene()?.get(Computed)?.localTime??0);
  const boxStyle=(b:CaptureBox|null=box())=>{const c=canvas();if(!b||!c)return {};return {left:(b.x/c.width*100)+'%',top:(b.y/c.height*100)+'%',width:(b.width/c.width*100)+'%',height:(b.height/c.height*100)+'%'};};
  const targetTitle=(target:Locked)=>target.targets.length>1?`${target.targets.length} componentes`:target.entity?title(target.entity,target.html):'Zona del video';
  const cardStyle=()=>{
    const viewport=surfaceSize(),rect=canvas()?.getBoundingClientRect();
    const width=Math.min(300,viewport.width-32),height=Math.min(440,viewport.height-32);
    return {width:width+'px',left:Math.max(16,Math.min((rect?.right??viewport.width)-width-14,viewport.width-width-16))+'px',top:Math.max(16,Math.min((rect?.top??16)+56,viewport.height-height-16))+'px','max-height':height+'px'};
  };
  const point=(event:PointerEvent)=>{const c=canvas()!;const rect=c.getBoundingClientRect();return {x:Math.max(0,Math.min(c.width,(event.clientX-rect.left)*c.width/rect.width)),y:Math.max(0,Math.min(c.height,(event.clientY-rect.top)*c.height/rect.height))};};
  const path=(points:ReviewPoint[])=>points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
  const modes=[{id:'element',icon:'inspect',label:'Señalar componente'},{id:'draw',icon:'draw',label:'Dibujar una indicación'},{id:'comment',icon:'comment',label:'Comentar un momento'},{id:'region',icon:'camera',label:'Capturar una zona'}] as const;
  const guide=()=>visualPickMode()==='element'?(collecting()?`${selection().length} seleccionados · soltá Ctrl para escribir`:adding()?'Elegí otro componente':locked()?'Ctrl + clic para sumar otro':'Señalá un componente · Ctrl + clic para sumar'):locked()?'Agregá una indicación o sólo la captura':visualPickMode()==='draw'?'Dibujá sobre lo que querés cambiar':visualPickMode()==='comment'?'Marcá dónde dejar tu nota':'Arrastrá para capturar una zona';
  const finishTutorial=()=>{setTutorial(false);try{localStorage.setItem('syka.visual-selection-tutorial.v1','seen');}catch{/* Still usable without persistence. */}};
  createEffect(()=>{
    const mode=visualPickMode();revision++;origin=null;selectionScene=undefined;setSelection([]);setAdding(false);setCollecting(false);setLocked(null);setHover(null);setHoverHtml(null);setRegion(null);setProblem(null);setIntent('');setBusy(false);setStrokes([]);setDrawing(false);
    let seen=false;try{seen=localStorage.getItem('syka.visual-selection-tutorial.v1')==='seen';}catch{}
    setTutorial(mode==='element'&&!seen);
    if(visualPickMode())getActiveEntity(world)?.set(Playback,{playing:false});
  });
  // Frozen boxes belong to one rendered instant. Seeking must never leave them
  // painted over unrelated content; saved review notes remain in the chat.
  createEffect(()=>{
    const scene=currentScene(),frame=currentFrame();
    if(selectionScene&&(scene!==selectionScene||frame!==selectionFrame)){
      reset();setProblem('Cambió el instante. Señalá los componentes de este cuadro; tus notas guardadas siguen en el chat.');
    }
  });
  const lock=async(entity:Entity|null,requested:CaptureBox,marks?:ReviewMarks,html?:HtmlVisualTarget,members?:Selection[])=>{
    const scene=getActiveEntity(world),c=canvas();if(!scene||!c)return;
    const version=++revision;const frame=scene.get(Computed)?.localTime??0;
    const clipped=clipCaptureBox(requested,c.width,c.height,entity?12*(world.get(RenderSurface)?.resolution??1):0);
    const targets=members??(entity?[{entity,html,box:html?.box??requested,fingerprint:fingerprint(entity,html)}]:[]);
    const context={composition:scene.get(Source)?.value??null,timeSeconds:frame/(world.get(FrameRate)?.value||30),frame,canvasPixels:{width:c.width,height:c.height},region:clipped,elements:targets.map(member=>({...targetDetails(member.entity),...(member.html?{subtarget:htmlTargetDetails(member.html)}:{})})),kind:targets.length>1?'editable-elements':html?html.kind:entity?'editable-element':'visual-region',annotation:{kind:visualPickMode(),strokes:marks?.strokes.map(stroke=>stroke.map(p=>normalizedPoint(p,c.width,c.height)))??[],...(marks?.pin?{pin:normalizedPoint(marks.pin,c.width,c.height)}:{})}};
    setSurfaceSize({width:innerWidth,height:innerHeight});
    const initial:Locked={box:clipped,scene,frame,entity,html,targets,fingerprint:targets.length?JSON.stringify(targets.map(member=>member.fingerprint)):'',context,marks};
    selectionScene=scene;selectionFrame=frame;setSelection(targets);setAdding(false);setHover(null);setHoverHtml(null);setLocked(initial);setProblem(null);setBusy(true);
    try{
      const blob=await engine.snapshot();if(!blob)throw Error('No hay una imagen del video disponible.');
      const crop=await croppedCapture(blob,clipped,marks?{...marks,color:getComputedStyle(layer).getPropertyValue('--color-primary').trim()}:undefined),preview=await dataUrl(crop);
      if(version===revision)setLocked({...initial,blob:crop,preview});
    }catch(error){if(version===revision)setProblem(String(error));}
    finally{if(version===revision)setBusy(false);}
  };
  const select=async(entity:Entity,html?:HtmlVisualTarget,extend=false,defer=false)=>{
    const scene=getActiveEntity(world),frame=scene?.get(Computed)?.localTime??0;
    if(!scene)return;
    if(extend&&selection().length&&(scene!==selectionScene||frame!==selectionFrame)){
      setProblem('Cambió el instante del video. Volvé a marcar los componentes en el mismo cuadro.');return;
    }
    const previous=extend?selection():[];
    const existing=previous.find(member=>member.entity===entity&&member.html?.element===html?.element);
    if(existing){
      if(defer){setSelection(previous.filter(member=>member!==existing));return;}
      if(adding())await lockSelection(previous);return;
    }
    if(previous.length>=10){setProblem('Podés señalar hasta 10 componentes por referencia.');return;}
    const members=[...previous,{entity,html,box:html?.box??targetBox(world,entity),fingerprint:fingerprint(entity,html)}];
    if(defer){revision++;selectionScene=scene;selectionFrame=frame;setSelection(members);setLocked(null);setBusy(false);setCollecting(true);setHover(null);setHoverHtml(null);setProblem(null);return;}
    await lockSelection(members);
  };
  const lockSelection=(members:Selection[])=>{
    if(!members.length){reset();return Promise.resolve();}
    if(members.some(member=>selection().includes(member))&&(getActiveEntity(world)!==selectionScene||(selectionScene?.get(Computed)?.localTime??0)!==selectionFrame)){
      setProblem('Cambió el instante del video. Volvé a marcar los componentes en el mismo cuadro.');return Promise.resolve();
    }
    const boxes=members.map(member=>member.box),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
    const requested={x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
    const first=members.length===1?members[0]:undefined;
    return lock(first?.entity??null,requested,undefined,first?.html,members);
  };
  const reset=()=>{revision++;selectionScene=undefined;origin=null;setSelection([]);setAdding(false);setCollecting(false);setLocked(null);setRegion(null);setHover(null);setHoverHtml(null);setProblem(null);setStrokes([]);setDrawing(false);setBusy(false);};
  const addAnother=()=>{revision++;setLocked(null);setHover(null);setHoverHtml(null);setProblem(null);setAdding(true);setBusy(false);};
  const move=(event:PointerEvent)=>{
    if((locked()&&!(event.ctrlKey||event.metaKey||event.shiftKey))||busy()||!canvas()||tutorial())return;const p=point(event);
    if(drawing()){
      setStrokes(previous=>{const next=previous.map(s=>s.slice()),stroke=next[next.length-1]!;const last=stroke[stroke.length-1];if(stroke.length<600&&(!last||Math.hypot(p.x-last.x,p.y-last.y)>2))stroke.push(p);return next;});return;
    }
    if(origin){setRegion({x:Math.min(origin.x,p.x),y:Math.min(origin.y,p.y),width:Math.abs(origin.x-p.x),height:Math.abs(origin.y-p.y)});return;}
    if(visualPickMode()==='element'){const scene=getActiveEntity(world),target=scene?pickVisualTarget(world,scene,p):null;setHover(target?.entity??null);setHoverHtml(target?.html??null);}
  };
  const down=(event:PointerEvent)=>{
    const multiple=event.ctrlKey||event.metaKey||event.shiftKey;
    if(event.button!==0||busy()||(locked()&&!(visualPickMode()==='element'&&multiple))||!canvas()||tutorial())return;event.preventDefault();event.stopPropagation();
    if(visualPickMode()==='draw'){if(strokes().length>=12){setProblem('Terminá esta indicación antes de agregar más trazos.');return;}setStrokes(previous=>[...previous,[point(event)]]);setDrawing(true);layer.setPointerCapture(event.pointerId);}
    else if(visualPickMode()==='comment'){
      const p=point(event),scene=getActiveEntity(world),c=canvas()!,hit=scene?pickVisualTarget(world,scene,p):null,target=hit?.entity??null;
      void lock(target,hit?.html?.box??(target?targetBox(world,target):{x:p.x-c.width*.15,y:p.y-c.height*.15,width:c.width*.3,height:c.height*.3}),{strokes:[],pin:p},hit?.html);
    }
    else if(visualPickMode()==='region'){origin=point(event);setRegion({...origin,width:0,height:0});layer.setPointerCapture(event.pointerId);}
    else{const scene=getActiveEntity(world),p=point(event),hit=scene?pickVisualTarget(world,scene,p):null;if(hit){void select(hit.entity,hit.html,multiple||adding(),multiple);}else setProblem('Acá no hay un componente editable. Podés capturar una zona como referencia.');}
  };
  const up=(event:PointerEvent)=>{
    if(drawing()){move(event);setDrawing(false);if(layer.hasPointerCapture(event.pointerId))layer.releasePointerCapture(event.pointerId);return;}
    if(!origin)return;move(event);origin=null;const b=region();if(b&&b.width>=8&&b.height>=8)void lock(null,b);else{setRegion(null);setProblem('Arrastrá para marcar una zona más grande.');}
  };
  const prepare=async()=>{
    const target=locked();if(!target||busy())return;
    if(getActiveEntity(world)!==target.scene||!target.scene.isAlive()||(target.scene.get(Computed)?.localTime??0)!==target.frame||target.targets.some(member=>!member.entity.isAlive()||fingerprint(member.entity,member.html)!==member.fingerprint)){
      setProblem('La escena o el componente cambió. Volvé a señalarlo para mandar una referencia actual.');return;
    }
    const version=revision,projectId=project.id(),directory=project.dir();
    const chat=activeChatId(projectId),key=draftKey(projectId,chat),instruction=intent().trim();
    if(visualNotes(key).length>=MAX_VISUAL_NOTES){setProblem('Pasá las 10 notas al chat antes de agregar más.');return;}
    if(!instruction&&!includeImage()){setProblem('Incluí la captura o agregá una indicación para mandar la referencia.');return;}
    setBusy(true);
    try{
      let entries:Awaited<ReturnType<typeof prepareChatFiles>>=[];
      if(includeImage()){
        if(!target.blob)throw Error('No se pudo preparar la captura. Podés desmarcar «Incluir captura» y pasar sólo el componente.');
        entries=await prepareChatFiles([new File([target.blob],`captura-${target.frame}.png`,{type:'image/png'})],directory);
        for(const entry of entries){if(entry.previewUrl)URL.revokeObjectURL(entry.previewUrl);entry.previewUrl=target.preview;}
      }
      const sha=target.fingerprint?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(target.fingerprint)))).map(b=>b.toString(16).padStart(2,'0')).join(''):undefined;
      if(version!==revision||project.id()!==projectId||!visualPickMode())return;
      if(activeChatId(projectId)!==chat)throw Error('Cambió el chat. La captura se guardó localmente; volvé a preparar la referencia en la conversación correcta.');
      await addVisualNote(key,{id:crypto.randomUUID(),title:target.targets.length?targetTitle(target):visualPickMode()==='draw'?'Indicación dibujada':'Nota visual',instruction,context:{...target.context,elementSnapshotSha256:sha,capture:entries[0]?.path??null},attachments:entries,preview:includeImage()?target.preview:undefined});
      if(version!==revision||project.id()!==projectId||activeChatId(projectId)!==chat)return;
      setVisualPickMode(null);focusChatComposer();toast.success('Nota agregada a la revisión');
    }catch(error){if(version===revision)setProblem(String(error));}finally{if(version===revision)setBusy(false);}
  };
  onMount(()=>{
    const cancel=(event:KeyboardEvent)=>{
      if(visualPickMode()&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(tutorial())finishTutorial();else setVisualPickMode(null);return;}
      if(visualPickMode()==='element'&&['Control','Meta','Shift'].includes(event.key)&&selection().length&&!(event.target instanceof Element&&event.target.closest('.syka-visual-target-card textarea,.syka-visual-target-card input'))){revision++;setCollecting(true);setLocked(null);setBusy(false);}
    };
    const released=(event:KeyboardEvent)=>{if(collecting()&&['Control','Meta','Shift'].includes(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){setCollecting(false);void lockSelection(selection());}};
    const blurred=()=>{if(collecting())reset();};
    document.addEventListener('keydown',cancel,true);document.addEventListener('keyup',released,true);window.addEventListener('blur',blurred);const resized=()=>setSurfaceSize({width:innerWidth,height:innerHeight});resized();window.addEventListener('resize',resized);window.addEventListener('scroll',resized,true);
    const observer=new ResizeObserver(resized);if(canvas())observer.observe(canvas()!);
    onCleanup(()=>{revision++;setVisualPickMode(null);document.removeEventListener('keydown',cancel,true);document.removeEventListener('keyup',released,true);window.removeEventListener('blur',blurred);window.removeEventListener('resize',resized);window.removeEventListener('scroll',resized,true);observer.disconnect();});
  });
  return <Show when={visualPickMode()}><div ref={layer} class="syka-visual-picker" role="region" aria-label={visualPickMode()==='element'?'Señalar componente editable':'Capturar zona del video'} data-size={surfaceSize().width}
    on:pointermove={move} on:pointerdown={down} on:pointerup={up} on:pointercancel={()=>{origin=null;setRegion(null);setDrawing(false);setStrokes(previous=>previous.slice(0,-1));}}>
    <Show when={strokes().length&&!locked()}><svg class="syka-visual-drawing" viewBox={`0 0 ${canvas()?.width??1} ${canvas()?.height??1}`} preserveAspectRatio="none" aria-hidden="true"><For each={strokes()}>{stroke=><path d={path(stroke)}/>}</For></svg></Show>
    <For each={selection()}>{member=><div class="syka-visual-target-outline syka-visual-selected-outline" style={boxStyle(member.box)}/>}</For>
    <Show when={box()&&(!locked()||!selection().length)}><div class="syka-visual-target-outline" style={boxStyle()}><Show when={!locked()&&hover()}><span>{title(hover()!,hoverHtml())}</span></Show></div></Show>
    <div class="syka-visual-picker-guide" on:pointerdown={event=>event.stopPropagation()} on:pointermove={event=>event.stopPropagation()}><nav aria-label="Tipo de nota visual"><For each={modes}>{mode=><button title={mode.label} aria-label={mode.label} aria-pressed={visualPickMode()===mode.id} onClick={()=>setVisualPickMode(mode.id)}><PreviewIcon name={mode.icon}/></button>}</For><button title="Grabar una zona de la pantalla" aria-label="Grabar una zona de la pantalla" onClick={()=>{setVisualPickMode(null);requestScreenRecording({region:true,chatKey:draftKey(project.id(),activeChatId(project.id()))});}}><PreviewIcon name="record"/></button></nav><span>{guide()}</span><Show when={adding()&&selection().length&&!collecting()}><button onClick={()=>void lockSelection(selection())}>Escribir nota</button></Show><button title="Cómo seleccionar componentes" aria-label="Cómo seleccionar componentes" onClick={()=>setTutorial(true)}>?</button><button aria-label="Cancelar selección visual" onClick={()=>setVisualPickMode(null)}><PreviewIcon name="close"/></button></div>
    <Show when={tutorial()}><Portal mount={document.fullscreenElement??document.body}><section class="syka-selection-tutorial syka-visual-target-card t-panel-slide" data-open="true" role="dialog" aria-label="Cómo seleccionar componentes" on:pointerdown={event=>event.stopPropagation()}>
      <strong>Una selección, una corrección</strong><ol><li>Hacé clic en el texto o componente que querés cambiar.</li><li>Mantené <kbd>Ctrl</kbd> y hacé clic en otros para sumarlos. Otro clic los quita.</li><li>Soltá <kbd>Ctrl</kbd>: escribí la indicación para todo el conjunto.</li><li>Agregala a la revisión. Las notas quedan arriba del mensaje, listas para editar o enviar.</li></ol><p>Al avanzar el video se limpia la selección de ese cuadro. Las notas guardadas se conservan. En Mac, usá ⌘.</p><button class="syka-visual-prepare" onClick={finishTutorial}>Entendido, seleccionar</button>
    </section></Portal></Show>
    <Show when={visualPickMode()==='draw'&&strokes().length&&!locked()}><div class="syka-visual-drawing-actions" on:pointerdown={event=>event.stopPropagation()}><button disabled={drawing()} onClick={()=>setStrokes(previous=>previous.slice(0,-1))}>Deshacer trazo</button><button class="syka-visual-prepare" disabled={drawing()} onClick={()=>{const c=canvas()!,bounds=drawingBounds(strokes(),c.width,c.height);if(bounds)void lock(null,bounds,{strokes:strokes()});}}>Agregar nota</button></div></Show>
    <Show when={locked()} fallback={<Show when={problem()}><div class="syka-visual-picker-error" role="status">{problem()}</div></Show>}>
      {target=><Portal mount={document.fullscreenElement??document.body}><section style={cardStyle()} class="syka-visual-target-card t-panel-slide" data-open="true" role="dialog" aria-label="Referencia visual para el agente" on:pointerdown={event=>event.stopPropagation()} on:pointermove={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
        <div class="syka-visual-target-heading"><div><strong>{targetTitle(target())}</strong><small>{Number(target().context.timeSeconds).toFixed(2)} s</small></div><div class="syka-visual-target-heading-actions"><Show when={visualPickMode()==='element'}><button disabled={busy()} title="Sumar otro componente" aria-label="Sumar otro componente" onClick={addAnother}><PreviewIcon name="plus"/></button></Show><button disabled={busy()} title="Volver a marcar" aria-label="Volver a marcar" onClick={reset}><PreviewIcon name="reset"/></button><button title="Cerrar referencia" aria-label="Cerrar referencia" onClick={()=>setVisualPickMode(null)}><PreviewIcon name="close"/></button></div></div>
        <div class="syka-visual-target-body"><Show when={target().targets.length>1}><nav aria-label="Componentes seleccionados" data-selection-nav="selected"><For each={target().targets}>{member=><button title={`Quitar ${title(member.entity,member.html)}`} aria-label={`Quitar ${title(member.entity,member.html)}`} disabled={busy()} onClick={()=>void lockSelection(target().targets.filter(item=>item!==member))}>{title(member.entity,member.html)} <PreviewIcon name="close"/></button>}</For></nav></Show><Show when={target().entity}><nav aria-label="Elegir texto o componente"><Show when={target().html}><button aria-pressed="true" disabled>{title(target().entity!,target().html)}</button></Show><For each={targetParents(target().entity!,target().scene)}>{node=><button aria-pressed={!target().html&&node===target().entity} disabled={busy()} onClick={()=>void lock(node,targetBox(world,node),target().marks)}>{targetDetails(node).name??targetDetails(node).type}</button>}</For></nav></Show>
        <Show when={target().preview}><img src={target().preview} alt="Captura de la zona seleccionada"/></Show></div>
        <VisualNoteComposer value={intent()} onChange={setIntent} onSubmit={()=>void prepare()} disabled={busy()} hasCapture={includeImage()&&!!target().blob} contextKey={`${draftKey(project.id(),activeChatId(project.id()))}:visual:${target().frame}:${target().box.x}:${target().box.y}:${target().box.width}`}/>
        <label><input type="checkbox" checked={includeImage()} onChange={event=>setIncludeImage(event.currentTarget.checked)}/> Incluir captura</label>
        <Show when={problem()}><p role="alert">{problem()}</p></Show>
      </section></Portal>}
    </Show>
  </div></Show>;
}
