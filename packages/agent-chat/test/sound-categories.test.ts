import {describe,it,expect} from 'vitest';
import {soundFamily} from '../src/host/sound-categories';
describe('connected sound categories',()=>{
  it.each([['Pop_02.wav','pop'],['soft_woosh.mp3','whoosh'],['swipe-1.wav','whoosh'],['mouseclick1.ogg','click'],['mouserelease1.ogg','click'],['toggle4.ogg','switch'],['maximize_001.ogg','open-close'],['confirmation_001.ogg','success'],['campana.wav','chime'],['raspado.wav','texture'],['Destello 3.wav','shimmer'],['desconocido.wav','other']])('classifies %s as %s',(name,family)=>expect(soundFamily(name)).toBe(family));
});
