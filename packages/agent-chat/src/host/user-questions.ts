import type {Question, RequestResponse} from '../protocol';

export const USER_QUESTION_TOOL = {
  type: 'function', name: 'syka_ask_user',
  description: 'Ask contextual questions when the user needs to decide something. For references, briefly inspect real contents first, then include observed context and one concrete recommended direction with an evidence-based reason when useful. A recommendation is never an automatic selection or consent. The agent decides from the full request and existing conversation, not keywords. Displays the animated question in Syka chat and waits for the composer response before continuing. Reuse settled project decisions; do not ask a fixed questionnaire. Use concise Spanish, up to three questions, with optional meaningful choices and free text. Skipping delegates the decision; cancellation stops the request.',
  inputSchema: {type:'object',properties:{questions:{type:'array',minItems:1,maxItems:3,items:{type:'object',properties:{
    id:{type:'string'},header:{type:'string'},question:{type:'string'},
    context:{type:'string',minLength:1,maxLength:340,description:'Brief facts from actual inspection, with source/time when useful. State sampling or access limits; do not invent observations.'},
    recommendation:{type:'object',properties:{label:{type:'string',minLength:1,maxLength:100,description:'One concrete suggested direction. Match a choice label when applicable.'},reason:{type:'string',minLength:1,maxLength:360,description:'Why this direction fits the observed reference and project.'}},required:['label','reason'],additionalProperties:false},
    options:{type:'array',maxItems:6,items:{type:'object',properties:{label:{type:'string'},description:{type:'string'}},required:['label'],additionalProperties:false}},multiSelect:{type:'boolean'}},required:['id','question'],additionalProperties:false}}},required:['questions'],additionalProperties:false},
};

export function parseUserQuestions(raw:unknown):Question[] {
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || Object.keys(raw).some(key=>key!=='questions'))throw Error('Expected questions.');
  const entries=(raw as {questions?:unknown}).questions;
  if(!Array.isArray(entries)||entries.length<1||entries.length>3)throw Error('Ask between one and three contextual questions.');
  const ids=new Set<string>();
  const text=(value:unknown)=>typeof value==='string'?value.trim():'';
  return entries.map(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['id','header','question','context','recommendation','options','multiSelect'].includes(key)))throw Error('Invalid question.');
    const id=text(entry.id),question=text(entry.question);
    if(!id||!question||ids.has(id))throw Error('Question IDs must be unique and each question must have text.');
    ids.add(id);
    const options=entry.options??[];
    if(!Array.isArray(options)||options.length>6)throw Error('At most six choices per question.');
    const labels=new Set<string>();
    const choices=options.map(option=>{
      if(!option||typeof option!=='object'||Array.isArray(option)||Object.keys(option).some(key=>!['label','description'].includes(key)))throw Error('Invalid choice.');
      const label=text(option.label);
      if(!label||labels.has(label))throw Error('Choice labels must be nonempty and unique.');
      labels.add(label);return {label,description:text(option.description)};
    });
    if(entry.multiSelect!==undefined&&typeof entry.multiSelect!=='boolean')throw Error('multiSelect must be boolean.');
    const context=text(entry.context);
    if(entry.context!==undefined&&(!context||context.length>340))throw Error('Observed context must be nonempty and at most 340 characters.');
    let recommendation:Question['recommendation'];
    if(entry.recommendation!==undefined){
      const value=entry.recommendation;
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['label','reason'].includes(key)))throw Error('Invalid recommendation.');
      const label=text(value.label),reason=text(value.reason);
      if(!label||label.length>100||!reason||reason.length>360)throw Error('Recommendation needs a concise direction and reason.');
      recommendation={label,reason};
    }
    return {id,header:text(entry.header).slice(0,12),question,...(context?{context}:{}),...(recommendation?{recommendation}:{}),options:choices,multiSelect:entry.multiSelect===true,allowOther:true,secret:false};
  });
}

export function userQuestionResult(response:RequestResponse){
  return typeof response==='object'?{status:'answered',answers:response.answers,...(response.attachments?.length?{attachments:response.attachments}:{})}:{status:response==='skip'?'skipped':'cancelled',answers:{}};
}
