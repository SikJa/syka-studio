import {createEffect,onMount,onCleanup} from 'solid-js';
import {createRoot,type Root} from '@/lib/react-root';
import {createElement} from 'react';
import type {Question} from '@diffusionstudio/agent-chat';
import {AgentQuestionNotice,type QuestionNoticePhase} from '@/mirel-chat/features/agents/agent-question-notice';

export function QuestionNotice(props:{question:Question;index:number;count:number;phase:QuestionNoticePhase;selected:string[];onSelect(label:string):void;onCancel():void}) {
  let element!:HTMLDivElement,root:Root;
  onMount(()=>{root=createRoot(element);createEffect(()=>root.render(createElement(AgentQuestionNotice,{question:props.question,index:props.index,count:props.count,phase:props.phase,selected:props.selected,sharedOrb:true,onSelect:props.onSelect,onCancel:props.onCancel})));});
  onCleanup(()=>root?.unmount());
  return <div ref={element} class="syka-question-slot"/>;
}
