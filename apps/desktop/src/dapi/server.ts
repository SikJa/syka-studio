/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_HOST, MCP_PATH, MCP_PORT, tools } from "@diffusionstudio/dapi";
import { mainHandlers } from "./handlers";
import { DapiHttpServer } from "./http";
import { instructions } from "./docs";
import { RendererCalls } from "./renderer-calls";
import { serveCatalog } from "./tools-session";
import { projectTarget, canonicalPreviewJob } from './project-target';
import { ProjectPreviewQueue } from './preview-queue';
import { InternalPreviewWorker } from './preview-worker';
import { availableParallelism, totalmem } from 'node:os';
import { previewCapacity } from './preview-capacity';
import { planLines, planStillMax, writeGateReceipt } from '@diffusionstudio/agent-chat/host/gate-receipt';
import type { PreviewWorkerOptions } from './preview-worker';
import type { BrowserWindow } from 'electron';

import type { LogEntry } from "@diffusionstudio/dapi";
import type { MainContext, MainToolName } from "./handler";

/**
 * The name the server introduces itself with, and so the namespace an agent
 * shows the tools under: `mcp__diffusion__<tool>`. The same word as our URL
 * scheme and the CLI's primary name (`dapi` still works there too, as an
 * alias).
 */
const SERVER_NAME = "syka";

/** Opt-in isolation for a second worktree; the normal endpoint stays stable. */
function isolatedMcpPort(): number {
  const raw = process.env.SYKA_MCP_PORT;
  if (!raw) return MCP_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('SYKA_MCP_PORT inválido.');
  return port;
}

export type DapiServerDeps = {
  version: string;
  /** The app's console buffer, for `logs` and `report`. */
  logs(): LogEntry[];
  /** Called once, on the first connection: an agent is driving, so the UI may step back. */
  onFirstConnection(): void;
  /** The staged docs: INSTRUCTIONS.md, their path, and the skill headers, all for every session. Null when not staged. */
  docsDir: string | null;
  editorWindow?(): BrowserWindow | null;
  preview?: PreviewWorkerOptions;
};

/**
 * The app's MCP server: Streamable HTTP on a fixed loopback port, the URL
 * agents register and the `diffusion` CLI calls. Each client gets its own MCP
 * session over one catalog. Main-process tools run here; renderer tools are
 * forwarded over IPC and their results presented (files written, small
 * images inlined) before they go back out.
 */
export class DapiServer {
  private readonly deps: DapiServerDeps;
  private readonly renderer: RendererCalls;
  private readonly previewWorkers: InternalPreviewWorker[];
  private readonly previewQueue: ProjectPreviewQueue | null;
  private readonly http: DapiHttpServer;
  private instructionsText: string | null = null;
  private httpReady: Promise<boolean> = Promise.resolve(false);
  private connectionError: string | null = null;

  constructor(deps: DapiServerDeps) {
    this.deps = deps;
    this.renderer = new RendererCalls(deps.editorWindow);
    const capacity = deps.preview ? previewCapacity(totalmem(), availableParallelism(), process.env.SYKA_PREVIEW_CONCURRENCY) : 0;
    this.previewWorkers = Array.from({ length: capacity }, () => new InternalPreviewWorker(this.renderer, deps.preview!));
    this.previewQueue = capacity ? new ProjectPreviewQueue(
      (job, signal, slot) => this.previewWorkers[slot]!.run(job, signal),
      slot => this.previewWorkers[slot]!.reset(), { concurrency: capacity }) : null;
    for (const tool of tools) {
      if (tool.environment === "main" && !(tool.name in mainHandlers)) {
        throw new Error(`Main-process tool "${tool.name}" has no handler`);
      }
    }
    this.http = new DapiHttpServer({
      host: MCP_HOST,
      port: isolatedMcpPort(),
      path: MCP_PATH,
      createSession: url => this.createSession(url),
      onFirstConnection: () => deps.onFirstConnection(),
    });
  }

  /** The URL agents register. */
  get url(): string {
    return this.http.url;
  }

  start(): void {
    this.renderer.start();
    this.connectionError = null;
    // A taken port is the one way this fails. The app is still usable
    // without agents, so it is logged, not fatal; `mcpUrl()` says so.
    this.httpReady = this.http.start().then(
      () => true,
      (error: Error) => {
        this.connectionError = (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
          ? `El puerto ${new URL(this.url).port} ya está ocupado. Las herramientas de esta ventana no se conectaron. Cerrá la instancia duplicada o asignale otro puerto a la prueba y reiniciala; no se usará otra ventana automáticamente.`
          : `No se pudieron iniciar las herramientas de esta ventana en ${this.url}: ${error.message}`;
        console.error(`[dapi] cannot serve MCP at ${this.url}: ${error.message}`);
        return false;
      },
    );
  }

  /** The HTTP URL once it is being served; null when the port could not be bound. */
  async mcpUrl(): Promise<string | null> {
    return (await this.httpReady) ? this.url : null;
  }

  /** This instance's endpoint, never the endpoint of a process that owns its port. */
  async status(): Promise<{ url: string; available: boolean; error: string | null }> {
    return { url: this.url, available: await this.httpReady, error: this.connectionError };
  }

  stop(): void {
    this.previewQueue?.stop();
    for (const worker of this.previewWorkers) worker.reset();
    this.renderer.stop?.();
    this.http.stop();
    this.httpReady = Promise.resolve(false);
  }

  /** One MCP server over the whole catalog. The docs and skills are plain files; the instructions say where. */
  previewStatus() {
    const workers = this.previewWorkers.map((worker, slot) => ({ slot, ...worker.status() }));
    return { queue: this.previewQueue?.status() ?? null, worker: workers[0] ?? null, workers };
  }
  isBusy(): boolean {
    const queue = this.previewQueue?.status();
    return this.renderer.isBusy() || !!queue?.active || !!queue?.waiting;
  }

  private createSession(url: URL): McpServer {
    const project = projectTarget(url);
    this.instructionsText ??= instructions(this.deps.docsDir);
    const progressive = url.searchParams.get('sykaContext') === 'progressive-v1';
    const sessionInstructions = progressive
      ? instructions(this.deps.docsDir, 'progressive') : this.instructionsText;
    // `name` is the machine identity, and matches the key we write into agent
    // configs; `title` is what a client shows a person.
    const session = new McpServer({ name: SERVER_NAME, title: "Syka Studio", version: this.deps.version }, { instructions: sessionInstructions });
    serveCatalog(session, async (tool, args, signal) => {
      if (tool.environment === "main") return this.runInMain(tool.name as MainToolName, args, signal);
      if (!project) return this.renderer.call(tool.name, args, signal);
      // The gate checks the video plan's lines too; the agent never has to pass them.
      if (tool.name === "gate") {
        const given = args as { lines?: unknown; stillMax?: unknown };
        const lines = given.lines ? undefined : await planLines(project.dir);
        const stillMax = given.stillMax === undefined ? await planStillMax(project.dir) : undefined;
        if (lines?.length || stillMax !== undefined) args = { ...(args as object), ...(lines?.length ? { lines } : {}), ...(stillMax !== undefined ? { stillMax } : {}) };
      }
      const result = await this.runInPreview({ project, tool: tool.name, args }, signal);
      // The receipt is what lets a delivery be called ready: it names the exact source the gate judged.
      if (tool.name === "gate") await writeGateReceipt(project.dir, String((args as { id?: unknown }).id ?? ""), result)
        .catch(error => console.warn(`[syka] gate receipt not written: ${(error as Error).message}`));
      return result;
    },
      // Code-mode text(JSON.stringify(result)) must never ingest PNG base64.
      // Every presented image already has an actual local file receipt.
      { inlineImages: !progressive },
    );
    return session;
  }

  private async runInPreview(job: import('./preview-queue').PreviewJob, signal: AbortSignal): Promise<unknown> {
    if (!this.previewQueue) return Promise.reject(new Error('Esta instancia no tiene preview interna; no se usará el proyecto visible como reemplazo.'));
    return this.previewQueue.call(await canonicalPreviewJob(job), signal);
  }

  private runInMain(name: MainToolName, args: unknown, signal: AbortSignal): Promise<unknown> {
    const ctx: MainContext = { signal, logs: this.deps.logs, version: this.deps.version };
    // Each handler takes its own parsed args; the map's union type cannot
    // express that pairing, so the call site widens.
    return (mainHandlers[name] as (args: unknown, ctx: MainContext) => Promise<unknown>)(args, ctx);
  }
}
