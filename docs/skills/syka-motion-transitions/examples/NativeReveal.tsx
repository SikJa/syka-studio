/** @jsxImportSource @diffusionstudio/jsx */
import { revealTiming } from './motion-timing';

// Technical timing study, not a prescribed art direction or launch-video template.
const config = {
  headline: 'De una idea a tu edición.',
  support: 'Texto, imagen y ritmo. Bajo tu control.',
  accent: '#5CB9FF',
  reducedMotion: false,
};
const smooth = 'cubicBezier(0.22,1,0.36,1)';

export function RevealText(props: {
  id: string; text: string; x: number; y: number; width: number; size: number;
  start: number; end: number; color: string; reducedMotion?: boolean;
}) {
  const t = revealTiming(props.end - props.start);
  return (
    <text id={props.id} name={props.text} x={props.x} y={props.y} width={props.width}
      height={props.size * 1.5} fontSize={props.size} fontFamily="Inter" fontWeight={600}
      color={props.color} start={props.start} end={props.end}>
      {props.text}
      <keyframeTrack property="offsetY">
        <keyframe time={0} value={props.reducedMotion ? 0 : 24} easing={smooth} />
        <keyframe time={t.inEnd} value={0} />
      </keyframeTrack>
      <keyframeTrack property="opacity">
        <keyframe time={0} value={0} easing={smooth} />
        <keyframe time={t.inEnd} value={1} />
        <keyframe time={t.outStart} value={1} easing="easeOut" />
        <keyframe time={t.duration} value={0} />
      </keyframeTrack>
      <effect type="blur" value={0}>
        <keyframeTrack property="value">
          <keyframe time={0} value={props.reducedMotion ? 0 : 3} easing={smooth} />
          <keyframe time={t.inEnd} value={0} />
        </keyframeTrack>
      </effect>
    </text>
  );
}

export default function NativeReveal() {
  return (
    <stage>
      <scene name="Transition timing study" width={1920} height={1080} fill="#101114" active>
        <rect id="motion-panel" name="Panel editable" x={120} y={230} width={1680} height={620}
          fill="#191C22" cornerRadius={36} start={0} end={4}>
          <keyframeTrack property="offsetY">
            <keyframe time={0} value={config.reducedMotion ? 0 : 70} easing={smooth} />
            <keyframe time={0.4} value={0} />
          </keyframeTrack>
          <keyframeTrack property="opacity">
            <keyframe time={0} value={0} easing={smooth} />
            <keyframe time={0.4} value={1} />
            <keyframe time={3.65} value={1} easing="easeOut" />
            <keyframe time={4} value={0} />
          </keyframeTrack>
        </rect>
        <RevealText id="motion-title" text={config.headline} x={210} y={380} width={1500}
          size={84} color="#F8F9FC" start={0.2} end={3.8} reducedMotion={config.reducedMotion} />
        <RevealText id="motion-support" text={config.support} x={214} y={510} width={1450}
          size={42} color={config.accent} start={0.2 + 2 / 30} end={3.8} reducedMotion={config.reducedMotion} />
      </scene>
    </stage>
  );
}
