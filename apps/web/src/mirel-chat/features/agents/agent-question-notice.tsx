/** @jsxImportSource react */
import {Feather,Frame,Sparkles,Check,X} from 'lucide-react';
import type {Question} from '@diffusionstudio/agent-chat';
import {AgentIdentityOrb} from './agent-identity-orb';
import {SYKA_ORB_STATE} from '@/lib/syka-brand';
import {Button} from '@/boardui-react/components/base/buttons/button';
import './agent-question-notice.css';

export type QuestionNoticePhase='source'|'arriving'|'question'|'closing';
const agent={key:'syka',name:'Syka',orbState:SYKA_ORB_STATE,accent:'#a6b4c2'};
const icons=[Feather,Frame,Sparkles];
export function AgentQuestionNotice(props:{question:Question;index:number;count:number;phase:QuestionNoticePhase;selected:string[];sharedOrb?:boolean;onSelect(label:string):void;onCancel():void}) {
  const open=props.phase==='question',orbOpen=open||props.phase==='arriving';
  return <section className="syka-question-notice" aria-labelledby="syka-question-title" aria-hidden={!open} tabIndex={open?0:-1}>
    <button type="button" className="syka-question-cancel" onClick={props.onCancel} aria-label="Cancelar turno" title="Cancelar turno"><X size={13}/></button>
    <div className={`syka-question-orb t-modal ${orbOpen?'is-open':''} ${props.phase==='closing'?'is-closing':''}`}>
      {props.sharedOrb ? <span className="syka-orb-anchor" data-chat-orb-anchor="question" aria-hidden="true" /> : <AgentIdentityOrb agent={agent} variant="hero" paused={false}/>}
      <span className="t-badge" data-open={open?'true':'false'}><span className="t-badge-dot">{props.index+1}</span></span>
    </div>
    <div className={`syka-question-content t-stagger ${open?'is-shown':''} ${props.phase==='closing'?'is-hiding':''}`} inert={!open}>
      {props.count>1&&<small className="syka-question-progress">{props.index+1} de {props.count}</small>}
      <h2 id="syka-question-title" className="t-stagger-line">{props.question.question}</h2>
      {props.question.context&&<p className="syka-question-observation t-stagger-line t-stagger-line--2">{props.question.context}</p>}
      {props.question.recommendation&&<div className="syka-question-recommendation t-stagger-line t-stagger-line--2" role="note" aria-label="Dirección sugerida"><span>Te sugiero: <strong>{props.question.recommendation.label}</strong></span><p>{props.question.recommendation.reason}</p></div>}
      {props.question.options.length>0&&<div className="syka-question-options t-stagger-line t-stagger-line--2" role="group" aria-label="Respuestas rápidas">{props.question.options.map((option,index)=><Button key={option.label} variant="secondary" size="small" className="syka-question-choice" data-tone={index%3} data-recommended={props.question.recommendation?.label===option.label?'true':undefined} leadingIcon={icons[index%3]} aria-pressed={props.selected.includes(option.label)} aria-description={[option.description,props.question.recommendation?.label===option.label?'Dirección sugerida':undefined].filter(Boolean).join('. ')||undefined} onClick={()=>props.onSelect(option.label)}>{option.label}{props.selected.includes(option.label)&&<Check size={10} className="syka-question-check"/>}</Button>)}</div>}
    </div>
  </section>;
}
