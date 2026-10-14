import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { SykaChatOrb } from './mirel-messages';
import { pulseOrb } from '@/lib/orb-motion';
import type {MascotActivity} from '@/lib/syka-mascot';
import {isFreshMascotCue,isMascotTargetVisible,mascotJourneyActivity,referenceMascotSlot,sampleMascotJourney,subscribeMascotCues,type MascotCue,type MascotSlot} from './mascot-journey';

/** One persistent canvas follows the header/activity anchors without being remounted. */
export function ChatIdentityOrb(props: { working: boolean; paused?: boolean; activity?:MascotActivity; projectId?:string }) {
  let anchor!: HTMLSpanElement;
  let frame: number | undefined;
  let activeTarget: Element | undefined;
  const [travel, setTravel] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0, size: 28, visible: false, zIndex: 55 });
  const orbPaused=createMemo(()=>!!props.paused||!position().visible);
  const [theme, setTheme] = createSignal<string | undefined>();
  const [excursion,setExcursion]=createSignal<MascotActivity|null>(null);
  let home={x:0,y:0,size:28,visible:false,zIndex:55};
  let journey:{cue:MascotCue;from:MascotSlot;start:number;referenceTarget?:MascotSlot}|undefined;
  let journeyFrame=0,lastJourneyPaint=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motionReduced=()=>reduced.matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.sykaMotion==='reduced';
  const measure = () => {
    setTheme(anchor.closest('[data-kb-theme]')?.getAttribute('data-kb-theme') ?? undefined);
    const panel = anchor.closest('.syka-agent-chat');
    const target = props.working
      ? panel?.querySelector('[data-chat-orb-anchor="question"]')
        ?? panel?.querySelector('[data-chat-orb-anchor="activity"]')
        ?? [...(panel?.querySelectorAll('[data-chat-message="assistant"] [data-chat-orb-anchor="response"]') ?? [])].at(-1)
        ?? anchor
      : anchor;
    if (activeTarget !== target) {
      setTravel(activeTarget !== undefined);
      activeTarget?.removeAttribute('data-orb-active');
      activeTarget = target;
    }
    if (props.working) target.setAttribute('data-orb-active', 'true');
    else target.removeAttribute('data-orb-active');
    const rect = target.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    let visible = !!panel && !!panelRect?.width && rect.width > 0 && getComputedStyle(panel).visibility !== 'hidden'
      && rect.top >= panelRect.top && rect.bottom <= panelRect.bottom
      && isMascotTargetVisible(rect,{width:innerWidth,height:innerHeight});
    // The portal must respect the transcript's clipping. Otherwise a response
    // scrolled underneath the composer leaves its orb floating over the draft.
    for (let parent = target.parentElement; visible && parent && parent !== panel; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
        const clip = parent.getBoundingClientRect();
        visible = rect.top >= clip.top && rect.bottom <= clip.bottom;
      }
    }
    let zIndex = 55;
    for (let parent = panel; parent; parent = parent.parentElement) {
      const value = Number.parseInt(getComputedStyle(parent).zIndex, 10);
      if (Number.isFinite(value)) zIndex = Math.max(zIndex, value + 1);
    }
    // Question cards reserve a larger anchor. Size the same travelling canvas
    // to that slot rather than leaving a 28px orb inside a hero-sized space.
    const size = target.matches('[data-chat-orb-anchor="question"], [data-chat-orb-anchor="header"]')
      ? (target as HTMLElement).clientWidth || rect.width
      : 28;
    home={ x: rect.left + rect.width / 2 - size / 2, y: rect.top + rect.height / 2 - size / 2, size, visible:visible&&!document.hidden, zIndex };
    if(!journey)setPosition(home);
  };
  const schedule = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  const trackDrag = (event: PointerEvent) => { if (event.buttons) schedule(); };
  const endJourney=()=>{
    cancelAnimationFrame(journeyFrame);journeyFrame=0;journey=undefined;lastJourneyPaint=0;
    setExcursion(null);setTravel(false);measure();
  };
  const destination=(cue:MascotCue):MascotSlot|undefined=>{
    // The timeline reserves its own slot, so the mascot never sits on a tool.
    const node=cue.kind==='timeline'?document.querySelector<HTMLElement>('[data-syka-mascot-target="timeline"]'):undefined;
    const rect=cue.kind==='reference'?cue.origin:node?.getBoundingClientRect();
    if(!rect||!isMascotTargetVisible(rect,{width:innerWidth,height:innerHeight}))return;
    if(cue.kind==='reference'){
      const obstacles=[...document.querySelectorAll<HTMLElement>('button,a,input,textarea,select,label,[role=menuitem],[role=dialog],.syka-resource-card,.syka-resource-reference,.quick-bubble')]
        .filter(element=>!element.matches('.syka-shared-chat-orb')&&!element.closest('[inert]'))
        .map(element=>element.getBoundingClientRect())
        .filter(block=>block.width>0&&block.height>0&&block.right>rect.x-100&&block.left<rect.x+rect.width+100&&block.bottom>rect.y-100&&block.top<rect.y+rect.height+100);
      return referenceMascotSlot(rect,{width:innerWidth,height:innerHeight},obstacles);
    }
    if(node){
      if(getComputedStyle(node).visibility==='hidden')return;
      for(let p=node.parentElement;p;p=p.parentElement){
        if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)){
          const clip=p.getBoundingClientRect();if(rect.x<clip.left||rect.x+rect.width>clip.right)return;
        }
      }
    }
    // Body, hands and prop all fit inside the reserved toolbar slot.
    const size=Math.min(60,rect.width,rect.height);
    return {x:Math.min(innerWidth-size,Math.max(0,rect.x+rect.width/2-size/2)),y:Math.min(innerHeight-size,Math.max(0,rect.y+rect.height/2-size/2)),size};
  };
  const journeyTick=(now:number)=>{
    journeyFrame=0;
    if(!journey)return;
    if(document.hidden||motionReduced()||props.paused||props.activity==='question'||journey.cue.projectId!==props.projectId){endJourney();return;}
    if(now-lastJourneyPaint>=1000/30){
      const target=journey.cue.kind==='reference'?journey.referenceTarget:destination(journey.cue);measure();
      if(!target||!home.visible){endJourney();return;}
      const pose=sampleMascotJourney(journey.from,target,home,now-journey.start);
      if(pose.done){endJourney();return;}
      setExcursion(mascotJourneyActivity(journey.cue.kind,pose.phase));
      setPosition({...home,x:Math.max(0,Math.min(innerWidth-pose.size,pose.x)),y:Math.max(0,Math.min(innerHeight-pose.size,pose.y)),size:pose.size});lastJourneyPaint=now;
    }
    journeyFrame=requestAnimationFrame(journeyTick);
  };
  const startJourney=(cue:MascotCue)=>{
    if(!isFreshMascotCue(cue,props.projectId??'')||props.activity==='question'||props.paused||motionReduced()||document.hidden)return;
    const target=destination(cue);measure();if(!target||!home.visible)return;
    cancelAnimationFrame(journeyFrame);
    journey={cue,from:{...position()},start:performance.now(),referenceTarget:cue.kind==='reference'?target:undefined};
    setTravel(false);setExcursion(mascotJourneyActivity(cue.kind,'outbound'));
    journeyFrame=requestAnimationFrame(journeyTick);
  };
  const trackLayout = () => { if(journey)endJourney();setTravel(false);schedule(); };
  const trackVisibility=()=>{if(document.hidden||motionReduced())endJourney();setTravel(false);schedule();};
  onMount(() => {
    const panel = anchor.closest('.syka-agent-chat');
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    const themeChanges = new MutationObserver(schedule);
    themeChanges.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-kb-theme','data-motion','data-syka-motion'] });
    if (panel) {
      resize.observe(panel);
      mutations.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      panel.addEventListener('scroll', trackLayout, true);
    }
    window.addEventListener('resize', trackLayout);
    window.addEventListener('focus', trackVisibility);
    document.addEventListener('visibilitychange', trackVisibility);
    window.addEventListener('pointermove', trackDrag, { passive: true });
    reduced.addEventListener('change',trackVisibility);
    measure();
    const offCues=subscribeMascotCues(startJourney);
    onCleanup(() => {
      resize.disconnect(); mutations.disconnect(); themeChanges.disconnect();
      panel?.removeEventListener('scroll', trackLayout, true);
      window.removeEventListener('resize', trackLayout);
      window.removeEventListener('focus', trackVisibility);
      document.removeEventListener('visibilitychange', trackVisibility);
      window.removeEventListener('pointermove', trackDrag);
      reduced.removeEventListener('change',trackVisibility);offCues();cancelAnimationFrame(journeyFrame);
      if (frame !== undefined) cancelAnimationFrame(frame);
      activeTarget?.removeAttribute('data-orb-active');
    });
  });
  createEffect(() => {
    props.working;props.activity;
    if(journey&&(props.activity==='question'||props.paused||journey.cue.projectId!==props.projectId))endJourney();
    schedule();
  });
  return <>
    <span ref={anchor} class="syka-orb-anchor" data-chat-orb-anchor="header" aria-hidden="true" />
    <Portal>
      <button type="button" class="syka-shared-chat-orb" data-working={props.working} data-travel={travel()} data-excursion={!!excursion()} data-activity={excursion()??props.activity??'idle'} data-kb-theme={theme()} aria-label="Animar orbe de Syka" aria-hidden={!position().visible} tabIndex={position().visible&&!excursion()?0:-1} onClick={event => pulseOrb(event.currentTarget)}
        style={{ '--chat-orb-size': `${position().size}px`, transform: `translate3d(${position().x}px,${position().y}px,0)`, opacity: position().visible ? 1 : 0, 'pointer-events':position().visible&&!excursion()?'auto':'none', 'z-index': position().zIndex }}>
        <SykaChatOrb working={props.working && !props.paused} paused={orbPaused()} activity={excursion()??props.activity} />
      </button>
    </Portal>
  </>;
}
