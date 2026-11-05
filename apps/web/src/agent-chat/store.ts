/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The chat state the UI renders, at module level so it outlives any page:
// a Solid store fed by the host's snapshots and events through the shared
// reducer. Deltas are batched per animation frame. Everything the host
// owns (chats, transcripts, questions) is a view here; what is ours alone
// is the draft per chat, which tab is up, and which chat each project shows.

import { generalPrefs } from '@/lib/general-prefs';
import { batch, createRoot, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { ChatModelSelection } from './chat-model-selection';
import { toast } from "somoto";

import {
  AgentChatError,
  emptyTranscript,
  reduce,
  type ChatEvent,
  type ChatSnapshot,
  type ChatSummary,
  type HarnessInfo,
  type HarnessId,
  type Item,
  type ModelRef,
  type RequestResponse,
  type ConnectionState,
} from "@diffusionstudio/agent-chat";
import type { Transcript } from "@diffusionstudio/agent-chat";

import { store as settings } from "@/init";
import { createStoredSignal } from "@/lib/store";
import { projectRoute } from "@/hooks/use-project-route";
import type { ProjectInfo } from "@/projects";
import { drainProjectEdits } from '@/projects/edits';

import { attachmentFromPath, attachmentPaths, type Attachment } from "./attachments";
import { client, hasHost } from "./connection";
import { DEFAULT_MODEL_VISIBILITY, parseModelVisibility, visibleModelCatalog, type ModelVisibility } from './model-visibility';

export type SidebarTab = "assets" | "chat";

export type Draft = { text: string; attachments: Attachment[] };

/** The draft key for a chat that does not exist yet. */
export const draftKey = (projectId: string, chatId: string | null): string => chatId ?? `new:${projectId}`;

type State = {
  connection: ConnectionState;
  harnesses: HarnessInfo[];
  /** Transcripts by chat id, for every chat opened this session. */
  chats: Record<string, Transcript>;
  /** History by project id, newest first. */
  lists: Record<string, ChatSummary[]>;
  drafts: Record<string, Draft>;
  /** The user item shown while `turn.send` is in flight, by draft key. */
  sending: Record<string, Item | null>;
};

const EMPTY_DRAFT: Draft = { text: "", attachments: [] };
const PROBE_MAX_AGE_MS = 60_000;
const CONNECT_TIMEOUT_MS = 4000;

const [state, setState] = createStore<State>({
  connection: "closed",
  harnesses: [],
  chats: {},
  lists: {},
  drafts: {},
  sending: {},
});

export { state as chatState };

// --- settings that persist ---------------------------------------------

const root = createRoot(() => {
  const [tab, setTab] = createStoredSignal(settings.define<SidebarTab>("leftSidebar.tab", "assets"));
  const [model, setModel] = createStoredSignal(settings.define<ModelRef | null>("agentChat.model", null));
  const [chatModels, setChatModels] = createStoredSignal(settings.define<Record<string, ChatModelSelection>>('agentChat.modelsByChat', {}));
  const [active, setActive] = createStoredSignal(settings.define<Record<string, string>>("agentChat.active", {}));
  const [visibility, setVisibility] = createStoredSignal(settings.define<ModelVisibility>('agentChat.modelVisibility', DEFAULT_MODEL_VISIBILITY, parseModelVisibility));
  return { tab, setTab, model, setModel, chatModels, setChatModels, active, setActive, visibility, setVisibility };
});

export const modelVisibility = root.visibility;
export const setModelVisibility = root.setVisibility;
export const pickerHarnesses = () => visibleModelCatalog(state.harnesses, root.visibility());
export function setHarnessVisible(id: HarnessId, visible: boolean): void {
  root.setVisibility({ ...root.visibility(), harnesses: { ...root.visibility().harnesses, [id]: visible } });
}
export function setHermesProviderVisible(id: string, visible: boolean): void {
  root.setVisibility({ ...root.visibility(), hermesProviders: { ...root.visibility().hermesProviders, [id]: visible } });
}
export function setOpenCodeProviderVisible(id: string, visible: boolean): void {
  root.setVisibility({ ...root.visibility(), opencodeProviders: { ...root.visibility().opencodeProviders, [id]: visible } });
}
export function setModelsVisible(harness: HarnessId, ids: readonly string[], visible: boolean): void {
  const current=root.visibility(),entries={...current.models?.[harness]};
  for(const id of ids)entries[id]=visible;
  root.setVisibility({...current,models:{...current.models,[harness]:entries}});
}

/** Which tab the left sidebar shows; persists across sessions. */
export const sidebarTab = root.tab;
export const setSidebarTab = root.setTab;

/** The remembered model, whether or not its harness is currently ready. */
export const storedModel = root.model;
export const setStoredModel = root.setModel;
export const chatModelSelection = (chatId: string) => root.chatModels()[chatId];
export function setChatModelSelection(chatId: string, ref: ModelRef) {
  root.setChatModels({ ...root.chatModels(), [chatId]: { ref, chosenAt: Date.now() } });
}

/** Sentinel for "the empty draft chat" in the per-project active map. */
const DRAFT = "";

/** The chat a project's panel shows: the remembered one, else the newest, else a draft (null). */
export function activeChatId(projectId: string): string | null {
  const remembered = root.active()[projectId];
  if (remembered === DRAFT) return null;
  // Before the history arrives the remembered chat is opened on trust, so its
  // snapshot and the list travel together; a list without it falls back.
  const list = state.lists[projectId];
  if (remembered && (state.chats[remembered] || !list || list.some((chat) => chat.id === remembered))) return remembered;
  return list?.[0]?.id ?? null;
}

/**
 * Starts loading what a project's chat panel will show, before the editor is
 * up: its history and the chat it will open. Safe to call more than once.
 */
export function prefetchProjectChats(projectId: string): void {
  if (!hasHost()) return;
  ensureConnected();
  void refreshChats(projectId).then(() => {
    const id = activeChatId(projectId);
    if (id) openChat(id);
  });
  const id = activeChatId(projectId);
  if (id) openChat(id);
}

// --- open timings ---------------------------------------------------------

export type ChatOpenTiming = { chatId: string; title: string; requestedAt: number; ms: number; items: number };

const openRequestedAt = new Map<string, number>();
const [openTimings, setOpenTimings] = createSignal<ChatOpenTiming[]>([]);

/** How long the last chats took from being asked for to their transcript, newest first. */
export { openTimings as chatOpenTimings };

function recordOpenTiming(snapshot: ChatSnapshot): void {
  const requestedAt = openRequestedAt.get(snapshot.chat.id);
  if (requestedAt === undefined) return;
  openRequestedAt.delete(snapshot.chat.id);
  const timing = { chatId: snapshot.chat.id, title: snapshot.chat.title, requestedAt, ms: Math.round(performance.now() - requestedAt), items: snapshot.items.length };
  setOpenTimings((list) => [timing, ...list].slice(0, 12));
}

export function setActiveChat(projectId: string, chatId: string | null): void {
  root.setActive({ ...root.active(), [projectId]: chatId ?? DRAFT });
}

// --- connection ---------------------------------------------------------

let connected = false;
let harnessesAt = 0;

/** Connects once; safe to call from anywhere the chat is about to be used. */
export function ensureConnected(): void {
  if (connected) return;
  connected = true;
  client.onState((connection) => setState("connection", connection));
  client.onHarnesses((harnesses) => {
    harnessesAt = Date.now();
    setState("harnesses", harnesses);
  });
  setState("connection", hasHost() ? "connecting" : "unavailable");
  if (hasHost()) client.connect();
}

/** Resolves once the socket is open, or rejects after a short wait. */
function whenOpen(): Promise<void> {
  ensureConnected();
  if (client.state === "open") return Promise.resolve();
  if (!hasHost()) return Promise.reject(new AgentChatError("disconnected", "Chat runs in the desktop app"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new AgentChatError("disconnected", "The agent host is not running"));
    }, CONNECT_TIMEOUT_MS);
    const stop = client.onState((connection) => {
      if (connection !== "open") return;
      clearTimeout(timer);
      stop();
      resolve();
    });
  });
}

/** Automatic refreshes honor the cache; an explicit retry also bypasses the host cache. */
export function refreshHarnesses(force = false): void {
  if (client.state !== "open" || !force && Date.now() - harnessesAt < PROBE_MAX_AGE_MS) return;
  harnessesAt = Date.now();
  void client.request("harnesses.list", { refresh: true, ...(force ? { force: true } : {}) }).catch(() => {});
}

export async function authenticateHarness(harness: HarnessId, methodId = 'connect'): Promise<void> {
  await whenOpen();
  await client.request("harnesses.authenticate", { harness, methodId });
}

export async function submitProviderAuthCode(harness: HarnessId, flowId: string, code: string): Promise<void> {
  await whenOpen();
  await client.request('harnesses.auth.respond', { harness, flowId, code });
}
export async function cancelProviderAuth(harness: HarnessId, flowId: string): Promise<void> {
  await whenOpen();
  await client.request('harnesses.auth.cancel', { harness, flowId });
}
/**
 * A project still carrying a name nobody chose gets a real title from the first
 * message of a chat, in the background; the folder stays where it is.
 */
async function titleProjectFromMessage(dir: string, harness: HarnessId, text: string): Promise<void> {
  try {
    const { getProject, renameProject } = await import('@/projects');
    const { isPlaceholderProjectName } = await import('@/lib/db');
    const project = await getProject(dir);
    if (!project || !isPlaceholderProjectName(project.displayName ?? project.name)) return;
    const title = await suggestTitle(harness, text);
    if (title) await renameProject(dir, title, true);
  } catch { /* The placeholder name stays. */ }
}

/** A short title from the chosen provider's small model; null when it is not available. */
export async function suggestTitle(harness: HarnessId, text: string): Promise<string | null> {
  try { await whenOpen(); return (await client.request('titles.suggest', { harness, text })).title; }
  catch { return null; }
}

export async function providerAuthMethods(harness: HarnessId) {
  await whenOpen();
  return client.request('harnesses.auth.methods', { harness });
}

export async function readProviderSettings() {
  await whenOpen();
  return client.request('harnesses.settings', {});
}
export async function saveProviderSettings(entry: import('@diffusionstudio/agent-chat').HarnessPathConfig) {
  await whenOpen();
  return client.request('harnesses.configure', entry);
}

/** Ready, or showing its last confirmed catalog while the startup check runs; the host waits for that check before sending. */
export const pickableHarness = (harness: HarnessInfo): boolean => harness.status === 'ready' || harness.status === 'checking' && harness.catalogSource === 'cache';

export const readyHarnesses = (): HarnessInfo[] => state.harnesses.filter((harness) => harness.id !== 'muse' && harness.status === "ready");

/** Families picked before anything is remembered, best first, across every ready harness. */
const PREFERRED_MODELS = [/astra/i, /sol/i, /fable/i, /opus/i];

/**
 * The model the composers send with: the remembered one if its harness is
 * ready, else the best preferred family on offer, else the first ready default.
 */
export function currentModel(): ModelRef | null {
  const ready = pickerHarnesses().filter(h => pickableHarness(h) && h.models.length > 0);
  const remembered = root.model();
  if (remembered) {
    // Incremental discovery must not silently select a different provider
    // while the saved connection is being checked or its last catalog awaits
    // recovery. The host rejects sends until that provider is ready again.
    if (pickerHarnesses().some(entry => entry.id === remembered.harness && (entry.status === 'checking' || entry.catalogSource === 'cache'))) return remembered;
    const harness = ready.find((entry) => entry.id === remembered.harness);
    if (harness && harness.models.some((model) => model.id === remembered.model)) return remembered;
  }
  for (const pattern of PREFERRED_MODELS) {
    for (const harness of ready) {
      const match = harness.models.find((model) => pattern.test(model.id) || pattern.test(model.label));
      if (match) return { harness: harness.id, model: match.id };
    }
  }
  const first = ready[0];
  if (!first) return null;
  const model = first.models.find(m => m.id === first.defaultModel)?.id ?? first.models[0]?.id;
  return model ? { harness: first.id, model } : null;
}

/** The label the pickers show for a model ref. */
export function modelLabel(ref: ModelRef | null): string {
  if (!ref) return "No agent available";
  const harness = state.harnesses.find((entry) => entry.id === ref.harness);
  return harness?.models.find((model) => model.id === ref.model)?.label ?? ref.model;
}

// --- events -------------------------------------------------------------

const queue = new Map<string, ChatEvent[]>();
let flushScheduled = false;
/** New chats whose optimistic item waits for the first snapshot, by chat id → draft key. */
const awaitingSnapshot = new Map<string, string>();

function flush(): void {
  flushScheduled = false;
  if (queue.size === 0) return;
  const pending = [...queue];
  queue.clear();
  batch(() => {
    for (const [chatId, events] of pending) {
      let transcript = state.chats[chatId] ?? emptyTranscript();
      for (const event of events) {
        transcript = reduce(transcript, event);
        if (event.type === "chat.updated") upsertSummary(event.chat);
        if (event.type === "turn.started") setState("sending", chatId, null);
      }
      setState("chats", chatId, transcript);
    }
  });
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(flush);
  // A hidden tab gets no frames; the timer keeps history and status honest.
  setTimeout(flush, 120);
}

function upsertSummary(chat: ChatSummary): void {
  setState(
    "lists",
    chat.projectId,
    produce((list) => {
      if (!list) return;
      const index = list.findIndex((entry) => entry.id === chat.id);
      if (index >= 0) list[index] = chat;
      else list.unshift(chat);
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }),
  );
  if (!state.lists[chat.projectId]) setState("lists", chat.projectId, [chat]);
}

const subscriptions = new Map<string, () => void>();

/** Subscribes to a chat (once); the transcript lands in the store and stays current. */
export function openChat(chatId: string): void {
  ensureConnected();
  if (subscriptions.has(chatId)) return;
  openRequestedAt.set(chatId, performance.now());
  const unsubscribe = client.open(chatId, (message) => {
    if (message.type === "snapshot") {
      applySnapshot(message.snapshot);
      recordOpenTiming(message.snapshot);
      const key = awaitingSnapshot.get(chatId);
      if (key) {
        awaitingSnapshot.delete(chatId);
        setState("sending", key, null);
      }
      return;
    }
    const events = queue.get(chatId);
    if (events) events.push(message.event);
    else queue.set(chatId, [message.event]);
    scheduleFlush();
  });
  subscriptions.set(chatId, unsubscribe);
}

function applySnapshot(snapshot: ChatSnapshot): void {
  queue.delete(snapshot.chat.id);
  batch(() => {
    setState("chats", snapshot.chat.id, { queue: snapshot.queue, contextUsage: snapshot.contextUsage, items: snapshot.items, pending: snapshot.pending, turnId: null, chat: snapshot.chat });
    upsertSummary(snapshot.chat);
  });
}

/** Fetches a project's history; the store keeps it current from then on. */
export async function refreshChats(projectId: string): Promise<void> {
  try {
    await whenOpen();
    const list = await client.request("chats.list", { projectId });
    setState("lists", projectId, list);
  } catch {
    // Offline: whatever the store holds stays.
  }
}

// --- drafts -------------------------------------------------------------

export const draft = (key: string): Draft => state.drafts[key] ?? EMPTY_DRAFT;

export function setDraftText(key: string, text: string): void {
  setState("drafts", key, { ...draft(key), text });
}

export function setDraftAttachments(key: string, attachments: Attachment[]): void {
  setState("drafts", key, { ...draft(key), attachments });
}

export function clearDraft(key: string): void {
  setState("drafts", key, EMPTY_DRAFT);
}

// --- actions ------------------------------------------------------------

export type SendOptions = {
  projectId: string;
  cwd: string;
  chatId: string | null;
  text: string;
  attachments: string[];
  model: ModelRef;
};

/** Sends a turn; resolves with the chat id as soon as the host accepted it. */
export async function send(options: SendOptions): Promise<string> {
  const key = draftKey(options.projectId, options.chatId);
  const optimistic: Item = {
    id: `optimistic-${Date.now()}`,
    kind: "user",
    text: options.text,
    ...(options.attachments.length ? { attachments: options.attachments } : {}),
  };
  setState("sending", key, optimistic);
  try {
    await whenOpen();
    try {
      await drainProjectEdits(options.cwd);
    } catch (error) {
      throw new Error(`No envié el mensaje: primero hay que guardar los cambios del editor. ${error instanceof Error ? error.message : String(error)}`);
    }
    const { chatId } = await client.request("turn.send", {
      ...(options.chatId ? { chatId: options.chatId } : {}),
      projectId: options.projectId,
      cwd: options.cwd,
      text: options.text,
      ...(options.attachments.length ? { attachments: options.attachments } : {}),
      model: options.model,
      ...(generalPrefs().autoTitles ? {} : { autoTitle: false }),
    });
    if (!options.chatId) {
      awaitingSnapshot.set(chatId, key);
      setActiveChat(options.projectId, chatId);
      void titleProjectFromMessage(options.cwd, options.model.harness, options.text);
    }
    setChatModelSelection(chatId, options.model);
    openChat(chatId);
    flush();
    if (options.chatId) setState("sending", key, null);
    return chatId;
  } catch (error) {
    setState("sending", key, null);
    throw error;
  }
}

export async function interrupt(chatId: string): Promise<void> {
  await client.request("turn.interrupt", { chatId });
}

export async function enqueue(options: SendOptions): Promise<void> {
  if (!options.chatId) throw Error('Esperá a que se abra el chat para agregar mensajes a la cola.');
  await whenOpen();
  await drainProjectEdits(options.cwd);
  await client.request('queue.add', { chatId: options.chatId, text: options.text, attachments: options.attachments, model: options.model });
  flush();
}

export async function removeQueued(chatId: string, messageId: string): Promise<void> {
  await whenOpen();
  await client.request('queue.remove', { chatId, messageId });
  flush();
}

export async function resumeQueue(chatId: string): Promise<void> {
  await whenOpen();
  await client.request('queue.resume', { chatId });
  flush();
}

export async function steer(chatId: string, cwd: string, text: string, attachments: string[]): Promise<void> {
  await whenOpen();
  await drainProjectEdits(cwd);
  await client.request('turn.steer', { chatId, text, attachments });
  flush();
}

export async function redirectQueued(chatId: string, cwd: string, messageId: string): Promise<void> {
  await whenOpen();
  await drainProjectEdits(cwd);
  await client.request('queue.redirect', { chatId, messageId });
  flush();
}

export async function respond(chatId: string, requestId: string, response: RequestResponse): Promise<void> {
  await client.request("request.respond", { chatId, requestId, response });
}

export async function deleteChat(projectId: string, chatId: string): Promise<void> {
  subscriptions.get(chatId)?.();
  subscriptions.delete(chatId);
  await client.request("chats.delete", { chatId });
  batch(() => {
    setState("lists", projectId, (list) => (list ?? []).filter((entry) => entry.id !== chatId));
    setState("chats", chatId, undefined!);
    setState("drafts", chatId, undefined!);
  });
  if (root.active()[projectId] === chatId) setActiveChat(projectId, activeChatId(projectId));
}

/** The transcript to render for a chat; empty until its snapshot lands. */
export const transcriptOf = (chatId: string | null): Transcript => (chatId ? (state.chats[chatId] ?? emptyTranscript()) : emptyTranscript());

/** The summary as the host last reported it; the list's copy until the transcript's arrives. */
export function summaryOf(projectId: string, chatId: string | null): ChatSummary | null {
  if (!chatId) return null;
  return state.chats[chatId]?.chat ?? state.lists[projectId]?.find((entry) => entry.id === chatId) ?? null;
}

// --- home-view handoff ---------------------------------------------------

export type StartChatOptions = {
  project: ProjectInfo;
  text: string;
  attachments: string[];
  model: ModelRef;
};

/**
 * Starts a chat from the dashboard: sends the first turn, makes the new chat
 * the project's active one and opens the Chat tab, so the editor lands with
 * the reply already streaming. On failure the text survives as the project's
 * draft and the error is a toast; home navigates either way.
 */
export async function startChat(options: StartChatOptions): Promise<void> {
  const projectId = options.project.id;
  setSidebarTab("chat");
  // The layout provider is not mounted on the dashboard, so its stored key
  // is written directly: the editor reads it when it mounts.
  settings.define<boolean>("layout.uiVisible", true).value = true;
  try {
    await send({ projectId, cwd: options.project.dir, chatId: null, text: options.text, attachments: options.attachments, model: options.model });
  } catch (error) {
    setActiveChat(projectId, null);
    setState("drafts", draftKey(projectId, null), {
      text: options.text,
      attachments: options.attachments.map(attachmentFromPath),
    });
    toast.error("Could not start the chat", { description: (error as Error).message });
  }
}

/** The route a started chat lands on. */
export const chatRoute = (project: ProjectInfo): string => projectRoute(project.id || project.name);

export { attachmentPaths };

/** Left sidebar width by tab: room for about 50 characters of 12 px text on the Chat tab. */
export const ASSETS_SIDEBAR_WIDTH = 264;
export const CHAT_SIDEBAR_WIDTH = 340;

const CHAT_WIDTH_KEY='syka:chat-sidebar-width:v1';
const storedChatWidth=Number(localStorage.getItem(CHAT_WIDTH_KEY));
export const [chatSidebarWidth,updateChatSidebarWidth]=createSignal(Number.isFinite(storedChatWidth)&&storedChatWidth>=280?Math.min(800,storedChatWidth):CHAT_SIDEBAR_WIDTH);
export function setChatSidebarWidth(value:number){const next=Math.round(Math.min(Math.max(280,innerWidth-550),800,Math.max(280,value)));updateChatSidebarWidth(next);localStorage.setItem(CHAT_WIDTH_KEY,String(next));}
export const leftSidebarWidth = (): number => (sidebarTab() === "chat" ? chatSidebarWidth() : ASSETS_SIDEBAR_WIDTH);

/** For the empty state: why nothing can be sent right now, or null. */
export function blockedReason(): string | null {
  if (state.connection === "unavailable") return "El chat funciona en la aplicación de escritorio.";
  if (state.connection !== "open") return "Conectando con tus modelos…";
  const pickable = state.harnesses.some(harness => harness.id !== 'muse' && pickableHarness(harness));
  if (!pickable && state.harnesses.length && state.harnesses.every((harness) => harness.status === "checking")) return "Comprobando los modelos conectados…";
  if (!pickable) {
    return "Conectá un modelo en Configuración para empezar.";
  }
  return null;
}

/** Persist an empty session without starting a model turn. */
export async function createChat(projectId:string,cwd:string,model:ModelRef,title='Nuevo chat'):Promise<string>{
 await whenOpen();const chat=await client.request('chats.create',{projectId,cwd,model,title});upsertSummary(chat);setActiveChat(projectId,chat.id);openChat(chat.id);return chat.id;
}
