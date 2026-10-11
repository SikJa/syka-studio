/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The host as a program. Two ways in:
//   • a terminal / sandbox: flags on the command line, the URL on stdout;
//   • an Electron utility process: the config arrives over `parentPort`
//     (never argv, which is visible to every process on the machine) and
//     the port goes back the same way.
// Either way SIGTERM, stdin EOF or a `stop` message shut it down cleanly.

import { createAgentHost } from "./host/index";

import type { AgentHostConfig, RunningAgentHost } from "./host/index";

type ParentPort = {
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
};

type StartMessage = { type: "start"; config: AgentHostConfig };
type StopMessage = { type: "stop" };
type DeleteProjectMessage = { type: "deleteProject"; projectId: string };
type AnswerMessage = { type: 'notification.answer'; id: string; chatId: string; requestId: string; answers: Record<string, string[]>; attachments?: string[] };
type ActivityMessage = { type: 'activity.status'; id: string };

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq > 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[arg.slice(2)] = next;
        i++;
      } else out[arg.slice(2)] = true;
    }
  }
  return out;
}

function str(value: string | true | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function main(): Promise<void> {
  const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;
  let running: RunningAgentHost | null = null;
  let stopping = false;

  const stop = async (code = 0): Promise<void> => {
    if (stopping) return;
    stopping = true;
    try {
      await running?.stop();
    } finally {
      process.exit(code);
    }
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());

  if (parentPort) {
    parentPort.on("message", ({ data }) => {
      const message = data as StartMessage | StopMessage | DeleteProjectMessage | AnswerMessage | ActivityMessage;
      if (message?.type === 'activity.status') parentPort.postMessage({ type: 'activity.status', id: message.id, busy: !running || running.isBusy() });
      if (message?.type === 'notification.answer') {
        const reply = (error?: string) => parentPort.postMessage({ type: 'notification.answered', id: message.id, error });
        if (!running) reply('El agente se está reiniciando. Probá de nuevo.');
        else void running.answer(message.chatId, message.requestId, { answers: message.answers, attachments: message.attachments }).then(() => reply(), error => reply((error as Error).message));
      }
      if (message?.type === "stop") void stop();
      if (message?.type === "deleteProject") running?.deleteChats(message.projectId);
      if (message?.type !== "start") return;
      createAgentHost({ ...message.config, onNotice: event => parentPort.postMessage({ type: 'notification.event', event }), log: (line) => console.error(`[agent-chat] ${line}`) })
        .then((host) => {
          running = host;
          parentPort.postMessage({ type: "listening", port: host.port, url: host.url });
        })
        .catch((error: Error) => {
          parentPort.postMessage({ type: "error", message: error.message });
          void stop(1);
        });
    });
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const token = str(args.token) ?? process.env.AGENT_CHAT_TOKEN;
  const dataDir = str(args["data-dir"]);
  if (!token || !dataDir) {
    console.error("usage: agent-host --token <token> --data-dir <dir> [--host 127.0.0.1] [--port 0] [--mcp-url <url>] [--origin <origin>...]");
    process.exit(2);
  }
  const mcpUrl = str(args["mcp-url"]);
  const origins = str(args.origin)?.split(",");
  running = await createAgentHost({
    host: str(args.host),
    port: args.port ? Number(args.port) : undefined,
    token,
    dataDir,
    mcp: mcpUrl ? { name: "syka", url: mcpUrl } : null,
    allowedOrigins: origins,
    instructions: str(args.instructions),
    codeGraphRoot: str(args['code-graph-root']),
    version: str(args.version) ?? "0.0.0",
  });
  console.log(running.url);
  process.stdin.on("end", () => void stop());
  process.stdin.on("close", () => void stop());
  process.stdin.resume();
}

void main();
