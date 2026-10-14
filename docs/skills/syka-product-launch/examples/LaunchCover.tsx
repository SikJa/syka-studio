/** @jsxImportSource @diffusionstudio/jsx */
import { useTicker } from '@diffusionstudio/jsx';
import { coverLight } from './launch-time';
export type LaunchCoverProps = {
  id: string; start: number; end: number; title: string; subtitle: string; brand?: string; logoSrc?: string;
  ambient?: boolean; reducedMotion?: boolean; accent?: string; x?: number; y?: number; width?: number; height?: number;
};
export default function LaunchCover(props: LaunchCoverProps) {
  const { time } = useTicker();
  const light = () => coverLight(time() - props.start, props.ambient ?? true, props.reducedMotion);
  const width = () => props.width ?? 1280, height = () => props.height ?? 720;
  const scale = () => Math.min(width() / 1280, height() / 720);
  return <html id={props.id} name="Lanzamiento · portada y cierre" start={props.start} end={props.end}
    x={props.x ?? 0} y={props.y ?? 0} width={width()} height={height()}>
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#080809', color: '#f4f4f5', 'font-family': 'Inter, sans-serif' }}>
      <div style={{ position: 'absolute', left: `${light().x - 28}%`, top: '-25%', width: '56%', height: '145%', 'border-radius': '50%', background: props.accent ?? '#a6b7b2', filter: `blur(${90 * scale()}px)`, opacity: light().opacity }} />
      <div style={{ position: 'absolute', left: '9%', right: '9%', top: '20%', bottom: '12%', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', gap: `${24 * scale()}px` }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: `${12 * scale()}px`, 'font-size': `${20 * scale()}px`, color: '#a6a6ad' }}>
          {props.logoSrc ? <img src={props.logoSrc} alt="" style={{ width: `${36 * scale()}px`, height: `${36 * scale()}px`, 'object-fit': 'contain' }} /> : null}
          <span>{props.brand ?? ''}</span>
        </div>
        <div style={{ 'font-size': `${76 * scale()}px`, 'line-height': '1.06', 'font-weight': 600, 'letter-spacing': '-.035em', 'white-space': 'pre-line', 'overflow-wrap': 'anywhere' }}>{props.title}</div>
        <div style={{ 'font-size': `${28 * scale()}px`, 'line-height': '1.4', 'max-width': '85%', color: '#b8b8c0', 'white-space': 'pre-line' }}>{props.subtitle}</div>
      </div>
    </div>
  </html>;
}
