/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Wire-level channels — the only raw ipcRenderer/ipcMain channels in play for
// the main↔renderer request/event protocol. Everything else multiplexes
// through these via an envelope carrying the logical MAIN_CHANNELS name and
// (for requests) a UUID for correlation.
//
// Tool calls from the MCP server use their own wire (DAPI_WIRE in
// @diffusionstudio/dapi), in the other direction: main asks, the renderer answers.
import type { LogEntry, ScreenshotResult } from "@diffusionstudio/dapi";
import type { SourceEdit, WriteResult } from "./edit-types";
import type { AgentId } from "./mcp-config";

export const MAIN_WIRE = {
  REQUEST: "main:request",
  RESPONSE: "main:response",
  EVENT: "main:event",
} as const;

export type MainWireChannel = (typeof MAIN_WIRE)[keyof typeof MAIN_WIRE];

// Logical channels. Two categories:
//   • Renderer→Main requests (request + response)
//   • Main→Renderer events   (push, no response)
// Tool calls are not here: they arrive from main over DAPI_WIRE and are
// answered by the renderer's handlers (apps/web/src/dapi).
export const MAIN_CHANNELS = {
  SYKA_UPDATES: 'syka:updates',
  SYKA_UPDATES_CHANGED: 'syka:updates-changed',
  SYKA_NOTIFICATIONS: 'syka:notifications',
  SYKA_NOTICES_CHANGED: 'syka:notices-changed',
  SYKA_NOTICE_NAVIGATE: 'syka:notice-navigate',
  SYKA_PERMISSIONS: 'syka:permissions',
  SYKA_PUBLICATION: "syka:publication",
  SYKA_STUDIO_SETTINGS: "syka:studio-settings",
  SYKA_STORAGE: 'syka:storage',
  SYKA_ONBOARDING: 'syka:onboarding',
  SYKA_RESOURCES: 'syka:resources',
  SYKA_FONTS: 'syka:fonts',
  SYKA_DEPENDENCIES: 'syka:dependencies',
  SYKA_DEPENDENCIES_CHANGED: 'syka:dependencies-changed',
  SYKA_ACTIVITY: 'syka:activity',
  SYKA_SCREEN_CAPTURE: 'syka:screen-capture',
  SYKA_VIDEO_IMPORT: 'syka:video-import',
  SYKA_BACKGROUND_REMOVAL: 'syka:background-removal',
  SYKA_POST_EXPORT_INSPECT: 'syka:post-export-inspect',
  // Renderer→Main requests
  APP_OPEN_EXTERNAL: "app:open-external",
  APP_OPEN_CHAT_WINDOW: "app:open-chat-window",
  APP_SHOW_IN_FOLDER: "app:show-in-folder",
  ANALYTICS_TRACK: "analytics:track",
  AUTH_GET_PENDING_CALLBACK: "auth:get-pending-callback",
  CHECKOUT_GET_PENDING_CALLBACK: "checkout:get-pending-callback",
  WINDOW_IS_FULLSCREEN: "window:is-fullscreen",
  WINDOW_SET_COLOR_MODE: "window:set-color-mode",
  WINDOW_CAPTURE: "window:capture",
  FILE_TRANSFER: "file:transfer",
  FILE_PICK_EXPORT: "file:pick-export",
  FILE_WRITE_OPEN: "file:write-open",
  FILE_WRITE_CHUNK: "file:write-chunk",
  FILE_WRITE_CLOSE: "file:write-close",
  FILE_WRITE_ABORT: "file:write-abort",
  LOGS_GET: "logs:get",
  PROJECTS_PICK_ROOT: "projects:pick-root",
  PROJECTS_PICK_FOLDER: "projects:pick-folder",
  PROJECTS_DEFAULT_ROOT: "projects:default-root",
  PROJECTS_SCAN: "projects:scan",
  PROJECTS_GET: "projects:get",
  PROJECTS_INIT: "projects:init",
  PROJECTS_RESOLVE: "projects:resolve",
  PROJECTS_CREATE: "projects:create",
  PROJECTS_RENAME: "projects:rename",
  PROJECTS_DUPLICATE: "projects:duplicate",
  PROJECTS_DELETE: "projects:delete",
  PROJECTS_COMPILE: "projects:compile",
  PROJECTS_SOURCE_REVISION: "projects:source-revision",
  PROJECTS_WRITE: "projects:write",
  PROJECTS_WATCH: "projects:watch",
  PROJECTS_UNWATCH: "projects:unwatch",
  PROJECTS_MANIFEST_READ: "projects:manifest-read",
  PROJECTS_MANIFEST_WRITE: "projects:manifest-write",
  PROJECTS_CONFIG_READ: "projects:config-read",
  PROJECTS_CONFIG_WRITE: "projects:config-write",
  PROJECTS_FS_LIST: "projects:fs-list",
  PROJECTS_FS_STAT: "projects:fs-stat",
  PROJECTS_FS_REMOVE: "projects:fs-remove",
  PROJECTS_FS_REAL_PATH: "projects:fs-real-path",
  AGENT_CHAT_ENDPOINT: "agent-chat:endpoint",
  MCP_STATUS: "mcp:status",
  MCP_APPLY: "mcp:apply",
  CLI_STATUS: "cli:status",
  CLI_INSTALL: "cli:install",
  CLI_UNINSTALL: "cli:uninstall",
  SYKA_AGENT_SETTINGS: "syka-agent:settings",
  SYKA_GROQ_STATUS: "syka-groq:status",
  SYKA_GROQ_SET_KEY: "syka-groq:set-key",
  SYKA_GROQ_TRANSCRIBE: "syka-groq:transcribe",
  SYKA_GLOSSARY_GET: "syka-glossary:get",
  SYKA_GLOSSARY_SAVE: "syka-glossary:save",
  SYKA_GLOSSARY_APPLY_TRANSCRIPT: "syka-glossary:apply-transcript",
  SYKA_EDIT_HISTORY_STATUS: "syka-edit-history:status",
  SYKA_EDIT_HISTORY_UNDO: "syka-edit-history:undo",
  SYKA_EDIT_HISTORY_REDO: "syka-edit-history:redo",

  // Main→Renderer events
  AUTH_CALLBACK: "auth:callback",
  CHECKOUT_CALLBACK: "checkout:callback",
  WINDOW_FULLSCREEN_CHANGE: "window:fullscreen-change",
  PROJECTS_CHANGED: "projects:changed",
} as const;

/**
 * A project folder, wherever it lives: a real npm package with a JSX entry.
 * Its package.json is the project record: `projectId` is what the project
 * is, `displayName` the human name, `main` the entry file.
 */
export type ProjectInfo = {
  /**
   * package.json `projectId`: the project's identity, and the segment its URL
   * carries. Empty for a folder that predates ids and has not been opened
   * since — `PROJECTS_RESOLVE` is what gives one out.
   */
  id: string;
  /** Folder name. Renaming the project moves it, so it is not the identity. */
  name: string;
  /** Human name from package.json `displayName` (falls back to the folder name). */
  displayName: string;
  /** Absolute path of the project folder. */
  dir: string;
  /** Entry file relative to `dir`: package.json `main`, else index.tsx/ts/jsx/js. */
  entry: string;
  /** mtime of the entry file, ISO string. */
  modifiedAt: string;
  /** birthtime of the folder, ISO string. */
  createdAt: string;
};

export type CompileResult =
  { ok: true; code: string; warning?: string } | { ok: false; error: string };

export type { SourceEdit, WriteResult };
export type { AgentId };

// One agent the settings page lists: whether it is set up on this machine,
// whether its config already carries the app's MCP entry, and — for the
// agents that need the bundled `dapi` binary — why this build cannot
// connect it (null when it can).
export type McpAgentStatus = {
  id: AgentId;
  label: string;
  detected: boolean;
  connected: boolean;
  /** Absolute path of the config file the entry goes into. */
  config: string;
  unavailable: string | null;
};

/** `url` is the HTTP endpoint any other agent can be pointed at by hand. */
export type McpStatus = { url: string; available: boolean; error: string | null; agents: McpAgentStatus[] };

export type McpApplyRequest = { add: AgentId[]; remove: AgentId[] };

// Per agent: written, taken out, or left as it was with the reason.
export type McpApplyResult = {
  added: AgentId[];
  removed: AgentId[];
  failures: { id: AgentId; error: string }[];
};

// Where the `diffusion` command stands. `managed` means what is there is a
// symlink (the app's own, or the dev workflow's Homebrew link), which
// "Uninstall" can remove; `available` that this build can create the app's
// link (a dev build cannot: that is `npm run link` in apps/cli).
export type CliStatus = {
  installed: boolean;
  path: string | null;
  managed: boolean;
  available: boolean;
};

// Outcome of linking the bundled diffusion CLI into PATH. "cancelled" means the
// user dismissed the macOS admin prompt — not an error, not installed.
export type CliInstallResult =
  | { status: "installed" }
  | { status: "cancelled" }
  | { status: "error"; error: string };

// Outcome of taking the symlink back out. "absent" means there was none to
// remove; "cancelled" that the admin prompt was dismissed and it stays.
export type CliUninstallResult =
  | { status: "removed" }
  | { status: "absent" }
  | { status: "cancelled" }
  | { status: "error"; error: string };

export type MainChannel = (typeof MAIN_CHANNELS)[keyof typeof MAIN_CHANNELS];

// Events fed by a `diffusion://` deep link. Main routes each link to exactly
// one of these by its host, so auth and checkout never consume each other's.
export type DeepLinkChannel =
  typeof MAIN_CHANNELS.AUTH_CALLBACK | typeof MAIN_CHANNELS.CHECKOUT_CALLBACK;

export type MainRequestMap = {
  [MAIN_CHANNELS.SYKA_UPDATES]: { request: import('./update-types').UpdateRequest; response: import('./update-types').UpdateState };
  [MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE]: { request: void; response: import('../../../packages/agent-chat/src/notifications').NoticeNavigation | undefined };
  [MAIN_CHANNELS.SYKA_NOTIFICATIONS]: { request: import('../../../packages/agent-chat/src/notifications').NoticeCommand; response: import('../../../packages/agent-chat/src/notifications').NoticeSnapshot };
  [MAIN_CHANNELS.SYKA_SCREEN_CAPTURE]: { request: import('./screen-capture').ScreenCaptureRequest; response: import('./screen-capture').ScreenCaptureSources };
  [MAIN_CHANNELS.SYKA_PERMISSIONS]: { request: import('./syka-permission-types').PermissionRequest; response: import('./syka-permission-types').StudioPermissions };
  [MAIN_CHANNELS.SYKA_PUBLICATION]: { request: import("./publication/types").PublicationRequest; response: import("./publication/types").PublicationOverview };
  [MAIN_CHANNELS.SYKA_STUDIO_SETTINGS]: { request: import("./studio-settings").StudioSettingsRequest; response: import("./studio-settings").StudioSettingsResult };
  [MAIN_CHANNELS.SYKA_STORAGE]: { request: import('./storage/types').StorageRequest; response: import('./storage/types').StorageResponse };
  [MAIN_CHANNELS.SYKA_ONBOARDING]: { request: import('./syka-onboarding-contract').BrandRequest; response: import('./syka-onboarding-contract').BrandResponse };
  [MAIN_CHANNELS.APP_OPEN_CHAT_WINDOW]: { request: { url: string }; response: void };
  [MAIN_CHANNELS.APP_OPEN_EXTERNAL]: {
    request: { url: string };
    response: void;
  };
  // A product event, posted to Umami by main (the renderer's script is inert
  // in Electron).
  [MAIN_CHANNELS.ANALYTICS_TRACK]: {
    request: { event: string; data?: Record<string, string | number | boolean> };
    response: void;
  };
  [MAIN_CHANNELS.AUTH_GET_PENDING_CALLBACK]: {
    request: void;
    response: string | null;
  };
  [MAIN_CHANNELS.CHECKOUT_GET_PENDING_CALLBACK]: {
    request: void;
    response: string | null;
  };
  [MAIN_CHANNELS.WINDOW_IS_FULLSCREEN]: { request: void; response: boolean };
  [MAIN_CHANNELS.WINDOW_SET_COLOR_MODE]: { request: { mode: "light" | "dark" }; response: void };
  [MAIN_CHANNELS.WINDOW_CAPTURE]: { request: void; response: ScreenshotResult };
  [MAIN_CHANNELS.FILE_TRANSFER]: {
    request: { selector: string; absolutePath: string };
    response: void;
  };
  [MAIN_CHANNELS.FILE_PICK_EXPORT]: {
    request: { dir: string; name: string; extension: string };
    response: { path: string | null };
  };
  [MAIN_CHANNELS.FILE_WRITE_OPEN]: {
    request: { path: string; exclusive?: boolean };
    response: { id: string };
  };
  [MAIN_CHANNELS.FILE_WRITE_CHUNK]: {
    request: { id: string; data: Uint8Array; position: number };
    response: void;
  };
  [MAIN_CHANNELS.FILE_WRITE_CLOSE]: {
    request: { id: string };
    response: void;
  };
  [MAIN_CHANNELS.FILE_WRITE_ABORT]: {
    request: { id: string };
    response: void;
  };
  // Reveals a file or folder in the OS file manager (Finder on macOS).
  [MAIN_CHANNELS.APP_SHOW_IN_FOLDER]: {
    request: { path: string };
    response: void;
  };
  [MAIN_CHANNELS.LOGS_GET]: { request: void; response: LogEntry[] };
  [MAIN_CHANNELS.PROJECTS_PICK_ROOT]: {
    request: void;
    response: string | null;
  };
  [MAIN_CHANNELS.PROJECTS_PICK_FOLDER]: {
    request: void;
    response: string | null;
  };
  [MAIN_CHANNELS.PROJECTS_DEFAULT_ROOT]: {
    request: void;
    response: string | null;
  };
  // Every project folder directly under `root`: what the app puts on its
  // list when `root` is chosen as the projects root.
  [MAIN_CHANNELS.PROJECTS_SCAN]: {
    request: { root: string };
    response: ProjectInfo[];
  };
  [MAIN_CHANNELS.PROJECTS_GET]: {
    request: { dir: string };
    response: ProjectInfo | null;
  };
  [MAIN_CHANNELS.PROJECTS_INIT]: {
    request: { dir: string };
    response: ProjectInfo;
  };
  [MAIN_CHANNELS.PROJECTS_RESOLVE]: {
    request: { dir: string };
    response: ProjectInfo | null;
  };
  [MAIN_CHANNELS.PROJECTS_CREATE]: {
    request: { root: string; displayName: string };
    response: ProjectInfo;
  };
  // Renames the project: `displayName` in the record, and the folder with it.
  [MAIN_CHANNELS.PROJECTS_RENAME]: {
    request: { dir: string; displayName: string };
    response: ProjectInfo;
  };
  [MAIN_CHANNELS.PROJECTS_DUPLICATE]: {
    request: { dir: string };
    response: ProjectInfo;
  };
  [MAIN_CHANNELS.PROJECTS_DELETE]: { request: { dir: string }; response: void };
  [MAIN_CHANNELS.PROJECTS_COMPILE]: {
    request: { dir: string };
    response: CompileResult;
  };
  [MAIN_CHANNELS.PROJECTS_SOURCE_REVISION]: { request: { dir: string }; response: { revision: string } };
  [MAIN_CHANNELS.PROJECTS_WRITE]: {
    request: { dir: string; edits: SourceEdit[]; historyGroup?: string };
    response: WriteResult;
  };
  [MAIN_CHANNELS.PROJECTS_WATCH]: { request: { dir: string }; response: void };
  [MAIN_CHANNELS.PROJECTS_UNWATCH]: {
    request: { dir: string };
    response: void;
  };
  // The asset manifest (`assets.yml`) as plain data; null when there is none.
  [MAIN_CHANNELS.PROJECTS_MANIFEST_READ]: {
    request: { dir: string };
    response: unknown;
  };
  [MAIN_CHANNELS.PROJECTS_MANIFEST_WRITE]: {
    request: { dir: string; manifest: unknown };
    response: void;
  };
  // The project's config: the `diffusion` field of its package.json, as
  // parsed (null when absent). The renderer owns its shape; see
  // `engine/project-config` in the web app.
  [MAIN_CHANNELS.PROJECTS_CONFIG_READ]: {
    request: { dir: string };
    response: unknown;
  };
  [MAIN_CHANNELS.PROJECTS_CONFIG_WRITE]: {
    request: { dir: string; config: unknown };
    response: void;
  };
  // Project file system, for the asset library. `source` is project-relative
  // or absolute; `path` is always project-relative. Writes stream through the
  // FILE_WRITE_* channels (which create parent directories).
  [MAIN_CHANNELS.PROJECTS_FS_LIST]: {
    request: { dir: string; source: string };
    response: FsEntry[];
  };
  [MAIN_CHANNELS.PROJECTS_FS_STAT]: {
    request: { dir: string; source: string };
    response: FsStat | null;
  };
  [MAIN_CHANNELS.PROJECTS_FS_REMOVE]: {
    request: { dir: string; path: string };
    response: void;
  };
  [MAIN_CHANNELS.PROJECTS_FS_REAL_PATH]: {
    request: { dir: string; source: string };
    response: string | null;
  };
  // Where the agent chat host listens (`ws://127.0.0.1:PORT/?token=…`); null
  // while it is starting or restarting. The only desktop IPC the chat uses.
  [MAIN_CHANNELS.AGENT_CHAT_ENDPOINT]: {
    request: void;
    response: { url: string } | null;
  };
  // The app's MCP server in the agents' configs (see mcp-install.ts), and
  // the `diffusion` command on PATH (see cli-install.ts). The install/uninstall
  // calls put the macOS admin prompt on screen.
  [MAIN_CHANNELS.MCP_STATUS]: { request: void; response: McpStatus };
  [MAIN_CHANNELS.MCP_APPLY]: { request: McpApplyRequest; response: McpApplyResult };
  [MAIN_CHANNELS.CLI_STATUS]: { request: void; response: CliStatus };
  [MAIN_CHANNELS.CLI_INSTALL]: { request: void; response: CliInstallResult };
  [MAIN_CHANNELS.CLI_UNINSTALL]: { request: void; response: CliUninstallResult };
  [MAIN_CHANNELS.SYKA_AGENT_SETTINGS]: {request:{action:'get'|'save-mcp'|'create-skill'|'import-skill'|'read-skill'|'save-skill';servers?:import('../../../packages/agent-chat/src/host/agent-config').AgentServer[];name?:string;source?:string;content?:string;revision?:string};response:{servers:import('../../../packages/agent-chat/src/host/agent-config').AgentServer[];skills:{name:string;path:string;description:string;bundled?:boolean;format?:'general'|'reels'|'youtube'}[];skillsRoot:string;ffmpegPath:string;content?:string;revision?:string}};
  [MAIN_CHANNELS.SYKA_RESOURCES]: { request: import('../../../packages/agent-chat/src/host/resource-library').ResourceRequest; response: import('../../../packages/agent-chat/src/host/resource-library').ResourceResult };
  [MAIN_CHANNELS.SYKA_FONTS]: { request: import('./font-import').FontRequest; response: import('./font-import').FontCatalog };
  [MAIN_CHANNELS.SYKA_DEPENDENCIES]: { request: { action: 'status' | 'install' } | void; response: import('./dependency-types').DependencyStatus };
  [MAIN_CHANNELS.SYKA_ACTIVITY]: { request: { exporting: boolean }; response: void };
  [MAIN_CHANNELS.SYKA_VIDEO_IMPORT]: { request: import('./video-import/types').VideoImportRequest; response: import('./video-import/types').VideoImportJob };
  [MAIN_CHANNELS.SYKA_BACKGROUND_REMOVAL]: { request: import('../../../packages/agent-chat/src/host/background-removal').BackgroundRequest; response: import('../../../packages/agent-chat/src/host/background-removal').BackgroundJob };
  [MAIN_CHANNELS.SYKA_POST_EXPORT_INSPECT]: { request: { dir: string; path: string; expectedHash?: string }; response: import('./post-export').PostExportInspection };
  [MAIN_CHANNELS.SYKA_GROQ_STATUS]: { request: void; response: SykaGroqStatus };
  [MAIN_CHANNELS.SYKA_EDIT_HISTORY_STATUS]: { request: { dir: string }; response: SykaEditHistoryResult };
  [MAIN_CHANNELS.SYKA_EDIT_HISTORY_UNDO]: { request: { dir: string }; response: SykaEditHistoryResult };
  [MAIN_CHANNELS.SYKA_EDIT_HISTORY_REDO]: { request: { dir: string }; response: SykaEditHistoryResult };
  [MAIN_CHANNELS.SYKA_GROQ_SET_KEY]: { request: { key: string }; response: SykaGroqStatus };
  [MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE]: {
    request: { audio: Uint8Array; duration: number; applyGlossary?: boolean };
    response: SykaTranscriptSegment[];
  };
  [MAIN_CHANNELS.SYKA_GLOSSARY_GET]: { request: void; response: SykaGlossary };
  [MAIN_CHANNELS.SYKA_GLOSSARY_SAVE]: { request: { expectedRevision: string; entries: SykaGlossaryEntry[] }; response: SykaGlossary };
  [MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT]: { request: { segments: SykaTranscriptSegment[] }; response: SykaTranscriptSegment[] };
};

export type SykaGlossaryEntry = { id: string; term: string; variants: string[]; enabled: boolean };
export type SykaGlossary = { version: 1; revision: string; entries: SykaGlossaryEntry[] };

export type SykaGroqStatus = {
  configured: boolean;
  secureStorage: boolean;
  model: "whisper-large-v3-turbo";
};
export type SykaEditHistoryResult =
  | { ok: true; canUndo: boolean; canRedo: boolean; revision: string; changed?: boolean; undoLabel?: string; redoLabel?: string }
  | { ok: false; error: string };
export type SykaTranscriptSegment = {
  text: string;
  words: Array<{ text: string; start: number; end: number }>;
};

export type FsEntry = {
  name: string;
  kind: "file" | "directory";
  size: number;
  mtime: number;
  /** Set when the entry is a symlink; `kind` is what it points at. */
  link?: boolean;
};
export type FsStat = { size: number; mtime: number };
export type MainRequestChannel = keyof MainRequestMap;

export type MainEventMap = {
  [MAIN_CHANNELS.SYKA_DEPENDENCIES_CHANGED]: import('./dependency-types').DependencyProgress;
  [MAIN_CHANNELS.SYKA_UPDATES_CHANGED]: import('./update-types').UpdateState;
  [MAIN_CHANNELS.SYKA_NOTICES_CHANGED]: import('../../../packages/agent-chat/src/notifications').NoticeSnapshot;
  [MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE]: import('../../../packages/agent-chat/src/notifications').NoticeNavigation;
  [MAIN_CHANNELS.AUTH_CALLBACK]: { url: string };
  [MAIN_CHANNELS.CHECKOUT_CALLBACK]: { url: string };
  [MAIN_CHANNELS.WINDOW_FULLSCREEN_CHANGE]: { fullscreen: boolean };
  // A file inside a watched project folder changed (path relative to `dir`).
  [MAIN_CHANNELS.PROJECTS_CHANGED]: { dir: string; path: string };
};
export type MainEventChannel = keyof MainEventMap;

export type MainRequest = {
  id: string;
  channel: MainRequestChannel;
  data: unknown;
};

export type MainEvent = {
  channel: MainEventChannel;
  data: unknown;
};

export type MainReply =
  | { id: string; ok: true; data: unknown }
  | { id: string; ok: false; error: string };

export type { ResourceKind, ResourceEntry } from '../../../packages/agent-chat/src/host/resource-library';
