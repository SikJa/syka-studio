/** File naming fallback for connected sounds; catalog metadata takes priority. */
export const SOUND_CATEGORIES = [
  {id:'pop',title:'Pops'}, {id:'whoosh',title:'Whoosh'}, {id:'click',title:'Clics'},
  {id:'tap',title:'Toques'}, {id:'impact',title:'Impactos'}, {id:'riser',title:'Subidas'},
  {id:'downer',title:'Bajadas'}, {id:'chime',title:'Campanas'}, {id:'success',title:'Confirmación'},
  {id:'notification',title:'Notificaciones'}, {id:'shimmer',title:'Destellos'},
  {id:'error',title:'Errores'}, {id:'open-close',title:'Abrir y cerrar'},
  {id:'switch',title:'Interruptores'}, {id:'glitch',title:'Glitch'},
  {id:'texture',title:'Texturas'}, {id:'other',title:'Otros sonidos'},
] as const;
export type SoundFamily = typeof SOUND_CATEGORIES[number]['id'];
export function soundFamily(name:string):SoundFamily {
  const text=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rules:[SoundFamily,RegExp][]=[
    ['whoosh',/whoosh|woosh|swoosh|swipe|barrido/], ['pop',/pop|pluck|bong|drop|burbuja/],
    ['click',/click|clic|select|rollover|mouserelease/], ['tap',/tap|tick|toque/],
    ['impact',/impact|golpe/], ['riser',/riser|subida/], ['downer',/downer|bajada/],
    ['chime',/chime|glass|campana/], ['success',/success|confirmation|confirmacion/],
    ['notification',/notification|notificacion|question/], ['shimmer',/shimmer|destello|sparkle/],
    ['error',/error/], ['open-close',/open|close|back|maximize|minimize|abrir|cerrar/],
    ['switch',/switch|toggle|interruptor/], ['glitch',/glitch/], ['texture',/scratch|scroll|raspado/],
  ];
  return rules.find(([,pattern])=>pattern.test(text))?.[0]??'other';
}
