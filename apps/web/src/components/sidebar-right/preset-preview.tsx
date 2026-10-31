import { createEffect, onCleanup, onMount } from 'solid-js';
import { mount } from '@diffusionstudio/reconciler';
import {
  createRuntimeWorld,
  Root,
  Scene,
  Camera,
  RenderSurface,
  Silent,
  HitRegions,
  setActive,
  setPlayhead,
  playbackSystem,
  assetSystem,
  motionSystem,
  transformSystem,
  renderSystem,
  Library,
  FramePromises,
  getWebFonts,
  FontStyle,
} from '@diffusionstudio/runtime';
import { EFFECT_OPTIONS } from './inspector/effect-types';
import type { EditorResource } from './resources';
import { captionPreviewLibrary } from './caption-preview-library';
import { visiblePreview } from './resource-previews';
import { STYLE_KITS } from './style-kits';


/** Native worlds are leased only while generating a poster or playing a card.
 * The queue keeps large catalogs below koota's 16-world limit. */
let previewQueue: Promise<unknown> = Promise.resolve();
export function createPresetPreview(canvas: HTMLCanvasElement, r: EditorResource, scale = 2) {
    const world = createRuntimeWorld('preset-' + r.id);
    world.add(Silent);
    world.set(FramePromises, { list: [] });
    const largeScene=r.kind==='caption'||r.kind==='style-kit';
    if (largeScene) world.set(Library, captionPreviewLibrary());
    const effect = EFFECT_OPTIONS.find((o) => o.name === r.value);
    const decoration =
      r.kind === 'effect'
        ? `x.Effect({type:${JSON.stringify(r.value)},value:${effect?.value ?? 1}})`
        : r.kind === 'animation'
          ? `x.Animation({type:${JSON.stringify(r.value)},duration:1.3})`
          : r.kind === 'shadow'
            ? `x.Shadow({color:'#000000',opacity:.8,blur:8,offsetX:4,offsetY:6})`
            : r.kind === 'stroke'
              ? `x.Stroke({color:'#9ddeff',width:2})`
              : 'null';
    const sampleChildren = (accent: string, label: string) =>
      `x.Rect({width:240,height:144,children:x.SolidPaint({color:'#15171b'})}),x.Rect({x:18,y:18,width:204,height:108,radius:10,children:x.SolidPaint({color:'#252a32'})}),x.Rect({x:30,y:30,width:48,height:84,radius:6,children:x.SolidPaint({color:'${accent}'})}),x.Text({x:94,y:34,width:112,height:34,fontFamily:'Arial',fontSize:24,children:['${label}',x.SolidPaint({color:'#edf0f4'})]}),x.Rect({x:94,y:84,width:98,height:4,radius:2,children:x.SolidPaint({color:'#b7bfca'})}),x.Rect({x:94,y:96,width:65,height:4,radius:2,children:x.SolidPaint({color:'#687382'})})`;
    const sample = (accent: string, label: string) =>
      `x.Group({width:240,height:144,end:3,children:[${sampleChildren(accent, label)}]})`;
    const typography = r.textStyle;
    const family = r.kind === 'font' ? r.value : typography?.fontFamily ?? 'Inter';
    const variants = getWebFonts().find(f => f.family === family)?.variants;
    const normal = variants?.filter(v => v.style == null || v.style === FontStyle.NORMAL);
    const face = (normal?.length ? normal : variants)?.toSorted((a,b) => Math.abs(parseFloat(a.weight ?? '400')-400)-Math.abs(parseFloat(b.weight ?? '400')-400))[0];
    const range = (face?.weight ?? '400').split(/\s+/).map(Number);
    const weight = typography?.fontWeight ?? (range.length > 1 ? Math.min(range[1],Math.max(range[0],400)) : range[0]);
    const fontStyle = typography?.fontStyle ?? (face?.style === FontStyle.ITALIC ? 'italic' : face?.style === FontStyle.OBLIQUE ? 'oblique' : 'normal');
    const textProps = `fontFamily:${JSON.stringify(family)},fontWeight:${weight},fontStyle:${JSON.stringify(fontStyle)}`;
    const typeMotion = r.kind === 'text' || r.kind === 'font'
      ? `x.Animation({type:'softRise',phase:'in',duration:${typography?.entrance ?? .48}}),x.Animation({type:'softRise',phase:'out',duration:${typography?.exit ?? .35}})`
      : decoration;
    const fontSpecimen = `x.Text({x:18,y:10,width:208,height:92,${textProps},fontSize:68,end:3,children:['Ag',x.SolidPaint({color:'#f1eee6'}),${typeMotion}]}),x.Text({x:20,y:97,width:204,height:26,${textProps},fontSize:18,end:3,children:['Aa Bb · 123',x.SolidPaint({color:'#b9c2c8'}),${typeMotion}]})`;
    const typeSize = r.preview === 'title' ? 38 : r.preview === 'callout' ? 27 : r.preview === 'impact' ? 33 : 36;
    const typeSpecimen = `x.Text({x:18,y:${r.preview === 'title' ? 39 : 18},width:204,height:108,${textProps},fontSize:${r.kind === 'text' ? typeSize : 26},end:3,children:[${JSON.stringify(r.kind === 'text' ? r.value : 'Una idea.')},x.SolidPaint({color: ${JSON.stringify(typography?.color ?? '#edf0f4')}}),${typeMotion}]})`;
    const caption = `${family} · ${fontStyle === 'italic' ? 'Italic' : weight >= 800 ? 'Black' : weight >= 700 ? 'Bold' : weight >= 600 ? 'Semibold' : weight >= 500 ? 'Medium' : weight <= 300 ? 'Light' : 'Regular'}`;
    const textSample = `x.Group({width:240,height:144,end:3,children:[x.Rect({width:240,height:144,children:x.SolidPaint({color:'#1b1b1b'})}),${r.kind === 'font' ? fontSpecimen : typeSpecimen},x.Text({x:18,y:128,width:208,height:16,fontFamily:'Inter',fontSize:10,children:[${JSON.stringify(caption)},x.SolidPaint({color:'#a3a3a3'})]})]})`;
    // Demonstrate the real native transform on a simple subject; the static
    // axis marks make direction and scale easier to read than a miniature UI.
    const animationSample = `x.Group({width:240,height:144,end:3,children:[x.Rect({width:240,height:144,children:x.SolidPaint({color:'#1b1b1b'})}),x.Rect({x:28,y:71,width:184,height:1,children:x.SolidPaint({color:'#373737'})}),x.Rect({x:119,y:20,width:1,height:104,children:x.SolidPaint({color:'#373737'})}),x.Group({x:84,y:36,width:72,height:72,end:3,children:[x.Rect({width:72,height:72,cornerRadius:${['spin','twist'].includes(r.value) ? 16 : 36},children:x.SolidPaint({color:'#eeeeea'})}),x.Rect({x:33,y:15,width:6,height:27,cornerRadius:3,children:x.SolidPaint({color:'#555555'})}),${decoration}]})]})`;
    const transitionClip = (
      color: string,
      label: string,
      transition: boolean,
    ) =>
      `x.Rect({width:240,height:144,start:${transition ? 0 : 1.5},end:${transition ? 1.5 : 3},${transition ? 'transition:{type:' + JSON.stringify(r.value) + ',duration:1},' : ''}children:[${sampleChildren(color, label)}]})`;
    const effectSubject=(offset:number,withEffect:boolean)=>`x.Group({x:${offset},width:120,height:144,end:3,children:[x.Rect({x:12,y:24,width:96,height:96,cornerRadius:14,children:x.SolidPaint({color:'#353535'})}),x.Rect({x:20,y:32,width:35,height:80,cornerRadius:17,children:x.SolidPaint({color:'#f0ece2'})}),x.Text({x:62,y:52,width:48,height:44,fontFamily:'Arial',fontSize:28,children:['Aa',x.SolidPaint({color:'#67b9a7'})]}),${withEffect?decoration:'null'}]})`;
    const effectSample=`x.Group({width:240,height:144,end:3,children:[x.Rect({width:240,height:144,children:x.SolidPaint({color:'#1b1b1b'})}),${effectSubject(0,false)},${effectSubject(120,true)},x.Text({x:12,y:126,width:105,height:14,fontFamily:'Arial',fontSize:10,children:['Original',x.SolidPaint({color:'#cccccc'})]}),x.Text({x:132,y:126,width:105,height:14,fontFamily:'Arial',fontSize:10,children:['Con efecto',x.SolidPaint({color:'#cccccc'})]})]})`;
    const kit=STYLE_KITS.find(kit=>kit.id===r.value);
    const kitSample=kit?`x.Group({width:1920,height:1152,end:3,children:[x.Rect({width:1920,height:1152,children:x.SolidPaint({color:${JSON.stringify(kit.background)}})}),x.Rect({x:144,y:144,width:180,height:16,children:x.SolidPaint({color:${JSON.stringify(kit.accent)}})}),x.Text({x:144,y:240,width:1632,height:440,fontFamily:${JSON.stringify(kit.font)},fontWeight:${kit.weight},fontStyle:${JSON.stringify(kit.italic?'italic':'normal')},fontSize:240,children:['Una idea.\\nTu estilo.',x.SolidPaint({color:${JSON.stringify(kit.text)}})]}),x.Captions({x:0,y:740,width:1920,height:340,src:'sample.json',preset:${JSON.stringify(kit.caption)},colors:${JSON.stringify(kit.colors)},verticalAlign:'center',end:3})]})`:'';
    const content = r.kind==='style-kit' ? kitSample :
      (r.kind === 'animation' && r.textOnly) ||
      ['text', 'font', 'shadow', 'stroke'].includes(r.kind)
        ? textSample
        : r.kind === 'caption'
          ? `x.Group({width:1920,height:1152,end:3,children:[x.Rect({width:1920,height:1152,children:x.SolidPaint({color:'#1b1b1b'})}),x.Captions({src:'sample.json',preset:${JSON.stringify(r.value)},verticalAlign:'center',end:3})]})`
        : r.kind === 'transition'
          ? `x.Sequence({children:[${transitionClip('#eeeeea', 'A', true)},${transitionClip('#67b9a7', 'B', false)}]})`
          : r.kind === 'effect' ? effectSample : r.kind === 'animation' ? animationSample
          : `x.Group({width:240,height:144,end:3,children:[${sample('#0096ff', 'Syka')},${decoration}]})`;
    const previewDocument = mount(
      `const x=require('@diffusionstudio/jsx');module.exports.default=()=>x.Stage({frameRate:30,children:x.Scene({width:${largeScene ? 1920 : 240},height:${largeScene ? 1152 : 144},end:3,active:true,children:${content}})});`,
      world,
    );
    const scene = world.query(Scene)[0]!;
    setActive(world, scene);
    // Two backing pixels per display pixel keep stems and italic curves crisp.
    canvas.width = 240 * scale;
    canvas.height = 144 * scale;
    world.set(RenderSurface, {
      canvas,
      ctx: canvas.getContext('2d'),
      resolution: largeScene ? scale / 8 : scale,
    });
    // A caption card is a close-up of the same native layout, keeping the
    // preset's typography and motion legible in the small library thumbnail.
    world.get(Root)!.set(Camera, r.kind === 'caption'
      ? { a: 4, b: 0, c: 0, d: 4, e: r.value === 'cascade' ? -272 : -2880, f: -1728 }
      : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    const draw = (p: number) => {
      setPlayhead(
        world,
        scene,
        (r.kind === 'transition' ? 1 + p : p * (largeScene ? 2.8 : r.kind === 'text' || r.kind === 'font' ? 3 : 1.3)) * 30,
      );
      assetSystem(world);
      playbackSystem(world);
      motionSystem(world);
      transformSystem(world);
      world.get(HitRegions)!.list.length = 0;
      renderSystem(world);
    };

  let disposed = false;
  const poster = r.kind === 'caption' ? .24 : .55;
  return {
    draw,
    async ready() {
      draw(0);
      transformSystem(world);
      for (let i = 0; i < 12 && !disposed; i++) {
        draw(poster);
        const promises = world.get(FramePromises)?.list ?? [];
        world.set(FramePromises, { list: [] });
        if (!promises.length) { await Promise.resolve(); draw(poster); return; }
        await Promise.all(promises);
      }
      if (!disposed) draw(poster);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      previewDocument.dispose();
      world.get(Library)?.dispose();
      world.destroy();
    },
    poster,
  };
}

export function PresetPreview(props: { resource: EditorResource; playing?: boolean; large?: boolean }) {
  let canvas!: HTMLCanvasElement;
  const visible = visiblePreview(() => canvas);
  let native: ReturnType<typeof createPresetPreview> | undefined;
  let raf = 0, queued = false, mounted = false, ready = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const release = () => { stop(); native?.dispose(); native = undefined; ready = false; };
  const play = () => {
    stop();
    if (!native || !ready || reduced.matches) return;
    const begin = performance.now();
    const tick = (now: number) => {
      native?.draw(((now - begin) % 2800) / 2800);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const ensure = () => {
    if (!mounted || queued || native || !visible()) return;
    queued = true;
    previewQueue = previewQueue.then(async () => {
      if (!mounted) { queued = false; return; }
      native = createPresetPreview(canvas, props.resource, props.large ? 4 : 2);
      try {
        await native.ready();
        if (!mounted || !native) return;
        ready = true;
        if (props.playing && !reduced.matches) play();
        else release(); // Keep the pixels; idle cards hold no worlds.
      } catch (error) {
        console.warn('[preset-preview] Could not resolve preview', error);
        release();
      } finally { queued = false; }
    }).catch(error => { queued = false; release(); console.warn('[preset-preview]', error); });
  };
  createEffect(() => {
    if (visible()) ensure();
    if (props.playing && !reduced.matches) { ensure(); play(); }
    else {
      stop();
      if (native && ready) { native.draw(native.poster); release(); }
    }
  });
  onMount(() => {
    mounted = true;
    ensure();
    const motionChanged = () => {
      if (reduced.matches) { if (native && ready) native.draw(native.poster); release(); }
      else if (props.playing) { ensure(); play(); }
    };
    reduced.addEventListener('change', motionChanged);
    onCleanup(() => { mounted = false; release(); reduced.removeEventListener('change', motionChanged); });
  });
  return <canvas ref={canvas} class="syka-preset-canvas" aria-hidden="true" />;
}
