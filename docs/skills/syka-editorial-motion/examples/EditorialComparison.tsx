/** @jsxImportSource @diffusionstudio/jsx */
import { useTicker } from '@diffusionstudio/jsx';
import { arrive, mix, unit, visibility } from './motion-clock';

export default function EditorialComparison(props: {
  id: string; start: number; end: number; x: number; y: number;
  width?: number; height?: number; label: string; title: string;
  before: string; after: string; note: string; accent?: string; reducedMotion?: boolean;
}) {
  const {time} = useTicker();
  const t = () => time() - props.start;
  const reveal = () => props.reducedMotion ? 1 : arrive(unit(t(), .6, .68));
  const scale = () => (props.width ?? 1080)/1080;
  const accent = () => props.accent ?? '#1689d8';
  return <html id={props.id} name={`Comparación · ${props.label}`} x={props.x} y={props.y}
    width={props.width ?? 1080} height={props.height ?? 460} start={props.start} end={props.end}>
    <div style={{position:'relative',width:'100%',height:'100%',
      'box-sizing':'border-box','font-family':'Inter, sans-serif',color:'#f5f7fa',background:'#111820',
      'border-radius':`${26*scale()}px`,padding:`${30*scale()}px ${32*scale()}px`,
      'box-shadow':'0 18px 48px rgba(0,0,0,.20)',
      opacity:visibility(t(),props.end-props.start,props.reducedMotion),
      transform:`translateY(${props.reducedMotion ? 0 : (1-arrive(unit(t(),0,.45)))*20}px)`}}>
      <div style={{'font-size':`${17*scale()}px`,'font-weight':650,color:accent(),
        'letter-spacing':'.12em','text-transform':'uppercase'}}>{props.label}</div>
      <div style={{'font-size':`${54*scale()}px`,'font-weight':650,'letter-spacing':'-.035em',
        'margin-top':`${17*scale()}px`,'line-height':'1.1'}}>{props.title}</div>
      <div style={{position:'absolute',top:'38%',left:'3%',width:'31%',height:'43%',
        'box-sizing':'border-box','border-top':'1px solid #454b52',padding:`${20*scale()}px 0`}}>
        <div style={{'font-size':`${18*scale()}px`,color:'#b8c3ce','margin-bottom':`${18*scale()}px`}}>FRAGMENTADO</div>
        <div style={{'white-space':'pre-line','font-size':`${29*scale()}px`,'line-height':'1.3',color:'#d8dfe5'}}>{props.before}</div>
      </div>
      <div style={{position:'absolute',top:'38%',right:'3%',width:'59%',height:'43%',
        'box-sizing':'border-box',background:'#f0f3f7','border-radius':`${20*scale()}px`,padding:`${26*scale()}px ${30*scale()}px`,
        color:'#152029','clip-path':`inset(0 ${100*(1-reveal())}% 0 0 round ${20*scale()}px)`}}>
        <div style={{'font-size':`${18*scale()}px`,color:accent(),'font-weight':650,
          'margin-bottom':`${17*scale()}px`}}>FRASE COMPLETA</div>
        <div style={{'white-space':'pre-line','font-size':`${43*scale()}px`,'font-weight':600,'letter-spacing':'-.025em',
          'line-height':'1.2'}}>{props.after}</div>
      </div>
      <div style={{position:'absolute',bottom:'6%',left:'3%',width:'94%',
        'font-size':`${23*scale()}px`,color:'#c0cad4','line-height':'1.35',opacity:unit(t(),1.18,.25)}}>{props.note}</div>
    </div>
  </html>;
}
