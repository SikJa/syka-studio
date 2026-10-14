/** @jsxImportSource @diffusionstudio/jsx */
/** Original Syka implementation; screenshot content is supplied by the project. */
import { useTicker } from '@diffusionstudio/jsx';
import { demoState } from './launch-time';
export type ProductDemoProps = {
  id: string; start: number; end: number; beforeSrc: string; afterSrc: string;
  action: string; result: string; revealAt?: number; accent?: string; reducedMotion?: boolean;
  x?: number; y?: number; width?: number; height?: number;
};
export default function ProductDemo(props: ProductDemoProps) {
  const { time } = useTicker();
  const state = () => demoState(time() - props.start, props.revealAt ?? 1.2, props.reducedMotion);
  const width = () => props.width ?? 1280, height = () => props.height ?? 720;
  const scale = () => Math.min(width() / 1280, height() / 720);
  return <html id={props.id} name="Demo · acción y resultado" start={props.start} end={props.end}
    x={props.x ?? 0} y={props.y ?? 0} width={width()} height={height()}>
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#09090b', color: '#f3f3f5', 'font-family': 'Inter, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '6%', top: '5%', right: '6%', height: '10%', 'font-size': `${30 * scale()}px`, 'font-weight': 550 }}>
        <div style={{ position: 'absolute', opacity: state().before }}>{props.action}</div>
        <div style={{ position: 'absolute', opacity: state().after }}>{props.result}</div>
      </div>
      <div style={{ position: 'absolute', left: '6%', right: '6%', top: '18%', bottom: '8%', 'border-radius': `${20 * scale()}px`, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', background: '#111113' }}>
        <img src={props.beforeSrc} alt="Estado anterior del producto" style={{ position: 'absolute', width: '100%', height: '100%', 'object-fit': 'contain', opacity: state().before }} />
        <img src={props.afterSrc} alt="Resultado del producto" style={{ position: 'absolute', width: '100%', height: '100%', 'object-fit': 'contain', opacity: state().after }} />
        <div style={{ position: 'absolute', left: '0', bottom: '0', height: `${2 * scale()}px`, width: `${100 * state().progress}%`, background: props.accent ?? '#a6b7b2' }} />
      </div>
    </div>
  </html>;
}
