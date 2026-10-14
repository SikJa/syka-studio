/** @jsxImportSource react */
import {useEffect,useRef,useState} from 'react';
import {BRAND_BY_ID,type ToolBrandInput,resolveToolBrand} from './catalog';
import {loadMarkAsset,unpackPoints,type MarkAsset} from './assets';
import type {LogoState} from './vendor/logoPresets';
import {ThinkingOrb} from 'thinking-orbs';
import {SYKA_ORB_STATE} from '@/lib/syka-brand';
import {useOrbTheme} from '../use-orb-theme';
import './brand-mark.css';

const labels:Record<LogoState,string>={thinking:'Pensando',searching:'Buscando',working:'Trabajando',solving:'Resolviendo',listening:'Escuchando',waiting:'Esperando',generating:'Generando'};
export function BrandMark({id,state='working',active=false,size=26,theme='auto',className=''}:{
  id:string;state?:LogoState;active?:boolean;size?:number;theme?:'dark'|'light'|'auto';className?:string;
}) {
  const host=useRef<HTMLSpanElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [loaded,setLoaded]=useState<{id:string;asset:MarkAsset}|null>(null);
  const [failed,setFailed]=useState(false);
  const [visible,setVisible]=useState(false);
  const [environment,setEnvironment]=useState({dark:true,reduced:false,hidden:false});
  const asset=loaded?.id===id?loaded.asset:null;
  const mark=BRAND_BY_ID.get(id);
  useEffect(()=>{
    let cancelled=false;setFailed(false);
    loadMarkAsset(id).then(asset=>{if(!cancelled)setLoaded({id,asset});}).catch(()=>{if(!cancelled)setFailed(true);});
    return ()=>{cancelled=true;};
  },[id]);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)'),color=matchMedia('(prefers-color-scheme: dark)');
    const sync=()=>{
      const root=document.documentElement;
      const local=host.current?.closest('[data-kb-theme],[data-theme]');
      const declared=local?.getAttribute('data-kb-theme')??local?.getAttribute('data-theme')??root.dataset.theme;
      const dark=theme==='dark'||(theme==='auto'&&(declared?declared==='dark':color.matches));
      const reduced=media.matches||root.dataset.sykaMotion==='reduced'||root.dataset.motion==='reduced';
      const hidden=document.visibilityState==='hidden';
      setEnvironment(old=>old.dark===dark&&old.reduced===reduced&&old.hidden===hidden?old:{dark,reduced,hidden});
    };
    const observer=new MutationObserver(sync);
    observer.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['data-theme','data-kb-theme','data-motion','data-syka-motion']});
    media.addEventListener('change',sync);color.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync();
    const intersection=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
    if(host.current)intersection.observe(host.current);
    return ()=>{observer.disconnect();intersection.disconnect();media.removeEventListener('change',sync);color.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
  },[theme]);
  const moving=active&&visible&&!environment.reduced&&!environment.hidden&&!!asset;
  useEffect(()=>{
    if(!moving||!asset||!canvas.current)return;
    let disposed=false,unsubscribe:(()=>void)|undefined;
    const element=canvas.current;
    import('./renderer').then(({markPainter,subscribeMark})=>{
      if(disposed)return;
      const paint=markPainter(element,unpackPoints(size<=32?asset.small:asset.large),state,size,environment.dark,mark?.tint??'#a6b4c2');
      paint(0);let start:number|undefined;
      unsubscribe=subscribeMark(time=>{start??=time;paint(time-start);});
    }).catch(()=>{if(!disposed)setFailed(true);});
    return ()=>{disposed=true;unsubscribe?.();};
  },[moving,asset,state,size,environment.dark,mark?.tint]);
  return <span ref={host} className={`syka-thinking-logo t-icon-swap ${className}`} data-brand={id} data-moving={moving&&!failed} data-state={moving&&!failed?'b':'a'} data-dark={environment.dark} role="img" aria-label={`${mark?.name??'Herramienta'}${active?`: ${labels[state]}`:''}`} style={{width:size,height:size}}>
    <span className="t-icon" data-icon="a">{asset?<img alt="" draggable={false} className={asset.monochrome?'syka-logo-monochrome':undefined} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.monochrome?asset.markSvg:asset.svg)}`}/>:<span className="syka-logo-placeholder" aria-hidden="true">{failed?'·':''}</span>}</span>
    <canvas ref={canvas} className="t-icon" data-icon="b" aria-hidden="true" style={{width:size,height:size}}/>
  </span>;
}

export function ToolBrandMark({activity,size=26}:{activity:ToolBrandInput;size?:number}) {
  const brand=resolveToolBrand(activity);
  return <span className="syka-tool-brand" title={`${brand.mark.name}${brand.via?` · vía ${brand.via.name}`:''}`} data-failed={activity.state==='failed'}>
    {brand.mark.id==='syka'?<ExistingSykaOrb active={brand.active} size={size}/>:<BrandMark id={brand.mark.id} state={brand.state} active={brand.active} size={size}/>}
    {activity.state==='failed'?<span className="syka-tool-brand-error" aria-label="La herramienta falló">!</span>:null}
  </span>;
}

/** Unknown tools retain the exact existing Syka orb, rather than its baked logo interpretation. */
function ExistingSykaOrb({active,size}:{active:boolean;size:number}) {
  const host=useRef<HTMLSpanElement>(null);const theme=useOrbTheme(host);
  return <span ref={host} data-brand="syka" aria-hidden="true" style={{width:size,height:size,display:'grid',placeItems:'center'}}><ThinkingOrb state={SYKA_ORB_STATE} size={20} theme={theme} paused={!active}/></span>;
}
