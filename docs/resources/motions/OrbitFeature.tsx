/** @jsxImportSource @diffusionstudio/jsx */
/** Syka original 2.5D adaptation inspired by HyperFrames Orbit Card.
 * No Blender curves, Three.js/GSAP runtime, bundled fonts or upstream media copied.
 * The illustration and card use the native scene clock, not a wall-clock loop.
 */
import { useTicker } from '@diffusionstudio/jsx';
import { For } from 'solid-js';
import { phase, out, smooth, mix } from './motion-time';

export type OrbitFeatureProps = {
  id: string; start: number; end: number; title: string; detail: string;
  label?: string; accent?: string; width?: number; height?: number;
  x?: number; y?: number; reducedMotion?: boolean;
};
const points = Array.from({length: 180}, (_, i) => {
  const y = 1 - i / 179 * 2, r = Math.sqrt(1 - y*y), a = i * 2.399963229728653;
  return {x:Math.cos(a)*r, y, z:Math.sin(a)*r};
});
export default function OrbitFeature(props: OrbitFeatureProps) {
  const {time} = useTicker();
  const t = () => time() - props.start;
  const duration = () => props.end - props.start;
  const w = () => props.width ?? 1280, h = () => props.height ?? 720;
  const s = () => Math.min(w()/1280, h()/720);
  const accent = () => props.accent ?? '#b6e9a6';
  const entry = () => props.reducedMotion ? 1 : out(phase(t(), .1, .9));
  const orbit = () => props.reducedMotion ? 0 : smooth(phase(t(), duration()*.44, Math.min(1.8,duration()*.24)))*Math.PI*2;
  const turn = () => props.reducedMotion ? 0 : (1-entry())*38 + Math.sin(orbit())*24;
  const centerX = () => w()/2 + (1-entry())*220*s() + Math.sin(orbit())*115*s();
  const cardW = () => 520*s(), cardH = () => 550*s();
  const sphere = (p: typeof points[number]) => {
    const angle = props.reducedMotion ? .5 : t()*.36;
    const x = p.x*Math.cos(angle)-p.z*Math.sin(angle), z = p.x*Math.sin(angle)+p.z*Math.cos(angle);
    const k = 1/(1-z*.16);
    return {x:150+x*111*k, y:150+p.y*111*k, r:mix(1.0,2.5,(z+1)/2), a:mix(.18,.95,(z+1)/2)};
  };
  return <group id={props.id} name={props.label ?? 'Órbita · tarjeta'} start={props.start} end={props.end}>
    <animation type="fade" duration={props.reducedMotion ? .12 : .24}/>
    <html id={`${props.id}-arte`} x={props.x ?? 0} y={props.y ?? 0}
    width={w()} height={h()} start={0} end={duration()}>
    <div style={{position:'relative',width:'100%',height:'100%',color:'#f4f4ec','font-family':'Inter, Arial, sans-serif'}}>
      <div style={{position:'absolute',left:`${w()/2-280*s()}px`,top:`${h()/2-260*s()}px`,width:`${560*s()}px`,height:`${530*s()}px`,'border-radius':'50%',background:'radial-gradient(ellipse,rgba(144,203,118,.12),transparent 68%)'}}/>
      <div style={{position:'absolute',left:`${centerX()-cardW()/2}px`,top:`${h()/2-cardH()/2+(props.reducedMotion?0:Math.sin(t()*1.05)*4*s())}px`,
        width:`${cardW()}px`,height:`${cardH()}px`,'border-radius':`${32*s()}px`,
        background:'linear-gradient(145deg,#232821,#101310 72%)',border:'1px solid rgba(226,241,218,.18)',
        'box-shadow':`0 ${30*s()}px ${90*s()}px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.06)`,
        transform:`perspective(${1500*s()}px) rotateY(${turn()}deg) rotateZ(${Math.sin(orbit())*-3}deg)`}}>
        <div style={{position:'absolute',left:`${32*s()}px`,top:`${28*s()}px`,display:'flex','align-items':'center',gap:`${10*s()}px`,color:accent(),'font-size':`${13*s()}px`,'font-weight':600,'letter-spacing':'.17em','text-transform':'uppercase'}}>
          <span style={{width:`${6*s()}px`,height:`${6*s()}px`,'border-radius':'50%',background:accent()}}/>{props.label ?? 'UNA IDEA, EN FOCO'}
        </div>
        <svg viewBox="0 0 300 300" width={280*s()} height={280*s()} style={{position:'absolute',left:`${cardW()/2-140*s()}px`,top:`${61*s()}px`,color:accent()}}>
          <For each={points}>{point => <circle cx={sphere(point).x} cy={sphere(point).y} r={sphere(point).r} fill="currentColor" fill-opacity={sphere(point).a}/>}</For>
        </svg>
        <div style={{position:'absolute',left:`${36*s()}px`,right:`${36*s()}px`,top:`${338*s()}px`}}>
          <div style={{height:'1px',background:'rgba(240,246,232,.14)','margin-bottom':`${25*s()}px`}}/>
          <div style={{'font-size':`${40*s()}px`,'font-weight':600,'letter-spacing':'-.045em','line-height':'1.08','max-width':'98%'}}>{props.title}</div>
          <div style={{'font-size':`${19*s()}px`,'line-height':'1.45',color:'#b9c0b4','margin-top':`${15*s()}px`}}>{props.detail}</div>
        </div>
      </div>
    </div>
  </html></group>;
}
