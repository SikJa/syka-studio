/** @jsxImportSource @diffusionstudio/jsx */
import { useTicker } from '@diffusionstudio/jsx';
import { focusState } from './launch-time';
export type ProductFocusProps = {
  id: string; start: number; end: number; label: string;
  target: { x: number; y: number; width: number; height: number };
  clickAt?: number; x?: number; y?: number; width?: number; height?: number;
  accent?: string; reducedMotion?: boolean;
};
export default function ProductFocus(props: ProductFocusProps) {
  const { time } = useTicker();
  const state = () => focusState(time() - props.start, props.clickAt ?? .9, props.reducedMotion);
  const width = () => props.width ?? 1280, height = () => props.height ?? 720;
  const scale = () => Math.min(width() / 1280, height() / 720);
  const color = () => props.accent ?? '#b0c2ba';
  const cx = () => props.target.x + props.target.width / 2;
  const cy = () => props.target.y + props.target.height / 2;
  return <html id={props.id} name={`Foco · ${props.label}`} start={props.start} end={props.end}
    x={props.x ?? 0} y={props.y ?? 0} width={width()} height={height()}>
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', 'font-family': 'Inter, sans-serif' }}>
      <div style={{ position: 'absolute', left: `${props.target.x}px`, top: `${props.target.y}px`, width: `${props.target.width}px`, height: `${props.target.height}px`, 'box-sizing': 'border-box', border: `1px solid ${color()}`, 'border-radius': `${8 * scale()}px`, opacity: state().arrive }} />
      <div style={{ position: 'absolute', left: `${props.target.x}px`, top: `${Math.max(4, props.target.y - 34 * scale())}px`, 'max-width': `${Math.max(0, width() - props.target.x - 8)}px`, overflow: 'hidden', 'white-space': 'nowrap', 'text-overflow': 'ellipsis', background: 'rgba(8,8,10,.86)', color: '#eeeeef', padding: `${4 * scale()}px ${9 * scale()}px`, 'border-radius': `${6 * scale()}px`, 'font-size': `${18 * scale()}px`, opacity: state().arrive }}>{props.label}</div>
      <div style={{ position: 'absolute', left: `${cx() - (1 - state().arrive) * 55 * scale()}px`, top: `${cy() + (1 - state().arrive) * 45 * scale()}px`, opacity: state().cursorVisible ? 1 : 0, transform: `scale(${1 - state().pulse * .14})`, 'transform-origin': '0 0' }}>
        <svg width={24 * scale()} height={30 * scale()} viewBox="0 0 24 30"><path d="M2 2 L2 24 L8 19 L13 28 L18 25 L12 16 L21 16 Z" fill="#f4f4f5" stroke="#09090b" stroke-width="2" /></svg>
      </div>
    </div>
  </html>;
}
