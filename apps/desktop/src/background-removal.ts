import { isPackagedBuild } from './app-mode';
import { app } from 'electron';
import { join, resolve } from 'node:path';
import { BackgroundRemovalService } from '../../../packages/agent-chat/src/host/background-removal';
import { MAIN_CHANNELS } from './main-channels';
import { getProject } from './projects';
import { agentToolEnvironment, localToolPath } from './syka-dependencies';
import type { mainBridge } from './main-manager';

export function backgroundEnvironment(): Record<string, string> {
  const root = isPackagedBuild() ? join(process.resourcesPath, 'runtime') : resolve(app.getAppPath(), '../..', '.runtime/background-removal');
  return { SYKA_BACKGROUND_MODULES: process.env.SYKA_BACKGROUND_MODULES || join(root, 'node_modules'), SYKA_BACKGROUND_RUNNER: process.env.SYKA_BACKGROUND_RUNNER || (isPackagedBuild() ? join(root, 'background-removal-runner.mjs') : resolve(app.getAppPath(), '../..', 'scripts/background-removal-runner.mjs')), SYKA_BACKGROUND_NODE: localToolPath('node') || process.execPath, SYKA_BACKGROUND_FFMPEG: localToolPath('ffmpeg') || 'ffmpeg', SYKA_BACKGROUND_FFPROBE: localToolPath('ffprobe') || 'ffprobe' };
}
export function registerBackgroundRemoval(bridge: typeof mainBridge) {
  const env = { ...agentToolEnvironment(), ...backgroundEnvironment() };
  const service = new BackgroundRemovalService({ node: env.SYKA_BACKGROUND_NODE, runner: env.SYKA_BACKGROUND_RUNNER, modules: env.SYKA_BACKGROUND_MODULES, env });
  app.once('before-quit', () => service.dispose());
  bridge.handle(MAIN_CHANNELS.SYKA_BACKGROUND_REMOVAL, async request => {
    if (!await getProject(request.projectDir)) throw Error('Abrí un proyecto antes de quitar el fondo.');
    return service.call(request);
  });
}
