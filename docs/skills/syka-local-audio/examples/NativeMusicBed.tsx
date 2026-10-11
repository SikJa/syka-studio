import { audioEnvelope, type AudioEnvelopeOptions } from './audio-envelope';

/** Copy both example files into the project before importing this component. */
export function NativeMusicBed(props: AudioEnvelopeOptions & { id: string; src: string; name?: string }) {
  const start=props.start??0,sourceIn=props.sourceIn??0,playbackRate=props.playbackRate??1;
  const points=audioEnvelope(props);
  return <audio id={props.id} name={props.name??'Música de fondo'} src={props.src}
    start={start} end={start+props.duration} sourceIn={sourceIn} sourceOut={sourceIn+props.duration*playbackRate} playbackRate={playbackRate}>
    <keyframeTrack id={props.id+'-volume'} property="volume">
      {points.map((point,index)=><keyframe id={props.id+'-volume-'+index} time={point.sourceTime} value={point.volumeDb} easing="linear"/>)}
    </keyframeTrack>
  </audio>;
}
