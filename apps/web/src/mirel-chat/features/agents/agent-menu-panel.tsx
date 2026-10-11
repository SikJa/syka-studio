/** @jsxImportSource react */
import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './agent-menu-panel.css';

/** Window coordinates must live outside the transformed/scrolling chat rail. */
export function AgentMenuPanel({anchor,label,onDismiss,children,className=''}:{anchor:HTMLElement;label:string;onDismiss():void;children:ReactNode;className?:string}) {
  const popup=useRef<HTMLDivElement>(null),dismiss=useRef(onDismiss);
  dismiss.current=onDismiss;
  const [position,setPosition]=useState({left:8,top:8});
  useLayoutEffect(()=>{
    const panel=popup.current!;
    const place=()=>{
      const rect=anchor.getBoundingClientRect(),box={width:panel.offsetWidth,height:panel.offsetHeight};
      setPosition({left:Math.max(8,Math.min(rect.right-box.width,window.innerWidth-box.width-8)),top:Math.max(8,Math.min(rect.bottom+4+box.height<=window.innerHeight-8?rect.bottom+4:rect.top-box.height-4,window.innerHeight-box.height-8))});
    };
    const close=(restore=false)=>{dismiss.current();if(restore&&anchor.isConnected)anchor.focus();};
    const outside=(event:Event)=>{if(event.target instanceof Node&&!panel.contains(event.target)&&!anchor.contains(event.target))close();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}};
    const scroll=(event:Event)=>{if(!(event.target instanceof Node)||!panel.contains(event.target))close();};
    const other=(event:Event)=>{if((event as CustomEvent).detail!==panel)close();};
    place();
    panel.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled)')?.focus();
    const observer=new ResizeObserver(place);observer.observe(panel);
    document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
    document.addEventListener('keydown',escape);window.addEventListener('resize',scroll);
    window.addEventListener('scroll',scroll,true);document.addEventListener('syka-menu-open',other);
    document.dispatchEvent(new CustomEvent('syka-menu-open',{detail:panel}));
    return()=>{observer.disconnect();document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',scroll);window.removeEventListener('scroll',scroll,true);document.removeEventListener('syka-menu-open',other);};
  },[anchor]);
  return createPortal(<div ref={popup} className={`syka-agent-menu ${className}`} role="dialog" aria-label={label} style={position} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss.current();anchor.focus();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&!(event.target instanceof HTMLInputElement)){
      const items=Array.from(popup.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index=items.indexOf(document.activeElement as HTMLButtonElement);
      if(items.length){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    }
    event.stopPropagation();
  }} onKeyUp={event=>event.stopPropagation()}>{children}</div>,document.body);
}
