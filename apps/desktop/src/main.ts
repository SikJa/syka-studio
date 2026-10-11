/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { isPackagedBuild } from './app-mode';
import { loadNativeWindowStyle } from './native-window-style';
import { app, BrowserWindow, dialog, nativeImage, session, shell } from "electron";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { pathToFileURL } from 'node:url';
import { tempPathFor, replaceFileAtomic } from "./atomic";
import { DapiServer } from "./dapi/server";
import { projectSourceRevision } from './dapi/source-revision';
import { agentChatEndpoint, deleteProjectChats, startAgentChat, stopAgentChat, isAgentChatBusy } from "./agent-chat";
import { agentNotice, allowedNoticeCommand, isNoticeWindow, registerNotifications, stopNotifications, trustedNoticeUrl } from './notifications';
import { cliStatus, installCli, uninstallCli } from "./cli-install";
import { applyMcp, mcpStatus } from "./mcp-install";
import { enableHeadless } from "./headless";
import { trackEvent } from "./analytics";
import { setupAppMenu } from "./menu";
import { handleSquirrelEvent } from "./squirrel";
import { mainBridge } from "./main-manager";
import { MAIN_CHANNELS } from "./main-channels";
import { registerSykaAgentSettings } from "./syka-agent-settings";
import { registerSykaDependencies, ensurePackagedTools, dependenciesBusy } from "./syka-dependencies";
import { runtimeDirectory } from "./runtime-paths";
import { registerSykaResources } from "./syka-resources";
import { registerSykaFonts } from "./syka-fonts";
import { isGroqTranscribing, registerSykaGroq } from "./syka-groq";
import { hasActiveScreenCaptures, registerScreenCapture } from './screen-capture';
import { registerPublication } from "./publication/register";
import { registerStudioSettings } from "./studio-settings";
import { registerSykaOnboarding } from "./syka-onboarding";
import { registerSykaGlossary } from "./syka-glossary";
import { hasActiveVideoImports, registerVideoImport } from "./video-import/register";
import { registerStorage } from './storage/register';
import { registerBackgroundRemoval } from './background-removal';
import { registerPostExport } from "./post-export";
import { registerUpdates } from './updates';
import { PermissionStore, permissionAllowed, trustedPermissionOrigin } from './syka-permissions';
import {
  compileProject,
  createProject,
  defaultRoot,
  deleteProject,
  duplicateProject,
  getProject,
  initProject,
  pickFolder,
  pickRoot,
  projectEditHistory,
  renameProject,
  resolveProject,
  scanProjects,
  unwatchAll,
  listEntries,
  realPathEntry,
  noteContent,
  noteRenamed,
  readConfig,
  readManifest,
  removeEntry,
  statEntry,
  unwatchProject,
  watchProject,
  writeConfig,
  writeManifest,
  writeProject,
} from "./projects";
import type { DeepLinkChannel } from "./main-channels";
import type { LogEntry } from "@diffusionstudio/dapi";

const DEV_URL = process.env.SYKA_DEV_URL || "http://localhost:5188";
const AUTH_PROTOCOL = "diffusion";
const MACOS_CORNER_RADIUS = 18;
const MACOS_BACKDROP = { blur: 80, red: 0.07, green: 0.07, blue: 0.07, alpha: 0.9 };
// Window Controls Overlay on Windows: as tall as the renderer's `h-10` drag
// strip, coloured like the sidebar it sits on (`--sidebar`), with symbols in
// `--muted-foreground` like the other title bar icons. The dark value is that
// token flattened onto the sidebar, since the overlay takes opaque colours.
const WINDOWS_OVERLAY_HEIGHT = 40;
const WINDOWS_OVERLAY_COLORS = {
  dark: { color: "#121212", symbolColor: "#a1a1a1" },
  light: { color: "#f7f7f7", symbolColor: "#737373" },
};

// A Squirrel.Windows install/update/uninstall launch: housekeeping only, the
// app quits on its own. Decided first so nothing below starts a service or
// checks for updates on a launch that is about to end.
const squirrelLaunch = handleSquirrelEvent();

const oldProductData = join(app.getPath('appData'), 'Syka Clips');
const legacyUserData = existsSync(oldProductData) ? oldProductData : app.getPath("userData");
app.setName("Syka Studio");
app.setAppUserModelId("syka.studio.editor");
const runtimeRoot = runtimeDirectory({ packaged: isPackagedBuild(), appPath: app.getAppPath(), userData: legacyUserData, override: process.env.SYKA_RUNTIME_ROOT });
process.env.SYKA_RUNTIME_ROOT = runtimeRoot;
const permissionStore = new PermissionStore(join(runtimeRoot, 'permissions.json'));
for (const name of ["profile", "session", "temp", "logs"]) mkdirSync(join(runtimeRoot, name), { recursive: true });
app.setPath("userData", join(runtimeRoot, "profile"));
app.setPath("sessionData", join(runtimeRoot, "session"));
app.setPath("temp", join(runtimeRoot, "temp"));
app.setAppLogsPath(join(runtimeRoot, "logs"));
process.env.TEMP = join(runtimeRoot, "temp");
process.env.TMP = process.env.TEMP;
app.commandLine.appendSwitch("force-renderer-accessibility");
app.commandLine.appendSwitch("enable-blink-features", "CanvasDrawElement");
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

let setNativeCornerRadius: ((handle: Buffer, radius: number) => void) | null = null;
let setNativeBackdrop:
  | ((handle: Buffer, blur: number, r: number, g: number, b: number, a: number) => void)
  | null = null;

if (process.platform === "darwin") {
  const style = loadNativeWindowStyle(() => require(join(app.getAppPath(), 'dist', 'corner_radius.node')));
  if (style) {
    setNativeCornerRadius = style.setCornerRadius;
    setNativeBackdrop = style.setBackdrop;
  }
}

function applyCornerRadius(radius: number) {
  if (!setNativeCornerRadius || !mainWindow || mainWindow.isDestroyed()) return;
  setNativeCornerRadius(mainWindow.getNativeWindowHandle(), radius);
}

function applyBackdrop() {
  if (!setNativeBackdrop || !mainWindow || mainWindow.isDestroyed()) return;
  const { blur, red, green, blue, alpha } = MACOS_BACKDROP;
  setNativeBackdrop(mainWindow.getNativeWindowHandle(), blur, red, green, blue, alpha);
}

function setColorMode(mode: "dark" | "light") {
  if (process.platform === "darwin" || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTitleBarOverlay({ ...WINDOWS_OVERLAY_COLORS[mode], height: WINDOWS_OVERLAY_HEIGHT });
}

// Upstream auto-updates are disabled: a Syka fork must never replace itself
// with Diffusion's release or register itself in somebody else's provider config.

const openWrites = new Map<string, { handle: FileHandle; path: string; temp: string; reserved: boolean }>();

let mainWindow: BrowserWindow | null = null;
let stopUpdates = () => {};
let rendererExporting = false;
let previewWindow: BrowserWindow | null = null;
const chatWindows = new Set<BrowserWindow>();
function isTrustedWindow(contents: Electron.WebContents | null) {
  return !!contents && (contents === mainWindow?.webContents || [...chatWindows].some(window => !window.isDestroyed() && window.webContents === contents));
}
mainBridge.setRequestGuard((event, request) => {
  if (isNoticeWindow(event.sender)) return event.senderFrame === event.sender.mainFrame && trustedNoticeUrl(event.senderFrame?.url || '') && allowedNoticeCommand(request.channel, request.data);
  if (previewWindow && !previewWindow.isDestroyed() && event.sender === previewWindow.webContents) {
    const expected = isPackagedBuild() ? pathToFileURL(join(app.getAppPath(), 'web', 'preview-worker.html')).href
      : new URL('/preview-worker.html', DEV_URL).href;
    return event.senderFrame === event.sender.mainFrame && event.senderFrame?.url === expected;
  }
  if (!mainWindow || !isTrustedWindow(event.sender) || event.senderFrame !== event.sender.mainFrame) return false;
  const url = event.senderFrame?.url || "";
  if (!isPackagedBuild()) {
    try { return new URL(url).origin === new URL(DEV_URL).origin; }
    catch { return false; }
  }
  try { const target = new URL(url), current = new URL(mainWindow.webContents.getURL()); return target.protocol === 'file:' && target.pathname === current.pathname; }
  catch { return false; }
});
registerNotifications(() => mainWindow);
registerSykaGroq(mainBridge);
registerScreenCapture(mainBridge);
registerPublication(mainBridge);
registerStudioSettings(mainBridge);
registerSykaOnboarding(mainBridge);
registerSykaAgentSettings(mainBridge);
registerSykaDependencies(mainBridge, async () => openWrites.size > 0 || rendererExporting || dapi.isBusy() || hasActiveScreenCaptures() || isGroqTranscribing() || hasActiveVideoImports() || await isAgentChatBusy());
mainBridge.handle(MAIN_CHANNELS.SYKA_ACTIVITY, request => { rendererExporting = request?.exporting === true; });
registerSykaResources(mainBridge);
registerSykaFonts(mainBridge);
registerSykaGlossary(mainBridge);
registerVideoImport(mainBridge);
registerStorage(mainBridge, () => hasActiveScreenCaptures() || isGroqTranscribing() || hasActiveVideoImports());
registerBackgroundRemoval(mainBridge);
registerPostExport(mainBridge);
mainBridge.handle(MAIN_CHANNELS.SYKA_PERMISSIONS, async (request) => {
  if (!request || typeof request !== 'object') throw Error('Solicitud de permisos inválida.');
  if (request.action === 'get') return permissionStore.load();
  if (request.action === 'set') return permissionStore.set(request.permission, request.allowed);
  if (request.action === 'system-microphone') {
    if (process.platform === 'win32') await shell.openExternal('ms-settings:privacy-microphone');
    else if (process.platform === 'darwin') await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
    else throw Error('Revisá los permisos de micrófono desde la configuración de tu sistema.');
    return permissionStore.load();
  }
  throw Error('Acción de permisos desconocida.');
});

// Deep links that arrived before the renderer could take them, keyed by the
// channel they belong to so auth and checkout never drain each other's link.
const pendingDeepLinks = new Map<DeepLinkChannel, string>();

// Renderer console mirror, served to the CLI via LOGS_GET. Lives in main so
// it survives reloads and captures everything the devtools console shows
// (page logs, worker logs, uncaught errors) without touching the web bundle.
const LOG_BUFFER_MAX = 2000;
const logBuffer: LogEntry[] = [];

// The docs the MCP instructions point agents at: staged into the bundle by
// scripts/stage-docs.mjs (Contents/Resources/docs) when packaged; the repo's
// own `docs/` in development, so edits show up without a staging step. Null
// when neither exists.
function docsDir(): string | null {
  const dir = isPackagedBuild() ? join(process.resourcesPath, "docs") : join(app.getAppPath(), "..", "..", "docs");
  return existsSync(dir) ? dir : null;
}

// The MCP server agents and the diffusion CLI talk to. Started once the app is
// ready; the first connection switches the app into headless mode.
const dapi = new DapiServer({
  version: app.getVersion(),
  logs: () => logBuffer,
  docsDir: docsDir(),
  onFirstConnection: enableHeadless,
  editorWindow: () => mainWindow,
  preview: {
    preload: join(app.getAppPath(), 'dist', 'preload.js'),
    pagePath: join(app.getAppPath(), 'web', 'preview-worker.html'),
    devUrl: isPackagedBuild() ? undefined : DEV_URL,
    trustWindow: window => { previewWindow = window; },
    observeWindow: captureConsole,
  },
});

function pushLog(level: LogEntry["level"], message: string, source: string) {
  logBuffer.push({ ts: Date.now(), level, message, source });
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.shift();
}

function captureConsole(window: BrowserWindow) {
  window.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
    pushLog(level, message, sourceId ? `${sourceId}:${lineNumber}` : "");
  });
  window.webContents.on("preload-error", (_event, path, error) => {
    pushLog("error", `Preload error: ${error.message}`, path);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    pushLog("error", `Renderer process gone: ${details.reason} (exit code ${details.exitCode})`, "");
  });
}

function findProtocolUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${AUTH_PROTOCOL}://`)) ?? null;
}

function isHiddenLaunch(argv: string[]): boolean {
  return argv.includes("--hidden");
}

// diffusion://auth/callback → auth, diffusion://checkout/callback → checkout.
function deepLinkChannel(url: string): DeepLinkChannel | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (host === "auth") return MAIN_CHANNELS.AUTH_CALLBACK;
  if (host === "checkout") return MAIN_CHANNELS.CHECKOUT_CALLBACK;
  return null;
}

function deliverDeepLink(url: string) {
  const channel = deepLinkChannel(url);
  if (!channel) return;

  // A link that arrives before the page can receive it is parked rather than
  // pushed: the renderer's subscription only exists once the component holding
  // it mounts, which is well after did-finish-load. Parked links are handed
  // over by the take* handlers below, which every consumer calls on mount.
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) {
    pendingDeepLinks.set(channel, url);
    return;
  }

  mainBridge.emit(mainWindow, channel, { url });
}

function takePendingDeepLink(channel: DeepLinkChannel): string | null {
  const url = pendingDeepLinks.get(channel) ?? null;
  pendingDeepLinks.delete(channel);
  return url;
}

async function setFileInputFiles(selector: string, absolutePath: string, targetWindow: BrowserWindow | null = mainWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) throw new Error("No file-transfer window");
  const wc = targetWindow.webContents;
  // Stay attached between calls — attach/detach dominates the cost of a
  // transfer, and file materialization happens in bursts.
  if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");
  const { root } = await wc.debugger.sendCommand("DOM.getDocument");
  const { nodeId } = await wc.debugger.sendCommand("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  if (!nodeId) throw new Error(`Selector not found: ${selector}`);
  await wc.debugger.sendCommand("DOM.setFileInputFiles", {
    files: [resolve(absolutePath)],
    nodeId,
  });
}

function createWindow(show = true) {

  const options: Electron.BrowserWindowConstructorOptions = {
    show: false,
    width: 1200,
    height: 800,
    title: "Syka Studio",
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "preload.js"),
      backgroundThrottling: false,
    },
  }

  if (process.platform === "darwin") {
    options.titleBarStyle = "hiddenInset" as const;
    options.trafficLightPosition = { x: 14, y: 14 };
    options.vibrancy = "sidebar" as const;
    options.backgroundColor = "#00000000";
  }

  if (process.platform === "win32") {
    options.titleBarStyle = "hidden" as const;
    options.titleBarOverlay = { ...WINDOWS_OVERLAY_COLORS.dark, height: WINDOWS_OVERLAY_HEIGHT };
    options.autoHideMenuBar = true;
    options.backgroundColor = WINDOWS_OVERLAY_COLORS.dark.color;

    if (!isPackagedBuild()) {
      options.icon = join(app.getAppPath(), "syka-assets", "icon.png");
    }
  }

  mainWindow = new BrowserWindow(options);
  mainBridge.handle(MAIN_CHANNELS.APP_OPEN_CHAT_WINDOW, async ({ url }) => {
    const target = new URL(url), current = new URL(mainWindow!.webContents.getURL());
    const params = new URLSearchParams(target.hash.split('?')[1] ?? '');
    if (target.origin !== current.origin || target.pathname !== current.pathname || !/^#\/projects\//.test(target.hash) || params.get('chatWindow') !== '1' || !/^[a-zA-Z0-9-]+$/.test(params.get('chat') ?? '')) throw new Error('Invalid chat window URL');
    const child = new BrowserWindow({ ...options, show: true, title: 'Syka Studio · Chat' });
    chatWindows.add(child);
    child.on('closed', () => chatWindows.delete(child));
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    child.webContents.on('will-navigate', (event, destination) => { try { const next = new URL(destination); if (next.origin !== target.origin || next.pathname !== target.pathname) event.preventDefault(); } catch { event.preventDefault(); } });
    await child.loadURL(target.href);
  });
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    try { const target=new URL(url),current=new URL(mainWindow!.webContents.getURL());
      const samePage=target.origin===current.origin && target.pathname===current.pathname;
      const params=new URLSearchParams(target.hash.split('?')[1]??'');
      if(samePage && /^#\/projects\//.test(target.hash) && params.get('chatWindow')==='1' && /^[a-zA-Z0-9-]+$/.test(params.get('chat')??''))return {action:'allow',overrideBrowserWindowOptions:{...options,show:true,title:'Syka Studio · Chat'}};
    }catch{}
    return {action:'deny'};
  });
  mainWindow.webContents.on('did-create-window', child=>{
    chatWindows.add(child);
    child.on('closed', () => chatWindows.delete(child));
    child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    child.webContents.on('will-navigate',(event,url)=>{try{const target=new URL(url),current=new URL(child.webContents.getURL());if(target.origin!==current.origin||target.pathname!==current.pathname)event.preventDefault();}catch{event.preventDefault();}});
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (url !== current && !( !isPackagedBuild() && new URL(url).origin === new URL(DEV_URL).origin )) event.preventDefault();
  });

  captureConsole(mainWindow);

  applyCornerRadius(MACOS_CORNER_RADIUS);
  applyBackdrop();

  mainWindow.once("ready-to-show", () => {
    applyCornerRadius(MACOS_CORNER_RADIUS);
    applyBackdrop();

    if (show) {
      mainWindow?.show();
    }
  });

  mainWindow.on("show", () => {
    applyCornerRadius(MACOS_CORNER_RADIUS);
    applyBackdrop();
  });

  // Fall back to the load event when first-paint notification is delayed.
  mainWindow.webContents.once("did-finish-load", () => { if (show) mainWindow?.show(); });

  mainWindow.on("enter-full-screen", () => {
    applyCornerRadius(0);
    mainBridge.emit(mainWindow, MAIN_CHANNELS.WINDOW_FULLSCREEN_CHANGE, { fullscreen: true });
  });
  mainWindow.on("leave-full-screen", () => {
    applyCornerRadius(MACOS_CORNER_RADIUS);
    mainBridge.emit(mainWindow, MAIN_CHANNELS.WINDOW_FULLSCREEN_CHANGE, { fullscreen: false });
  });
  mainWindow.on("closed", () => {
    stopNotifications();
    mainWindow = null;
    // A hidden renderer must not keep a closed Windows/Linux app alive.
    if (process.platform !== 'darwin') app.quit();
  });

  if (!isPackagedBuild()) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(join(app.getAppPath(), "web", "index.html"));
  }
}

// No Diffusion auth/checkout URL protocol is registered by the local fork.

if (squirrelLaunch) {
  // Update.exe is at work; handleSquirrelEvent quits the app when it is done.
} else if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, argv) => {
    const url = findProtocolUrl(argv);
    if (url) deliverDeepLink(url);

    const hidden = isHiddenLaunch(argv);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (hidden) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow(!hidden);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeepLink(url);
  });

  mainBridge.handle(MAIN_CHANNELS.APP_OPEN_EXTERNAL, ({ url }) => {
    if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error("Unsupported external URL");
    return shell.openExternal(url);
  });

  mainBridge.handle(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, ({ path }) => shell.showItemInFolder(path));
  mainBridge.handle(MAIN_CHANNELS.ANALYTICS_TRACK, ({ event, data }) => trackEvent(event, data));
  mainBridge.handle(MAIN_CHANNELS.AUTH_GET_PENDING_CALLBACK, () =>
    takePendingDeepLink(MAIN_CHANNELS.AUTH_CALLBACK),
  );
  mainBridge.handle(MAIN_CHANNELS.CHECKOUT_GET_PENDING_CALLBACK, () =>
    takePendingDeepLink(MAIN_CHANNELS.CHECKOUT_CALLBACK),
  );
  mainBridge.handle(MAIN_CHANNELS.WINDOW_IS_FULLSCREEN, () => mainWindow?.isFullScreen() ?? false);
  mainBridge.handle(MAIN_CHANNELS.WINDOW_SET_COLOR_MODE, ({ mode }) => setColorMode(mode));
  mainBridge.handle(MAIN_CHANNELS.WINDOW_CAPTURE, async () => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error("No main window");
    const image = await mainWindow.webContents.capturePage(undefined, { stayHidden: true });
    const { width, height } = image.getSize();
    const png = image.toPNG();
    // A plain Uint8Array over the PNG, so the renderer sees bytes and not a Buffer.
    return { png: new Uint8Array(png.buffer, png.byteOffset, png.byteLength), width, height };
  });
  mainBridge.handle(MAIN_CHANNELS.LOGS_GET, () => logBuffer);
  mainBridge.handle(MAIN_CHANNELS.AGENT_CHAT_ENDPOINT, () => agentChatEndpoint());
  mainBridge.handle(MAIN_CHANNELS.MCP_STATUS, async () => mcpStatus(await dapi.status()));
  mainBridge.handle(MAIN_CHANNELS.MCP_APPLY, async (request) => applyMcp(request, await dapi.status()));
  mainBridge.handle(MAIN_CHANNELS.CLI_STATUS, () => cliStatus());
  mainBridge.handle(MAIN_CHANNELS.CLI_INSTALL, () => installCli());
  mainBridge.handle(MAIN_CHANNELS.CLI_UNINSTALL, () => uninstallCli());
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_PICK_ROOT, () => pickRoot(mainWindow));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_PICK_FOLDER, () => pickFolder(mainWindow));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_DEFAULT_ROOT, () => defaultRoot(mainWindow));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_SCAN, ({ root }) => scanProjects(root));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_GET, ({ dir }) => getProject(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_INIT, ({ dir }) => initProject(mainWindow, dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_RESOLVE, ({ dir }) => resolveProject(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_CREATE, ({ root, displayName }) =>
    createProject(root, displayName),
  );
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_RENAME, ({ dir, displayName }) => renameProject(dir, displayName));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_DUPLICATE, ({ dir }) => duplicateProject(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_DELETE, ({ dir }) => deleteProject(dir).then(deleteProjectChats));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_COMPILE, ({ dir }) => compileProject(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_SOURCE_REVISION, ({ dir }) => projectSourceRevision(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_WRITE, ({ dir, edits, historyGroup }) => writeProject(dir, edits, historyGroup));
  mainBridge.handle(MAIN_CHANNELS.SYKA_EDIT_HISTORY_STATUS, ({ dir }) => projectEditHistory(dir));
  mainBridge.handle(MAIN_CHANNELS.SYKA_EDIT_HISTORY_UNDO, ({ dir }) => projectEditHistory(dir, "undo"));
  mainBridge.handle(MAIN_CHANNELS.SYKA_EDIT_HISTORY_REDO, ({ dir }) => projectEditHistory(dir, "redo"));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_WATCH, ({ dir }, event) =>
    watchProject(BrowserWindow.fromWebContents(event.sender), dir),
  );
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_UNWATCH, ({ dir }) => unwatchProject(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_MANIFEST_READ, ({ dir }) => readManifest(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_MANIFEST_WRITE, ({ dir, manifest }) => writeManifest(dir, manifest));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_CONFIG_READ, ({ dir }) => readConfig(dir));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_CONFIG_WRITE, ({ dir, config }) => writeConfig(dir, config));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_FS_LIST, ({ dir, source }) => listEntries(dir, source));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_FS_STAT, ({ dir, source }) => statEntry(dir, source));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_FS_REMOVE, ({ dir, path }) => removeEntry(dir, path));
  mainBridge.handle(MAIN_CHANNELS.PROJECTS_FS_REAL_PATH, ({ dir, source }) => realPathEntry(dir, source));
  mainBridge.handle(MAIN_CHANNELS.FILE_TRANSFER, ({ selector, absolutePath }, event) =>
    setFileInputFiles(selector, absolutePath, BrowserWindow.fromWebContents(event.sender)),
  );

  mainBridge.handle(MAIN_CHANNELS.FILE_PICK_EXPORT, async ({ dir, name, extension }) => {
    if (!mainWindow || !isAbsolute(dir) || !["mp4", "mov", "webm", "ogg", "png"].includes(extension)) throw new Error("Invalid export target");
    const finalDir = join(dir, "02 Finales");
    await mkdir(finalDir, { recursive: true });
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Exportar desde Syka Studio", defaultPath: join(finalDir, basename(name)),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      properties: ["showOverwriteConfirmation", "createDirectory"],
    });
    return { path: result.canceled ? null : result.filePath ?? null };
  });

  mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_OPEN, async ({ path, exclusive }) => {
    await mkdir(dirname(path), { recursive: true });

    // `exclusive` means the name must be free, so it is taken now rather than
    // at the rename below — the empty file that reserves it is renamed over
    // when the write finishes, and removed when it is abandoned.
    if (exclusive) {
      noteContent(path, "");
      await (await open(path, "wx")).close();
    }

    // The bytes go to a temp file beside the destination and are renamed into
    // place once they are whole. Nothing ever sees half an asset — not the
    // watcher, not a scan of the library, not an import — so there is no
    // window anyone has to be kept out of.
    const temp = tempPathFor(path);
    const handle = await open(temp, "wx");
    const id = randomUUID();
    openWrites.set(id, { handle, path, temp, reserved: exclusive === true });
    return { id };
  });

  mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_CHUNK, async ({ id, data, position }) => {
    const entry = openWrites.get(id);
    if (!entry) throw new Error(`No open file for write id ${id}`);
    await entry.handle.write(data, 0, data.byteLength, position);
  });

  mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_CLOSE, async ({ id }) => {
    const entry = openWrites.get(id);
    if (!entry) return;
    openWrites.delete(id);
    try {
      await entry.handle.close();
      // Claimed before the rename, which is the first and only moment the
      // destination changes (see `noteRenamed`).
      await noteRenamed(entry.temp, entry.path);
      await replaceFileAtomic(entry.temp, entry.path);
    } catch (error) {
      await unlink(entry.temp).catch(() => { });
      throw error;
    }
  });

  // Abort: close the fd and drop the temp file (cancel / error cleanup). The
  // destination is left alone — an abandoned write never reached it — bar the
  // name an `exclusive` open reserved, which is given back.
  mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_ABORT, async ({ id }) => {
    const entry = openWrites.get(id);
    if (!entry) return;
    openWrites.delete(id);
    try {
      await entry.handle.close();
    } finally {
      await unlink(entry.temp).catch(() => { });
      if (entry.reserved) {
        noteContent(entry.path, null);
        await unlink(entry.path).catch(() => { });
      }
    }
  });

  app.whenReady().then(() => {
    if (!isPackagedBuild() && process.platform === "darwin") {
      const devIcon = nativeImage.createFromPath(join(app.getAppPath(), "assets", "icon-dev.png"));
      if (!devIcon.isEmpty()) app.dock?.setIcon(devIcon);
    }

    setupAppMenu();
    void permissionStore.load().catch(() => { /* Preserve invalid files and keep restrictive defaults. */ });
    const trustedPermissionWindow = (wc: Electron.WebContents | null, requestingUrl?: string) => {
      if (isNoticeWindow(wc)) return trustedNoticeUrl(wc!.getURL()) && (!requestingUrl || requestingUrl === 'file://' || trustedNoticeUrl(requestingUrl));
      const editorUrl = mainWindow?.webContents.getURL() || DEV_URL;
      return isTrustedWindow(wc) && trustedPermissionOrigin(wc!.getURL(), editorUrl) && (!requestingUrl || trustedPermissionOrigin(requestingUrl, editorUrl));
    };
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => callback(
      details.isMainFrame !== false && trustedPermissionWindow(wc, details.requestingUrl)
      && permissionAllowed(permission, permissionStore.snapshot(), 'mediaTypes' in details ? details.mediaTypes : [])
    ));
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin, details) =>
      trustedPermissionWindow(wc, origin) && permissionAllowed(permission, permissionStore.snapshot(), details.mediaType ? [details.mediaType] : [])
    );
    session.defaultSession.setDevicePermissionHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*.diffusion.studio/*", "*://*.supabase.co/*", "*://*.sentry.io/*", "*://cloud.umami.is/*"] }, (_details, callback) => callback({ cancel: true }));

    const url = findProtocolUrl(process.argv);
    if (url) deliverDeepLink(url);

    dapi.start();
    // The chat's sessions get the MCP server by URL; `?client=chat` keeps the
    // app from switching into remote-controlled mode for them (see dapi/http).
    Promise.all([dapi.mcpUrl(), ensurePackagedTools()]).then(([url]) =>
      startAgentChat({
        onNotice: agentNotice,
        docsDir: docsDir(),
        dataDir: join(app.getPath("userData"), "agent-chat"),
        mcpUrl: url ? `${url}?client=chat` : null,
        version: app.getVersion(),
      }),
    );
    // CLI/MCP are available locally without mutating global client configs on launch.
    createWindow(!isHiddenLaunch(process.argv));
    stopUpdates = registerUpdates(() => mainWindow, () => openWrites.size > 0 || rendererExporting || dapi.isBusy() || dependenciesBusy() || hasActiveScreenCaptures() || isGroqTranscribing() || hasActiveVideoImports());
  });

  app.on("before-quit", () => {
    stopUpdates();
    stopNotifications();
    unwatchAll();
    stopAgentChat();
    dapi.stop();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });
} else {
  app.quit();
}
