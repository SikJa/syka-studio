/** @jsxImportSource @diffusionstudio/jsx */
/** Syka original adaptation inspired by HyperFrames Circle Carousel 3 by Jake Moran.
 * Analytic 2.5D poses. No upstream photography, rig source or GSAP dependency.
 */
import { useTicker } from '@diffusionstudio/jsx';
import { For } from 'solid-js';
import { carouselProgress, mix, phase, out } from './motion-time';
export type CircleGalleryProps = {
  id: string; start: number; end: number; images: string[];
  title?: string; subtitle?: string; accent?: string; width?: number; height?: number;
  x?: number; y?: number; secondsPerCard?: number; fit?: 'cover' | 'contain'; reducedMotion?: boolean;
};
export default function CircleGallery(props: CircleGalleryProps) {
  const {time} = useTicker();
  const t = () => time() - props.start;
  const w = () => props.width ?? 1280, h = () => props.height ?? 720;
  const s = () => Math.min(w()/1280, h()/720);
  const images = () => props.images.slice(0,12);
  const count = () => Math.max(1,images().length);
  const progress = () => props.reducedMotion ? 0 : carouselProgress(t(),props.secondsPerCard ?? 2.2);
  const pose = (i: number) => {
    const a = (i-progress())*Math.PI*2/count(), depth = (Math.cos(a)+1)/2;
    const size = mix(.44,1,depth), cardW = 250*s()*size, cardH = 306*s()*size;
    const entry = props.reducedMotion ? 1 : out(phase(t(),i*.035,.55));
    return {x:w()/2 + Math.sin(a)*Math.min(465*s(),w()*.35)-cardW/2,
      y:h()*.51+Math.cos(a)*h()*.13-cardH/2+(1-entry)*90*s(),
      w:cardW,h:cardH,depth,rotation:Math.sin(a)*-9,z:Math.round(depth*100)};
  };
  const active = () => Math.round(progress())%count();
  return <group id={props.id} name="Carrusel circular · imágenes" start={props.start} end={props.end}>
    <animation type="fade" duration={props.reducedMotion ? .12 : .24}/>
    <html id={`${props.id}-arte`} x={props.x ?? 0} y={props.y ?? 0}
    width={w()} height={h()} start={0} end={props.end-props.start}>
    <div style={{position:'relative',width:'100%',height:'100%','font-family':'Inter, Arial, sans-serif',color:'#f3f4f1'}}>
      <div style={{position:'absolute',left:'5%',right:'5%',top:'5%','text-align':'center'}}>
        <div style={{'font-size':`${14*s()}px`,'letter-spacing':'.15em','text-transform':'uppercase',color:props.accent ?? '#b6e9a6','margin-bottom':`${14*s()}px`}}>{props.subtitle ?? 'CADA IMAGEN, SU MOMENTO'}</div>
        <div style={{'font-size':`${46*s()}px`,'line-height':'1.05','letter-spacing':'-.045em','font-weight':550}}>{props.title ?? 'De la referencia a tu historia.'}</div>
      </div>
      <For each={images()}>{(image,index) => <div style={{position:'absolute',left:`${pose(index()).x}px`,top:`${pose(index()).y}px`,
        width:`${pose(index()).w}px`,height:`${pose(index()).h}px`,'z-index':pose(index()).z,
        transform:`rotate(${pose(index()).rotation}deg)`,'border-radius':`${18*s()}px`,
        background:'#20231f','box-shadow':`0 ${18*s()}px ${48*s()}px rgba(0,0,0,.4)`,border:'1px solid rgba(255,255,255,.16)'}}>
        <img src={image} alt="" style={{width:'100%',height:'100%','object-fit':props.fit ?? 'cover','border-radius':`${18*s()}px`}}/>
      </div>}</For>
      <div style={{position:'absolute',bottom:'7%',left:'0',right:'0',display:'flex','justify-content':'center',gap:`${8*s()}px`}}>
        <For each={images()}>{(_,index) => <span style={{width:`${(active()===index()?24:5)*s()}px`,height:`${5*s()}px`,'border-radius':`${3*s()}px`,background:active()===index()?(props.accent ?? '#b6e9a6'):'#52574f'}}/>}</For>
      </div>
    </div>
  </html></group>;
}
