/** @jsxImportSource @diffusionstudio/jsx */
import { useTicker } from '@diffusionstudio/jsx';
import { projectCaption, type CaptionCamera, type CaptionPoint } from './projection';

export function DepthCaption(props: {
  id: string; text: string; point: CaptionPoint; cameraAt: (seconds: number) => CaptionCamera;
  start: number; end: number; width: number; fontSize: number; fontFamily: string;
  color: string; reducedMotion?: boolean;
}) {
  if (props.end <= props.start) throw Error('Caption needs positive duration.');
  const { time } = useTicker();
  const duration = () => props.end - props.start;
  const local = () => Math.max(0, Math.min(duration(), time() - props.start));
  const pose = () => projectCaption(props.point, props.cameraAt(props.reducedMotion ? 0 : local()));
  const smooth = (value: number) => { const u = Math.max(0, Math.min(1, value)); return u * u * (3 - 2 * u); };
  const entrance = () => smooth(local() / Math.min(.35, duration() / 3));
  const exit = () => smooth((duration() - local()) / Math.min(.3, duration() / 3));
  return <text id={props.id} name={`Caption · ${props.text}`} start={props.start} end={props.end}
    x={(pose()?.x ?? 0) - props.width * (pose()?.scale ?? 1) / 2}
    y={(pose()?.y ?? 0) - props.fontSize * (pose()?.scale ?? 1) / 2 + (props.reducedMotion ? 0 : 18 * (1 - entrance()))}
    width={props.width * (pose()?.scale ?? 1)} height={props.fontSize * 1.5 * (pose()?.scale ?? 1)}
    fontSize={props.fontSize * (pose()?.scale ?? 1)} fontFamily={props.fontFamily} fontWeight={600}
    textAlign="center" color={props.color} rotation={pose()?.rotation ?? 0}
    opacity={pose() ? entrance() * exit() : 0}>{props.text}</text>;
}
