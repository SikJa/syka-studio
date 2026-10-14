/** @jsxImportSource react */
import {useEffect, useRef, useState} from 'react';
import {RobotHead, type RobotHeadState} from 'robot-heads';
import {MASCOT_LABELS, type MascotActivity} from '@/lib/syka-mascot';

const states: Record<MascotActivity, RobotHeadState> = {
  idle:'idle', thinking:'thinking', editing:'searching', captions:'speaking', audio:'listening',
  review:'searching', question:'listening', notification:'happy', reference:'searching', ready:'happy', error:'error',
};

/** Actual Robot Heads renderer. Avoid its decorative progress bar: no fake percentage.
 * Pause offscreen, when hidden, and under reduced motion. */
export function SykaRobotMascot({activity, size=36, paused=false, interactive=false}: {
  activity:MascotActivity; size?:number; paused?:boolean; interactive?:boolean;
}) {
  const host=useRef<HTMLSpanElement>(null);
  const [rest,setRest]=useState(true);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');let visible=false;
    const sync=()=>setRest(!visible||document.hidden||media.matches);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    if(host.current)observer.observe(host.current);
    document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);sync();
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);};
  },[]);
  return <span ref={host} className="syka-robot-mascot" role="img" aria-label={MASCOT_LABELS[activity]}
    style={{display:'inline-flex',width:size,height:size,overflow:'visible'}}>
    <RobotHead shape="square" size={size} state={states[activity]} color="#353e3c" trimColor="#87958e"
      screenColor="#d8ecd8" speed={.7} paused={paused||rest} interactive={interactive&&!paused&&!rest}
      antenna={size>=70} floorShadow={false}/>
  </span>;
}
