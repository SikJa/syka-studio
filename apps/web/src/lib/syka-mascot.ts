import { BotEngine, type BotFrame, type RenderedEye } from './vendor/bloub/engine';
import { EXPRESSION_BY_ID } from './vendor/bloub/expressions';
import { MODE_DRAWS, resolvePreset } from 'thinking-orbs/engine';
import {DEFAULT_ACCENT, parseColor} from './appearance/color';

export type MascotEyeFinish = 'soft' | 'metal' | 'glass' | 'pearl' | 'grok' | 'accent';
export type MascotPointer = {x: number; y: number} | null;
export type MascotActivity = 'idle' | 'thinking' | 'editing' | 'captions' | 'audio' | 'review' | 'question' | 'notification' | 'reference' | 'ready' | 'error';
export const MASCOT_LABELS: Record<MascotActivity, string> = {
  idle: 'Syka está disponible', thinking: 'Syka está trabajando', editing: 'Editando el proyecto',
  captions: 'Trabajando con la transcripción', audio: 'Trabajando con el audio', review: 'Revisando el proyecto',
  question: 'Syka tiene una pregunta', notification: 'Syka tiene un aviso', reference: 'Tomando una referencia', ready: 'Respuesta lista', error: 'La tarea necesita atención',
};
const expressions: Record<MascotActivity, string> = {
  idle: 'neutre', thinking: 'curieux', editing: 'attentif', captions: 'attentif',
  audio: 'heureux', review: 'mefiant', question: 'curieux', notification: 'heureux', reference: 'attentif', ready: 'heureux', error: 'confus',
};
const ribbonPreset = resolvePreset('composing', 64);
const ribbonDraw = MODE_DRAWS[ribbonPreset.mode];
/** One actor per canvas. Timestamped changes preserve Bloub's expression morph.
 * A backwards seek resets the actor. No timers or playback side effects. */
export function createMascotActor() {
  let engine = new BotEngine(100, 'idle', null, EXPRESSION_BY_ID.get('attentif')!);
  let previous: MascotActivity = 'idle', last = -1;
  let pointerKey = '';
  return {
    sample(activity: MascotActivity, seconds: number, reduced = false, pointer: MascotPointer = null) {
      const t = reduced ? .6 : Math.max(0, Number.isFinite(seconds) ? seconds : 0);
      const expression = EXPRESSION_BY_ID.get(expressions[activity])!;
      if (t < last || reduced || last < 0) {
        engine = new BotEngine(100, 'idle', null, expression);
        pointerKey = '';
      } else if (activity !== previous) engine.setExpression(expression, t);
      const look = !reduced && pointer ? {
        yaw: Math.max(-1, Math.min(1, pointer.x)) * 22,
        pitch: -Math.max(-1, Math.min(1, pointer.y)) * 15,
        mix: .85, spin: 0, wander: .08,
      } : null;
      const key = look ? `${look.yaw},${look.pitch}` : 'rest';
      if (key !== pointerKey) { engine.setLook(look, t); pointerKey = key; }
      previous = activity; last = t;
      return engine.sample(t);
    },
  };
}
const actors = new WeakMap<CanvasRenderingContext2D, ReturnType<typeof createMascotActor>>();
const tau = Math.PI * 2;

/** Conservative bounds of Bloub's capsule, including its painted outline.
 * Use the live projected geometry, including blinks and expression morphs. */
function eyeBounds(eye: RenderedEye) {
  const m = eye.matrix.slice(7, -1).split(',').map(Number);
  const start = /^M([-\d.]+)\s/.exec(eye.d);
  const arc = /A[-\d.]+\s[-\d.]+\s0\s0\s1\s[-\d.]+\s([-\d.]+)/.exec(eye.d);
  const hw = Math.abs(Number(start?.[1] ?? 10)) + 2.5;
  const hh = Math.abs(Number(arc?.[1] ?? 22)) + 2.5;
  const corners = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y]) => ({
    x: 50 + .34 * (m[0]*x+m[2]*y+m[4]),
    y: 42 + .34 * (m[1]*x+m[3]*y+m[5]),
  }));
  return {m, left: Math.min(...corners.map(p=>p.x)), right: Math.max(...corners.map(p=>p.x)),
    top: Math.min(...corners.map(p=>p.y)), bottom: Math.max(...corners.map(p=>p.y))};
}

/** A single face rig: mouth follows the eyes and reserves a real clear gap.
 * Keep all facial features within the original orb without changing its body. */
export function mascotFaceLayout(frame: BotFrame) {
  const eyes = frame.eyes.map(eyeBounds);
  const left = Math.min(...eyes.map(e=>e.left)), right = Math.max(...eyes.map(e=>e.right));
  const top = Math.min(...eyes.map(e=>e.top)), bottom = Math.max(...eyes.map(e=>e.bottom));
  const center = (left+right)/2;
  const dx = Math.max(44,Math.min(56,center))-center;
  const mouthY = bottom + 5;
  const dy = Math.min(0, 65-(mouthY+4));
  return {dx,dy,eyeBottom:bottom+dy,eyeTop:top+dy,mouthX:center+dx,mouthY:mouthY+dy,
    mouthTop:mouthY+dy-2,mouthBottom:mouthY+dy+4};
}

function tint(hex: string, target: number, ratio: number) {
  return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-ratio)+target*ratio).toString(16).padStart(2,'0')).join('');
}
export function mascotFaceMaterial(finish: MascotEyeFinish, accent = DEFAULT_ACCENT) {
  const ink = parseColor(accent) ?? DEFAULT_ACCENT;
  if(finish==='grok')return {top:'#e1e5ea',middle:'#e1e5ea',bottom:'#e1e5ea',outline:'#080c12',mouth:'#d2d9e2'};
  if(finish==='accent')return {top:tint(ink,255,.44),middle:ink,bottom:tint(ink,0,.3),outline:'#080c12',mouth:tint(ink,255,.4)};
  if(finish==='pearl')return {top:'#edf0f4',middle:'#d3dae3',bottom:'#aeb9c7',outline:'#080c12',mouth:'#d6dee8'};
  return {top:'#c2cbd5',middle:'#aab5c3',bottom:'#7c8d9f',outline:'#080c12',mouth:'#bdc8d6'};
}

/** The exact composing orb engine/preset used by Syka, at its original proportions.
 * The face and gestures are overlays; no alternate shell or silhouette is drawn. */
export function drawSykaOrbBody(ctx: CanvasRenderingContext2D, size: number, seconds: number, dark = true) {
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  ctx.save();ctx.scale(size / 100, size / 100);
  ctx.translate(12, 4);ctx.scale(76 / 64, 76 / 64);
  ribbonDraw(ctx, 64, t * ribbonPreset.speed * .45, dark, ribbonPreset.opts);
  ctx.restore();
}

export function drawSykaMascot(ctx: CanvasRenderingContext2D, size: number, seconds: number,
  activity: MascotActivity, dark = true, reduced = false, face = true, finish: MascotEyeFinish = 'soft', accent = DEFAULT_ACCENT, pointer: MascotPointer = null) {
  let actor = actors.get(ctx);
  if (!actor) { actor = createMascotActor(); actors.set(ctx, actor); }
  const frame = actor.sample(activity, seconds, reduced, pointer);
  const t = reduced ? .6 : Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const motion = reduced ? 0 : 1;
  const beat = Math.sin(t * 3) * motion;
  drawSykaOrbBody(ctx,size,t,dark);
  if (!face) return;
  const rig=mascotFaceLayout(frame), palette=mascotFaceMaterial(finish,accent);
  // Original organic eye silhouettes and morphs from Bloub. Recolour the
  // material, rather than replacing the eyes with a different drawing.
  ctx.save();ctx.scale(size / 100, size / 100);ctx.translate(50+rig.dx,42+rig.dy);ctx.scale(.34,.34);
  for (const eye of frame.eyes) {
    const m=eye.matrix.slice(7,-1).split(',').map(Number);
    ctx.save();ctx.transform(m[0],m[1],m[2],m[3],m[4],m[5]);
    const path=new Path2D(eye.d);
    ctx.globalAlpha=eye.alpha*(finish==='glass'?.66:.94);
    ctx.lineJoin='round';ctx.lineWidth=finish==='glass'||finish==='grok'?3:5;
    ctx.strokeStyle=dark?palette.outline:'#edf0ecc0';ctx.stroke(path);
    const material=ctx.createLinearGradient(-15,-28,18,30);
    if(!dark){material.addColorStop(0,'#657776');material.addColorStop(1,'#223a36');}
    else if(finish==='metal'){
      material.addColorStop(0,'#acbdbc');material.addColorStop(.23,'#71888a');
      material.addColorStop(.43,'#c2ccca');material.addColorStop(.62,'#94a5a5');material.addColorStop(1,'#576d72');
    }else if(finish==='glass'){
      material.addColorStop(0,'#c0d0cd');material.addColorStop(.5,'#a4b9b8');material.addColorStop(1,'#778e91');
    }else{
      material.addColorStop(0,palette.top);material.addColorStop(.52,palette.middle);material.addColorStop(1,palette.bottom);
    }
    ctx.fillStyle=material;ctx.fill(path);
    if(finish==='glass'){
      ctx.globalAlpha=eye.alpha*.72;ctx.lineWidth=1.5;ctx.strokeStyle=dark?'#b7d0ca':'#496761';ctx.stroke(path);
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.save();ctx.scale(size / 100,size / 100);
  ctx.translate(rig.mouthX,rig.mouthY);
  // A small mouth adds a readable reaction to the existing orb, without a shell.
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=1.8;
  ctx.beginPath();
  if(activity==='error')ctx.ellipse(0,1,1.5,1.7,0,0,tau);
  else if(activity==='ready'||activity==='audio'||activity==='question'||activity==='notification'){ctx.moveTo(-4,0);ctx.quadraticCurveTo(0,3.5,4,0);}
  else{ctx.moveTo(-2.5,0);ctx.quadraticCurveTo(0,1,2.5,0);}
  ctx.strokeStyle=dark?palette.mouth:'#18231d';ctx.stroke();ctx.restore();

  // Small props stay outside the face; scene content remains independent.
  ctx.save(); ctx.scale(size / 100, size / 100); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ink = parseColor(accent) ?? DEFAULT_ACCENT;
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.8;
  const line = (a:number,b:number,c:number,d:number) => { ctx.beginPath(); ctx.moveTo(a,b); ctx.lineTo(c,d); ctx.stroke(); };
  const paw = (x:number,y:number,angle=0) => { ctx.beginPath(); ctx.ellipse(x,y,4,2.5,angle,0,tau); ctx.fill(); };
  if (activity === 'audio') {
    ctx.strokeStyle=ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(50,46,34,36,0,Math.PI,tau); ctx.stroke();
    ctx.fillStyle=ink; ctx.beginPath();ctx.roundRect(13,38,7,17,3);ctx.roundRect(80,38,7,17,3);ctx.fill();
    paw(24,79+beat); paw(76,79-beat);
  } else if (activity === 'review') {
    ctx.strokeStyle=ink;ctx.lineWidth=2.6;
    ctx.beginPath();ctx.arc(76+beat,62,10,0,tau);ctx.stroke();line(70+beat,70,64+beat,77);
    paw(65+beat,77,-.7);
  } else if (activity === 'question') {
    paw(86,44+beat*2,-.6); paw(22,77,.2);
  } else if (activity === 'notification') {
    // A restrained wave accompanies the actual notice, without painting a box
    // behind the orb or putting another glyph over its face.
    paw(85,57+beat*4,-.55+beat*.12);paw(22,76,.2);
    ctx.globalAlpha=.55;line(89,43,92,40);line(92,51,96,50);
  } else if (activity === 'reference') {
    ctx.fillStyle=dark?'#111215':'#f0f1f2';ctx.strokeStyle=ink;
    ctx.beginPath();ctx.roundRect(33,72,34,22,4);ctx.fill();ctx.stroke();
    ctx.globalAlpha=.65;line(39,79,59,79);line(39,84,53,84);ctx.globalAlpha=1;
    ctx.fillStyle=ink;paw(29,81,-.3);paw(71,81,.3);
  } else if (activity === 'ready') {
    paw(19,62-beat,.4);paw(81,60+beat,-.4);
  } else if (activity === 'editing' || activity === 'captions') {
    paw(28,80,-.3);paw(73+beat*2,77+beat,.3);
    ctx.strokeStyle=ink;ctx.globalAlpha=.55;ctx.lineWidth=1.2;
    line(31,87,68,87);
    if(activity==='editing')line(52+beat*3,83,52+beat*3,91);
    else {line(34,83,44,83);line(48,83,62,83);}
  }
  ctx.restore();
}

/** Choreography for the demo scene only; never a task progress measurement. */
export function mascotGesture(seconds: number) {
  const p = Math.min(1, Math.max(0, (seconds % 4) / 2.2));
  return p * p * (3 - 2 * p);
}
