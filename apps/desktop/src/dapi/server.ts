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
import { projectTarget } from './project-target';
import { ProjectPreviewQueue } from './preview-queue';
import { InternalPreviewWorker } from './preview-worker';
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
  private readonly previewWorker: InternalPreviewWorker | null;
  private readonly previewQueue: ProjectPreviewQueue | null;
  private readonly http: DapiHttpServer;
  private instructionsText: string | null = null;
  private httpReady: Promise<boolean> = Promise.resolve(false);
  private connectionError: string | null = null;

  constructor(deps: DapiServerDeps) {
    this.deps = deps;
    this.renderer = new RendererCalls(deps.editorWindow);
    this.previewWorker = deps.preview ? new InternalPreviewWorker(this.renderer, deps.preview) : null;
    this.previewQueue = this.previewWorker ? new ProjectPreviewQueue(
      (job, signal) => this.previewWorker!.run(job, signal), () => this.previewWorker!.reset()) : null;
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
    this.previewWorker?.reset();
    this.renderer.stop?.();
    this.http.stop();
    this.httpReady = Promise.resolve(false);
  }

  /** One MCP server over the whole catalog. The docs and skills are plain files; the instructions say where. */
  previewStatus() {
    return { queue: this.previewQueue?.status() ?? null, worker: this.previewWorker?.status() ?? null };
  }
  isBusy(): boolean {
    const queue = this.previewQueue?.status();
    return this.renderer.isBusy() || !!queue?.active || !!queue?.waiting;
  }

  private createSession(url: URL): McpServer {
    const project = projectTarget(url);
    this.instructionsText ??= instructions(this.deps.docsDir);
    // `name` is the machine identity, and matches the key we write into agent
    // configs; `title` is what a client shows a person.
    const session = new McpServer({ name: SERVER_NAME, title: "Syka Studio", version: this.deps.version }, { instructions: this.instructionsText });
    serveCatalog(session, (tool, args, signal) =>
      tool.environment === "main" ?
        this.runInMain(tool.name as MainToolName, args, signal)
        : project ? this.runInPreview({ project, tool: tool.name, args }, signal)
          : this.renderer.call(tool.name, args, signal),
    );
    return session;
  }

  private runInPreview(job: import('./preview-queue').PreviewJob, signal: AbortSignal): Promise<unknown> {
    if (!this.previewQueue) return Promise.reject(new Error('Esta instancia no tiene preview interna; no se usará el proyecto visible como reemplazo.'));
    return this.previewQueue.call(job, signal);
  }

  private runInMain(name: MainToolName, args: unknown, signal: AbortSignal): Promise<unknown> {
    const ctx: MainContext = { signal, logs: this.deps.logs, version: this.deps.version };
    // Each handler takes its own parsed args; the map's union type cannot
    // express that pairing, so the call site widens.
    return (mainHandlers[name] as (args: unknown, ctx: MainContext) => Promise<unknown>)(args, ctx);
  }
}
