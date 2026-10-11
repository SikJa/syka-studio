import { createStore } from 'solid-js/store';
import { appendVisualNote, type VisualReviewItem } from './visual-review-model';
import { readVisualNotes, writeVisualNotes } from './visual-review-storage';
import { toast } from 'somoto';

// Scoped like composer drafts: survives docking/fullscreen, never crosses chats.
const [reviews, setReviews] = createStore<Record<string, VisualReviewItem[]>>({});
const loads = new Map<string,Promise<void>>(), writes = new Map<string,Promise<void>>();
const failedLoads = new Set<string>();
const cleared = new Set<string>(), removed = new Map<string,Set<string>>();
let storageWarning = false;
function failure(){if(!storageWarning){storageWarning=true;toast.error('No se pudieron guardar las notas en este dispositivo. Conservá las capturas antes de cerrar.')}}
export function loadVisualNotes(chatKey: string): Promise<void> {
  let pending=loads.get(chatKey);
  if(!pending){
    pending=readVisualNotes(chatKey).then(saved=>{
      const current=reviews[chatKey]??[], ids=new Set(current.map(note=>note.id));
      if(!cleared.has(chatKey))setReviews(chatKey,[...saved.filter(note=>!ids.has(note.id)&&!removed.get(chatKey)?.has(note.id)),...current].slice(0,10));
    }).catch(()=>{failedLoads.add(chatKey);failure()});
    loads.set(chatKey,pending);
  }
  return pending;
}
export const visualNotes = (chatKey: string) => {void loadVisualNotes(chatKey);return reviews[chatKey] ?? []};
export function flushVisualNotes(chatKey:string):Promise<void>{
  const pending=(writes.get(chatKey)??Promise.resolve()).then(()=>loadVisualNotes(chatKey)).then(()=>{if(!failedLoads.has(chatKey))return writeVisualNotes(chatKey,JSON.parse(JSON.stringify(reviews[chatKey]??[])))}).catch(failure);
  writes.set(chatKey,pending);return pending;
}
export function addVisualNote(chatKey: string, item: VisualReviewItem) {
  setReviews(chatKey, appendVisualNote(visualNotes(chatKey), item));
  return flushVisualNotes(chatKey);
}
export function editVisualNote(chatKey: string, id: string, instruction: string) {
  setReviews(chatKey, visualNotes(chatKey).map(item => item.id === id ? { ...item, instruction } : item));
  void flushVisualNotes(chatKey);
}
export function removeVisualNote(chatKey: string, id: string) {
  setReviews(chatKey, visualNotes(chatKey).filter(item => item.id !== id));
  const ids=removed.get(chatKey)??new Set<string>();ids.add(id);removed.set(chatKey,ids);
  void flushVisualNotes(chatKey);
}
export function clearVisualNotes(chatKey: string) { cleared.add(chatKey);setReviews(chatKey, []);void flushVisualNotes(chatKey); }
