/** @jsxImportSource @diffusionstudio/jsx */
import { useTicker } from '@diffusionstudio/jsx';
import { arrive, mix, smooth, unit, visibility } from './motion-clock';

export type EditorialCalloutProps = {
  id: string; start: number; end: number; x: number; y: number;
  width?: number; height?: number; label: string; title: string;
  evidence: string; detail: string; accent?: string; surface?: string;
  ink?: string; reducedMotion?: boolean;
};

export default function EditorialCallout(props: EditorialCalloutProps) {
  const {time} = useTicker();
  const t = () => time() - props.start;
  const duration = () => props.end - props.start;
  const morph = () => props.reducedMotion ? 1 : smooth(unit(t(), .92, .72));
  const entry = () => arrive(unit(t(), 0, .48));
  const proof = () => props.reducedMotion ? 1 : arrive(unit(t(), 1.64, .38));
  const exit = () => smooth(unit(t(), duration() - .32, .32));
  const scale = () => (props.width ?? 920) / 920;
  const accent = () => props.accent ?? '#1689d8';
  const ink = () => props.ink ?? '#152029';
  return <html id={props.id} name={`Tarjeta · ${props.label}`} x={props.x} y={props.y}
    width={props.width ?? 920} height={props.height ?? 500} start={props.start} end={props.end}>
    <div style={{position:'relative',width:'100%',height:'100%',overflow:'visible',
      opacity:visibility(t(),duration(),props.reducedMotion),
      transform:`translateY(${props.reducedMotion ? 0 : mix(26,0,entry()) - exit()*12}px)`,
      'font-family':'Inter, sans-serif',color:ink()}}>
      <div style={{position:'absolute',left:'0',top:'0',
        width:`${mix(70,100,morph())}%`,height:`${mix(62,100,morph())}%`,
        background:props.surface ?? '#f0f3f7',
        'border-radius':`${mix(40,24,morph())*scale()}px`,
        border:'1px solid rgba(255,255,255,.35)',
        'box-shadow':'0 18px 48px rgba(0,0,0,.20)'}} />
      <div style={{position:'absolute',left:'5%',top:'7%',color:accent(),
        'font-size':`${17*scale()}px`,'font-weight':650,'letter-spacing':'.12em',
        'text-transform':'uppercase',opacity:unit(t(),1.20,.28)}}>{props.label}</div>
      <div style={{position:'absolute',left:'5%',top:'0',width:'90%',
        'white-space':'pre-line','font-size':`${70*scale()}px`,'font-weight':700,
        'letter-spacing':'-.035em','line-height':'1.08','transform-origin':'0 0',
        color:ink(),
        transform:`translateY(${mix(100,68,morph())*scale()}px) scale(${mix(1,.66,morph())})`}}>{props.title}</div>
      <div style={{position:'absolute',left:'5%',right:'5%',top:'41%',height:'1px',
        background:`rgba(21,32,41,${.16*proof()})`,width:`${90*proof()}%`}} />
      <div style={{position:'absolute',left:'5%',right:'6%',top:'49%',
        opacity:proof(),transform:`translateY(${props.reducedMotion ? 0 : (1-proof())*16}px)`}}>
        <div style={{'font-size':`${40*scale()}px`,'font-weight':600,'letter-spacing':'-.025em',
          'line-height':'1.18',color:ink()}}>{props.evidence}</div>
        <div style={{'font-size':`${23*scale()}px`,'font-weight':450,'line-height':'1.4',
          color:'#46535f','margin-top':`${20*scale()}px`,'max-width':'94%'}}>{props.detail}</div>
      </div>
      <div style={{position:'absolute',bottom:'7%',left:'5%',display:'flex',
        'align-items':'center',gap:'10px',color:'#46535f','font-size':`${18*scale()}px`}}>
        <span style={{width:'6px',height:'6px','border-radius':'50%',background:accent(),visibility:proof()>0?'visible':'hidden'}} />
        <span style={{opacity:proof()}}>Un video, de principio a fin.</span>
      </div>
    </div>
  </html>;
}
