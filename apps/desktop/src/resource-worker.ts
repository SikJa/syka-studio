// Library listing, hashing and preview checks run here, off Electron's main
// thread: sorting thousands of entries or hashing new files must not delay
// window events and IPC. Same functions, same validation as before.
import { parentPort } from 'node:worker_threads';
import { resourceLibrary, resourcePreviewMedia } from '../../../packages/agent-chat/src/host/resource-library';

export type ResourceWorkerCall =
  | { id: number; method: 'library'; args: Parameters<typeof resourceLibrary> }
  | { id: number; method: 'previewMedia'; args: Parameters<typeof resourcePreviewMedia> };

parentPort?.on('message', async (call: ResourceWorkerCall) => {
  try {
    const result = call.method === 'library' ? await resourceLibrary(...call.args) : await resourcePreviewMedia(...call.args);
    parentPort!.postMessage({ id: call.id, result });
  } catch (error) {
    parentPort!.postMessage({ id: call.id, error: error instanceof Error ? error.message : String(error) });
  }
});
