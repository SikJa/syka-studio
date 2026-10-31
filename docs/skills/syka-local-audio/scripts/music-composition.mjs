/** Original musical planning, MIT. Distinct harmony, motifs and rhythmic arrangements. */
import { createHash } from 'node:crypto';

export const HARMONIES = [
  { id: 'major-sixths', root: 48, chords: [[0,4,7,9],[5,9,12,16],[2,5,9,12],[7,11,14,17]] },
  { id: 'dorian-open', root: 50, chords: [[0,3,7,10],[5,9,12,14],[0,3,7,9],[7,10,14,17]] },
  { id: 'lydian-air', root: 53, chords: [[0,4,7,11],[2,6,9,12],[7,11,14,18],[4,7,11,14]] },
  { id: 'minor-descent', root: 57, chords: [[0,3,7,10],[-2,2,5,9],[-4,0,3,7],[-5,-1,2,7]] },
  { id: 'quartal-space', root: 48, chords: [[0,5,10,14],[2,7,12,17],[5,10,15,19],[0,7,12,17]] },
  { id: 'bright-turn', root: 55, chords: [[0,4,7,11],[9,12,16,19],[2,5,9,12],[7,11,14,17]] },
  { id: 'nocturne', root: 50, chords: [[0,3,7,14],[-4,0,3,7],[5,8,12,15],[7,11,14,17]] },
  { id: 'gentle-fifths', root: 48, chords: [[0,7,14],[5,12,19],[9,16,23],[2,9,16]] },
  { id: 'suspended-steps', root: 53, chords: [[0,5,7,14],[2,7,9,16],[4,9,11,18],[7,12,14,21]] },
  { id: 'minor-colour', root: 55, chords: [[0,3,7,14],[8,12,15,19],[5,8,12,15],[10,14,17,21]] },
  { id: 'warm-cadence', root: 48, chords: [[2,5,9,12],[7,11,14,17],[0,4,7,11],[9,12,16,19]] },
  { id: 'pedal-light', root: 50, chords: [[0,7,12,16],[0,9,14,17],[0,5,12,16],[0,7,14,17]] },
];
export const MUSIC_STYLES = ['editorial','ambient','pulse','lofi','cinematic','bright'];
const profiles = {
  editorial: { rhythm: [0,3,4,7], bass: [0,2], drum: false, density: .62, voice: 'keys' },
  ambient: { rhythm: [0,5], bass: [0], drum: false, density: .32, voice: 'bell' },
  pulse: { rhythm: [0,1,3,4,5,6], bass: [0,1,2,3], drum: true, density: .85, voice: 'pluck' },
  lofi: { rhythm: [0,2,5,7], bass: [0,2.5], drum: true, density: .48, voice: 'keys' },
  cinematic: { rhythm: [0,3,6], bass: [0], drum: false, density: .55, voice: 'bell' },
  bright: { rhythm: [0,2,3,5,6], bass: [0,1.5,3], drum: true, density: .7, voice: 'pluck' },
};
export function composePlan({ style = 'editorial', seed = 7, harmony, avoidFamilies = [] } = {}) {
  if (!MUSIC_STYLES.includes(style) || !Number.isSafeInteger(seed)) throw Error('Invalid composition style or seed');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state / 4294967296; };
  for (let i=0;i<7;i++) random();
  const available = HARMONIES.filter(item => !avoidFamilies.includes('syka-harmony:' + item.id));
  const choices = available.length ? available : HARMONIES;
  const selected = harmony ? HARMONIES.find(item => item.id === harmony) : choices[Math.floor(random()*choices.length)];
  if (!selected) throw Error('Unknown harmony');
  const transpose = [0,2,-2,5,-5][Math.floor(random()*5)];
  const motif = Array.from({length:8}, (_,i) => i === 7 ? 0 : Math.floor(random()*4));
  const profile = profiles[style];
  const phraseBars = style === 'ambient' || style === 'cinematic' ? 2 : 1;
  const plan = { version: 2, style, harmony: selected.id, root: selected.root + transpose, chords: selected.chords, motif, rhythm: profile.rhythm, bass: profile.bass, drums: profile.drum, density: profile.density, voice: profile.voice, phraseBars, compositionFamily: 'syka-harmony:' + selected.id };
  return { ...plan, compositionId: 'syka-music:' + createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0,20) };
}
