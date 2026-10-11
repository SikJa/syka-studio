import type { VisualReviewItem } from './visual-review-model';

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('syka-visual-reviews', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('notes');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readVisualNotes(key: string): Promise<VisualReviewItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('notes').objectStore('notes').get(key);
    request.onsuccess = () => {
      const stored = request.result;
      resolve(stored?.version === 1 && Array.isArray(stored.notes) ? stored.notes.filter((note: VisualReviewItem) => note && typeof note === 'object' && typeof note.id === 'string' && typeof note.instruction === 'string' && typeof note.title === 'string' && note.context && Array.isArray(note.attachments)).slice(0,10) : []);
    };
    request.onerror = () => reject(request.error);
  });
}
export async function writeVisualNotes(key: string, notes: VisualReviewItem[]) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('notes','readwrite');
    const store = transaction.objectStore('notes');
    // Blob URLs belong to the current window. Captures already have durable
    // file paths and the annotated PNG is retained as a data URL.
    const durable = notes.map(note => ({...note, attachments:note.attachments.map(attachment => ({...attachment, previewUrl:attachment.previewUrl?.startsWith('blob:') ? note.preview : attachment.previewUrl}))}));
    if(durable.length)store.put({version:1,notes:durable},key);else store.delete(key);
    transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });
}
