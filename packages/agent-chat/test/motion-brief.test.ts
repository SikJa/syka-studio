import {describe,it,expect} from 'vitest';
import {parseUserQuestions,userQuestionResult} from '../src/host/user-questions';
import {withAttachments,chatInstructions} from '../src/host/harness';
describe('model-selected contextual questions',()=>{
  it('reminds existing sessions to inspect links and attachments before recommending a direction, without classifying intent',()=>{
    for(const message of ['https://www.instagram.com/p/images/','Analizá https://example.com/document','Tomá la tipografía de https://example.com/page']){
      const input=withAttachments(message,['C:/video.mp4']);
      expect(input).toContain('Reference inspection contract for ALL links and attachments');
      expect(input).toContain('ALWAYS call syka_ask_user and wait');
      expect(input).toContain('If a specific purpose was already explicitly supplied');
      expect(input).toContain(message+'\n\nAttached files and folders:\nC:/video.mp4');
    }
    expect(withAttachments('Bajá el volumen de la voz',[])).toBe('Bajá el volumen de la voz');
    expect(withAttachments('¿Qué podemos hacer con esta foto?',['C:/foto.jpg'])).toContain('first briefly inspect the actual reference');
    expect(withAttachments('Adaptá esta referencia',['C:/brief.md'])).toContain('recommend one concrete direction');
    expect(chatInstructions('project')).toContain('social posts containing images');
  });
  it('carries observed context and a recommendation without selecting or restricting an answer',()=>{
    const [question]=parseUserQuestions({questions:[{id:'direction',question:'¿Buscás venderlo o explicar su uso?',context:'La foto muestra un producto central sobre fondo limpio.',recommendation:{label:'Presentar dos beneficios',reason:'Mantiene el producto como foco y aprovecha el espacio disponible.'},options:[{label:'Presentar dos beneficios'},{label:'Mostrar cómo funciona'}]}]});
    expect(question).toMatchObject({context:'La foto muestra un producto central sobre fondo limpio.',recommendation:{label:'Presentar dos beneficios',reason:expect.stringContaining('producto')},allowOther:true});
    expect(question).not.toHaveProperty('selected');
    const [free]=parseUserQuestions({questions:[{id:'free',question:'¿Qué querés destacar?',recommendation:{label:'Un detalle del producto',reason:'Es el elemento más legible de la foto.'}}]});
    expect(free?.options).toEqual([]);
    for(const recommendation of [{label:'',reason:'Razón'},{label:'A',reason:''},{label:'A',reason:'x'.repeat(361)},{label:'A',reason:'Razón',autoSelect:true}])expect(()=>parseUserQuestions({questions:[{id:'bad',question:'Pregunta',recommendation}]})).toThrow();
    expect(()=>parseUserQuestions({questions:[{id:'bad',question:'Pregunta',context:'x'.repeat(341)}]})).toThrow();
  });
  it('accepts free-text decisions unrelated to motion and preserves model wording',()=>{
    const questions=parseUserQuestions({questions:[{id:'voice',question:'¿Qué querés conservar de la voz original?'},{id:'format',header:'Formato',question:'¿Dónde lo vas a publicar?',options:[{label:'YouTube horizontal'},{label:'Reel vertical',description:'Para Instagram'}]}]});
    expect(questions[0]).toMatchObject({id:'voice',question:'¿Qué querés conservar de la voz original?',options:[],allowOther:true,secret:false});
    expect(questions[1].options).toHaveLength(2);
  });
  it('rejects duplicate identities instead of overwriting one answer',()=>{
    expect(()=>parseUserQuestions({questions:[{id:'one',question:'Primera'},{id:'one',question:'Segunda'}]})).toThrow(/unique/);
    expect(()=>parseUserQuestions({questions:[{id:'one',question:'Pregunta',options:[{label:'A'},{label:'A'}]}]})).toThrow(/unique/);
  });
  it('does not turn a skipped question into an approved preference',()=>{
    expect(userQuestionResult('skip')).toEqual({status:'skipped',answers:{}});
    expect(userQuestionResult('cancel')).toEqual({status:'cancelled',answers:{}});
    expect(userQuestionResult({answers:{voice:['Conservarla']}})).toEqual({status:'answered',answers:{voice:['Conservarla']}});
  });
});
