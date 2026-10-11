import { isPackagedBuild } from './app-mode';
import { app } from 'electron';
import { join } from 'node:path';
import { resourceLibrary } from '../../../packages/agent-chat/src/host/resource-library';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
export function registerSykaResources(bridge: typeof mainBridge) {
  const logos = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','logos') : join(app.getAppPath(),'..','..','docs','resources','logos');
  const sounds = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','sounds') : join(app.getAppPath(),'..','..','docs','resources','sounds');
  const motions = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','motions') : join(app.getAppPath(),'..','..','docs','resources','motions');
  bridge.handle(MAIN_CHANNELS.SYKA_RESOURCES, req => resourceLibrary(join(process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), 'resource-libraries.json'), req, logos, sounds, motions));
}
