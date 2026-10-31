import { app } from 'electron';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';

/** Live usage per Electron process, plus the data folder in use. No user content. */
export type AppDiagnostics = {
  version: string;
  runtimeRoot: string;
  uptimeSeconds: number;
  processes: { type: string; name?: string; cpuPercent: number; memoryMB: number }[];
};

export function registerDiagnostics(bridge: typeof mainBridge) {
  bridge.handle(MAIN_CHANNELS.SYKA_DIAGNOSTICS, async () => ({
    version: app.getVersion(),
    runtimeRoot: process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'),
    uptimeSeconds: Math.round(process.uptime()),
    // percentCPUUsage is measured since the previous getAppMetrics call, so the panel samples it twice.
    processes: app.getAppMetrics().map(metric => ({
      type: metric.type, ...(metric.name ? { name: metric.name } : metric.serviceName ? { name: metric.serviceName } : {}),
      cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
      memoryMB: Math.round(metric.memory.workingSetSize / 1024),
    })),
  }));
}
