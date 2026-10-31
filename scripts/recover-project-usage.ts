/* Passive native recovery for an explicit retained-project inventory. No harness is started. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ChatStore } from '../packages/agent-chat/src/host/store';
import { NativeUsageRecovery } from '../packages/agent-chat/src/host/native-usage';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw Error(`Required: ${name}`);
  return resolve(process.argv[index + 1]!);
}
const inventory = JSON.parse(await readFile(argument('--projects'), 'utf8')) as { id: string; displayName: string; dir: string }[];
const projects = [...new Map(inventory.map(p => [p.id, p])).values()];
const store = new ChatStore(argument('--data'));
const recovery = new NativeUsageRecovery(argument('--runtime'), store, message => console.error(message));
const ids = projects.map(p => p.id);
await recovery.recover(ids);
const first = await store.usage.list(ids);
await recovery.recover(ids);
const second = await store.usage.list(ids);
if (JSON.stringify(first) !== JSON.stringify(second)) throw Error('Reimport changed ledger');
const restarted = new ChatStore(argument('--data'));
await new NativeUsageRecovery(argument('--runtime'), restarted).recover(ids);
const third = await restarted.usage.list(ids);
if (JSON.stringify(second) !== JSON.stringify(third)) throw Error('Restart changed ledger');
await restarted.flush(); await store.flush();
const report = { recoveredAt: new Date().toISOString(), inventoryRecords: inventory.length, uniqueProjects: projects.length,
  reimportStable: true, restartStable: true,
  projects: third.map((usage, i) => ({ name: projects[i]!.displayName, dir: projects[i]!.dir, ...usage })),
};
const output = argument('--report');
await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
