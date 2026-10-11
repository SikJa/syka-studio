import type {Question} from '@diffusionstudio/agent-chat';

/** Preserve exact option labels for provider questions that disallow free text. */
export function questionResponse(question:Question,text:string,selected:string[],paths:string[]):string[] {
  const value=text.trim(),options=question.options.map(option=>option.label);
  if(!question.allowOther&&options.length){
    const picked=question.multiSelect?selected.filter(label=>options.includes(label)):options.includes(value)?[value]:[];
    if(!picked.length)throw Error('Elegí una de las opciones de esta pregunta.');
    if(paths.length)throw Error('Esta pregunta solo acepta sus opciones. Adjuntá la referencia en el siguiente mensaje.');
    return picked;
  }
  if(!value&&!selected.length&&!paths.length)throw Error('Escribí una respuesta o elegí una opción.');
  const answer=question.multiSelect&&selected.length?[...selected,...(value&&value!==selected.join(', ')?[value]:[])]:[value||selected.join(', ')];
  if(paths.length)answer.push('Referencias adjuntas (archivos del proyecto):\n'+paths.join('\n'));
  return answer.filter(Boolean);
}
