/** Original Syka composition worker, MIT. Exits after writing portable audio. */
import { parentPort, workerData } from 'node:worker_threads';
import { synthMusic, saveAudio } from './audio-studio.mjs';
import { HARMONIES } from './music-composition.mjs';
try {
  if (HARMONIES.every(item=>workerData.avoidFamilies.includes('syka-harmony:'+item.id))) parentPort.postMessage({ state: 'needs_direction', reason: 'Las familias locales ya se usaron recientemente. Pedí otra fuente/proveedor o una elección explícita antes de repetir.' });
  else {
    const result = synthMusic(workerData.options);
    parentPort.postMessage({ state: 'created', ...await saveAudio(workerData.path, result, { stems: true }) });
  }
} catch (error) { parentPort.postMessage({ state: 'error', message: String(error?.message ?? error) }); }
finally { parentPort.close(); }
