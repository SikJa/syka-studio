/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The whole loop over a real socket: the browser client against the host
// with the fake harness behind it. What the UI does is what these do.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { WebSocket } from "ws";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AgentChatClient } from "../src/client";
import { emptyTranscript, reduce } from "../src/reduce";
import { FakeHarness } from "../src/host/fake";
import { createAgentHost } from "../src/host/index";

import type { ChatEvent, ChatSnapshot, Item } from "../src/protocol";
import type { Transcript } from "../src/reduce";
import type { RunningAgentHost } from "../src/host/index";

let dir: string;
let host: RunningAgentHost;
let fake: FakeHarness;
const clients: AgentChatClient[] = [];

const PROJECT = { projectId: "proj", cwd: "/tmp/proj" };
const MODEL = { harness: "codex" as const, model: "fake-fast" };

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "agent-chat-e2e-"));
  fake = new FakeHarness({ tickMs: 2 });
  host = await createAgentHost({
    token: "secret-token",
    dataDir: dir,
    mcp: { name: "syka", url: "http://127.0.0.1:3275/mcp?client=chat" },
    version: "0.0.0-test",
    harnesses: [fake],
    allowedOrigins: ["null"],
    log: () => {},
  });
});

afterAll(async () => {
  await host.stop();
  const target = resolve(dir);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('agent-chat-e2e-')) throw Error('Invalid E2E fixture cleanup');
  rmSync(target, { recursive: true, force: true });
});

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

// Node's `ws` sends no Origin header; the host's allow-list has "null" for that.
function connect(url = host.url): Promise<AgentChatClient> {
  const client = new AgentChatClient({
    resolveEndpoint: async () => url,
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    minBackoffMs: 20,
    maxBackoffMs: 50,
  });
  clients.push(client);
  return new Promise((resolve, reject) => {
    const stop = client.onState((state) => {
      if (state === "open") {
        stop();
        resolve(client);
      }
    });
    client.connect();
    setTimeout(() => reject(new Error("no connection")), 3000);
  });
}

/** Subscribes and folds everything into a transcript the test can wait on. */
function follow(client: AgentChatClient, chatId: string) {
  let transcript: Transcript = emptyTranscript();
  const events: ChatEvent[] = [];
  const waiters: { test(t: Transcript): boolean; resolve(t: Transcript): void }[] = [];
  const check = () => {
    for (const waiter of waiters.splice(0)) {
      if (waiter.test(transcript)) waiter.resolve(transcript);
      else waiters.push(waiter);
    }
  };
  const unsubscribe = client.open(chatId, (message) => {
    if (message.type === "snapshot") {
      transcript = { items: message.snapshot.items, pending: message.snapshot.pending, turnId: null, chat: message.snapshot.chat };
    } else {
      events.push(message.event);
      transcript = reduce(transcript, message.event);
    }
    check();
  });
  return {
    events,
    get transcript() {
      return transcript;
    },
    // The fake echoes the full reference policy word by word. Windows timers
    // can take longer than tickMs, so allow that stream to actually complete.
    until(test: (t: Transcript) => boolean, ms = 10000): Promise<Transcript> {
      return new Promise((resolve, reject) => {
        if (test(transcript)) return resolve(transcript);
        waiters.push({ test, resolve });
        setTimeout(() => reject(new Error(`timed out; items=${JSON.stringify(transcript.items)}`)), ms);
      });
    },
    unsubscribe,
  };
}

const idle = (t: Transcript) => t.chat?.status === "idle" && t.items.some((item) => item.kind === "assistant");

describe("agent chat end to end", () => {
  it('passes an open-ended request to the selected model without a lexical gate',async()=>{
    const client=await connect(),before=fake.sessions.length;
    const text='podes armarme un motion sobre esto?\nhttps://portal.nousresearch.com/bench';
    const {chatId}=await client.request('turn.send',{...PROJECT,text,model:{...MODEL,effort:'high'}});
    const view=follow(client,chatId),completed=await view.until(idle);
    expect(completed.pending).toBeNull();
    expect(fake.sessions).toHaveLength(before+1);
    expect(fake.sessions.at(-1)!.opened.instructions).toContain('syka_ask_user');
    const opened = fake.sessions.at(-1)!.opened;
    const endpoint = new URL(opened.mcp!.url);
    expect(endpoint.searchParams.get('projectId')).toBe(PROJECT.projectId);
    expect(endpoint.searchParams.get('projectDir')).toBe(PROJECT.cwd);
    expect(opened.env.env.SYKA_PROJECT_MCP_URL).toBe(opened.mcp!.url);
    expect(opened.instructions).toContain('Never ask the user to reopen or switch projects');
    expect(fake.sessions.at(-1)!.sends).toContainEqual({model:MODEL.model,effort:'high',fast:false});
    view.unsubscribe();
  }, 15000);
  it('waits for a question chosen by the model and carries its answer through the shared host',async()=>{
    const client=await connect(),before=fake.sessions.length;
    const {chatId}=await client.request('turn.send',{...PROJECT,text:'ask workspace about the reference format',model:{...MODEL,effort:'high'}});
    const view=follow(client,chatId),waiting=await view.until(t=>t.pending!==null);
    expect(fake.sessions).toHaveLength(before+1);
    expect(waiting.pending!.questions[0].question).toBe('Which format should the video be?');
    await expect(client.request('request.respond',{chatId,requestId:waiting.pending!.id,response:{answers:{}}})).rejects.toThrow(/Respondé/);
    await client.request('request.respond',{chatId,requestId:waiting.pending!.id,response:{answers:{'Which format?':['Horizontal, con mis referencias.']}}});
    const completed=await view.until(idle);
    expect(completed.items.some(item=>item.kind==='assistant'&&item.text.includes('Horizontal, con mis referencias.'))).toBe(true);
    expect(completed.items.some(item=>item.kind==='question'&&item.answers?.['Which format?']?.includes('Horizontal, con mis referencias.'))).toBe(true);
    view.unsubscribe();
  });
  it('cancels a model-selected question without hanging Stop',async()=>{
    const client=await connect(),before=fake.sessions.length;
    const {chatId}=await client.request('turn.send',{...PROJECT,text:'ask workspace about audio',model:MODEL});
    const view=follow(client,chatId);await view.until(t=>t.pending!==null);
    await client.request('turn.interrupt',{chatId});
    await view.until(t=>t.pending===null&&t.chat?.status==='idle');
    expect(fake.sessions).toHaveLength(before+1);view.unsubscribe();
  });
  it('retains a detached question across client reconnect and a full host restart, then resumes with the answer', async()=>{
    const client=await connect();
    const {chatId}=await client.request('turn.send',{...PROJECT,text:'ask detached recommended about subtitles',model:{...MODEL,effort:'high'}});
    const view=follow(client,chatId);
    const waiting=await view.until(t=>t.pending!==null&&t.chat?.status==='waiting'&&t.items.some(i=>i.kind==='assistant'&&i.text==='The question is waiting for your answer.'));
    const request=waiting.pending!;
    expect(request.questions[0]).toMatchObject({context:expect.stringContaining('two comparison columns'),recommendation:{label:'16:9',reason:expect.stringContaining('legible')}});
    view.unsubscribe();client.close();
    const late=await connect();
    expect((await late.request('chats.open',{chatId})).pending?.id).toBe(request.id);
    late.close();
    await host.stop();
    host=await createAgentHost({token:'secret-token',dataDir:dir,mcp:{name:'syka',url:'http://127.0.0.1:3275/mcp?client=chat'},version:'0.0.0-test',harnesses:[fake],allowedOrigins:['null'],log:()=>{}});
    const reopened=await connect(),snapshot=await reopened.request('chats.open',{chatId});
    expect(snapshot.pending).toEqual(request);
    expect(snapshot.chat.status).toBe('waiting');
    await expect(reopened.request('turn.send',{chatId,...PROJECT,text:'new unrelated request',model:MODEL})).rejects.toThrow(/pregunta pendiente/);
    const resumed=follow(reopened,chatId);
    await reopened.request('request.respond',{chatId,requestId:request.id,response:{answers:{'Which format?':['9:16, subtítulos y ritmo']}}});
    const completed=await resumed.until(idle);
    expect(completed.pending).toBeNull();
    expect(completed.items.some(i=>i.kind==='question'&&i.answers?.['Which format?']?.includes('9:16, subtítulos y ritmo'))).toBe(true);
    expect(completed.items.some(i=>i.kind==='assistant'&&i.text.includes('9:16, subtítulos y ritmo'))).toBe(true);
    expect(fake.sessions.at(-1)!.sends.at(-1)?.effort).toBe('high');
    expect(fake.sessions.at(-1)!.inputs.at(-1)).toContain('Keeps the two columns legible side by side.');
    resumed.unsubscribe();
  });
  it('cancels a detached card explicitly and does not restore it on restart', async()=>{
    const client=await connect();
    const {chatId}=await client.request('turn.send',{...PROJECT,text:'ask detached about audio',model:MODEL});
    const view=follow(client,chatId);
    await view.until(t=>t.pending!==null&&t.items.some(i=>i.kind==='assistant'&&i.text==='The question is waiting for your answer.'));
    await client.request('turn.interrupt',{chatId});
    await view.until(t=>t.pending===null&&t.chat?.status==='idle');
    expect((await client.request('chats.open',{chatId})).pending).toBeNull();
    view.unsubscribe();
    client.close();
    await host.stop();
    host=await createAgentHost({token:'secret-token',dataDir:dir,mcp:{name:'syka',url:'http://127.0.0.1:3275/mcp?client=chat'},version:'0.0.0-test',harnesses:[fake],allowedOrigins:['null'],log:()=>{}});
    const reopened=await connect();
    expect((await reopened.request('chats.open',{chatId})).pending).toBeNull();
  });
  it('preserves an active unanswered request during graceful app shutdown', async()=>{
    const client=await connect();
    const {chatId}=await client.request('turn.send',{...PROJECT,text:'ask about music',model:MODEL});
    const view=follow(client,chatId),waiting=await view.until(t=>t.pending!==null);
    const request=waiting.pending!;
    view.unsubscribe();client.close();
    await host.stop();
    host=await createAgentHost({token:'secret-token',dataDir:dir,mcp:{name:'syka',url:'http://127.0.0.1:3275/mcp?client=chat'},version:'0.0.0-test',harnesses:[fake],allowedOrigins:['null'],log:()=>{}});
    const reopened=await connect();
    expect((await reopened.request('chats.open',{chatId})).pending).toEqual(request);
    const resumed=follow(reopened,chatId);
    await reopened.request('request.respond',{chatId,requestId:request.id,response:{answers:{'Which format?':['Vertical con música suave']}}});
    const completed=await resumed.until(idle);
    expect(completed.pending).toBeNull();
    expect(completed.items.some(i=>i.kind==='assistant'&&i.text.includes('Vertical con música suave'))).toBe(true);
    resumed.unsubscribe();
  });
  it('forwards Fast through the real socket and retains independent reasoning effort',async()=>{
    const client=await connect();
    const sent=await client.request('turn.send',{...PROJECT,text:'Fast wire check',attachments:[],model:{...MODEL,effort:'high',fast:true}});
    const view=follow(client,sent.chatId);
    await view.until(idle);
    expect(fake.sessions.find(session=>session.sends.some(send=>send.model===MODEL.model&&send.fast===true))?.sends).toContainEqual({model:MODEL.model,effort:'high',fast:true});
    view.unsubscribe();
  });
  it('rejects a Fast request when the model catalog does not advertise it',async()=>{
    const client=await connect();
    await expect(client.request('turn.send',{...PROJECT,text:'Unsupported Fast',attachments:[],model:{...MODEL,model:'fake-smart',fast:true}})).rejects.toThrow(/modo rápido/);
  });
  it("rejects a bad token and a bad origin", async () => {
    const bad = host.url.replace("secret-token", "nope");
    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(bad);
        socket.on("open", () => resolve("opened"));
        socket.on("error", (error) => reject(error));
      }),
    ).rejects.toThrow(/401/);
    await expect(
      new Promise((resolve, reject) => {
        const socket = new WebSocket(host.url, { origin: "http://evil.example" });
        socket.on("open", () => resolve("opened"));
        socket.on("error", (error) => reject(error));
      }),
    ).rejects.toThrow(/403/);
  });

  it("pushes the harness list on connect", async () => {
    const client = await connect();
    // The first push may still say "checking": the probe is pushed when it lands.
    const harnesses = await new Promise<typeof client.harnesses>((resolve) => {
      const settled = (list: typeof client.harnesses) => list.length > 0 && list.every((entry) => entry.status !== "checking");
      if (settled(client.harnesses)) return resolve(client.harnesses);
      client.onHarnesses((list) => settled(list) && resolve(list));
    });
    expect(harnesses).toHaveLength(1);
    expect(harnesses[0]!.status).toBe("ready");
    expect(await client.request("harnesses.list", {})).toEqual(harnesses);
  });

  it("creates a chat lazily on the first send and streams the reply", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "hello there", model: MODEL });
    const chat = follow(client, chatId);
    const done = await chat.until(idle);

    const kinds = done.items.map((item) => item.kind);
    expect(kinds).toEqual(["user", "reasoning", "tool", "assistant"]);
    expect((done.items[3] as Extract<Item, { kind: "assistant" }>).text).toBe("(fake-fast) hello there");
    expect(done.chat?.title).toBe("hello there");
    expect(chat.events.some((event) => event.type === "item.delta")).toBe(true);
    expect(chat.events.at(-2)?.type).toBe("turn.completed");

    const list = await client.request("chats.list", { projectId: PROJECT.projectId });
    expect(list.map((entry) => entry.id)).toContain(chatId);
    expect(fake.sessions.at(-1)!.opened.instructions).toContain("/tmp/proj");
    expect(fake.sessions.at(-1)!.opened.mcp?.url).toContain("client=chat");
  });

  it("keeps attachments apart from the text and appends them for the harness", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "look", attachments: ["/a/b.mp4"], model: MODEL });
    const chat = follow(client, chatId);
    const done = await chat.until(idle);
    expect(done.items[0]).toMatchObject({ kind: "user", text: "look", attachments: ["/a/b.mp4"] });
    expect((done.items.at(-1) as Extract<Item, { kind: "assistant" }>).text).toContain("Attached files and folders:\n/a/b.mp4");
  }, 15000);

  it("rejects a second turn while one runs, and another harness on the same chat", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "slow", model: MODEL });
    await expect(client.request("turn.send", { ...PROJECT, chatId, text: "again", model: MODEL })).rejects.toMatchObject({ code: "busy" });
    await client.request("turn.interrupt", { chatId });
    await expect(client.request("turn.send", { ...PROJECT, chatId, text: "x", model: { harness: "claude", model: "m" } })).rejects.toMatchObject({
      code: "harness-mismatch",
    });
  });

  it("interrupts a running turn and records what was streamed", async () => {
    const previous = fake.options.holdAfterFirstDelta;
    fake.options.holdAfterFirstDelta = true;
    let client: AgentChatClient | undefined, chatId: string | undefined;
    try {
      client = await connect();
      chatId = (await client.request("chats.create", { ...PROJECT, model: MODEL })).id;
      const chat = follow(client, chatId);
      await chat.until((t) => t.chat?.id === chatId);
      await client.request("turn.send", { ...PROJECT, chatId, text: "slow please", model: MODEL });
      // The fake pauses after this actual delta. A busy socket/event loop
      // cannot let the reply finish before the interrupt reaches the host.
      const streaming = await chat.until((t) => t.items.some((item) => item.kind === "assistant" && item.text.length > 0));
      const streamed = (streaming.items.find((item) => item.kind === "assistant") as Extract<Item, { kind: "assistant" }>).text;
      await client.request("turn.interrupt", { chatId });
      const done = await chat.until((t) => t.chat?.status === "idle" && t.turnId === null);
      const completed = chat.events.filter((event) => event.type === "turn.completed");
      expect(completed).toHaveLength(1);
      expect(completed[0]).toMatchObject({ status: "interrupted" });
      expect(done.items.find((item) => item.kind === "assistant")).toMatchObject({ text: streamed });

      // What the host kept is what a fresh client sees, including partial text.
      const other = await connect();
      const snapshot = await other.request("chats.open", { chatId });
      expect(snapshot.items.map((item) => item.kind)).toEqual(done.items.map((item) => item.kind));
      expect(snapshot.items.find((item) => item.kind === "assistant")).toMatchObject({ text: streamed });
      expect(snapshot.chat.status).toBe("idle");
    } finally {
      if (client && chatId) await client.request("turn.interrupt", { chatId }).catch(() => {});
      fake.options.holdAfterFirstDelta = previous;
    }
  });

  it("refuses moving an existing chat to a different project or folder", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "keep project", model: MODEL });
    await follow(client, chatId).until(idle);
    await expect(client.request("turn.send", { ...PROJECT, cwd: "/tmp/different", chatId, text: "edit", model: MODEL })).rejects.toMatchObject({ code: "bad-request" });
    await expect(client.request("turn.send", { ...PROJECT, projectId: "different", chatId, text: "edit", model: MODEL })).rejects.toMatchObject({ code: "bad-request" });
  });

  it.runIf(process.platform === 'win32')('continues an existing chat after the editor changes Windows path separators, preserving the correction and attachments', async () => {
    const client = await connect();
    const original = { projectId: 'windows-path-project', cwd: 'F:\\Motions\\calm-forest-8-oct' };
    const { chatId } = await client.request('turn.send', { ...original, text: 'keep existing conversation', model: MODEL });
    await follow(client, chatId).until(idle);
    await client.request('turn.send', { ...original, cwd: 'F:/Motions/calm-forest-8-oct/', chatId,
      text: 'HACÉ: hacelo negro con sombras', attachments: ['F:/Motions/calm-forest-8-oct/capture.png'], model: MODEL });
    const done = await follow(client, chatId).until(idle);
    const users = done.items.filter(item => item.kind === 'user');
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ text: 'keep existing conversation' });
    expect(users[1]).toMatchObject({ text: 'HACÉ: hacelo negro con sombras', attachments: ['F:/Motions/calm-forest-8-oct/capture.png'] });
    await expect(client.request('turn.send', { ...original, cwd: 'F:/Motions/another-project', chatId, text: 'edit', model: MODEL })).rejects.toMatchObject({ code: 'bad-request' });
  }, 15000);

  it("shows a question, marks the chat waiting, and continues with the answer", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "ask me", model: MODEL });
    const chat = follow(client, chatId);
    const waiting = await chat.until((t) => t.pending !== null);
    expect(waiting.chat?.status).toBe("waiting");
    const request = waiting.pending!;
    expect(request.questions[0]!.header).toBe("Format");

    // A late client gets the pending request in its snapshot.
    const late = await connect();
    const snapshot: ChatSnapshot = await late.request("chats.open", { chatId });
    expect(snapshot.pending?.id).toBe(request.id);
    expect(snapshot.chat.status).toBe("waiting");

    await late.request("request.respond", { chatId, requestId: request.id, response: { answers: { [request.questions[0]!.id]: ["9:16"] } } });
    const done = await chat.until(idle);
    const question = done.items.find((item) => item.kind === "question");
    expect(question).toMatchObject({ kind: "question", answers: { "Which format?": ["9:16"] } });
    expect((done.items.at(-1) as Extract<Item, { kind: "assistant" }>).text).toBe("You chose 9:16.");
    await expect(late.request("request.respond", { chatId, requestId: request.id, response: "skip" })).rejects.toMatchObject({ code: "no-request" });
  });

  it("skips a question and cancels one on stop", async () => {
    const client = await connect();
    const first = await client.request("turn.send", { ...PROJECT, text: "ask", model: MODEL });
    const chat = follow(client, first.chatId);
    let waiting = await chat.until((t) => t.pending !== null);
    await client.request("request.respond", { chatId: first.chatId, requestId: waiting.pending!.id, response: "skip" });
    let done = await chat.until(idle);
    expect(done.items.find((item) => item.kind === "question")).toMatchObject({ answers: null });
    expect((done.items.at(-1) as Extract<Item, { kind: "assistant" }>).text).toBe("You chose no answer.");

    await client.request("turn.send", { ...PROJECT, chatId: first.chatId, text: "ask again", model: MODEL });
    waiting = await chat.until((t) => t.pending !== null);
    await client.request("turn.interrupt", { chatId: first.chatId });
    done = await chat.until((t) => t.chat?.status === "idle" && t.turnId === null);
    expect(done.pending).toBeNull();
    expect(chat.events.filter((event) => event.type === "request.resolved").at(-1)).toMatchObject({ outcome: "cancel" });
    expect(done.items.filter((item) => item.kind === "question")).toHaveLength(1);
  });

  it("surfaces a failed turn as a notice and a failed status", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "fail now", model: MODEL });
    const chat = follow(client, chatId);
    const done = await chat.until((t) => t.chat?.status === "idle" && t.turnId === null);
    expect(done.items.at(-1)).toMatchObject({ kind: "notice", level: "error", text: expect.stringContaining("told to fail") });
    // The turn fails at once, so it may already be inside the snapshot; the log is the record.
    const other = await connect();
    const snapshot = await other.request("chats.open", { chatId });
    expect(snapshot.items.at(-1)).toMatchObject({ kind: "notice", level: "error" });
    expect(snapshot.chat.status).toBe("idle");
  });

  it("reconnects after the socket drops and re-opens the chat", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "reconnect", model: MODEL });
    const chat = follow(client, chatId);
    await chat.until(idle);
    const snapshots: number[] = [];
    client.open(chatId, (message) => {
      if (message.type === "snapshot") snapshots.push(message.snapshot.seq);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Drop the socket from under the client: it must come back on its own.
    (client as unknown as { socket: WebSocket }).socket.close();
    await new Promise<void>((resolve) => {
      const stop = client.onState((state) => {
        if (state === "open") {
          stop();
          resolve();
        }
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(client.state).toBe("open");
  });

  it("deletes a chat and drops it from the list", async () => {
    const client = await connect();
    const { chatId } = await client.request("turn.send", { ...PROJECT, text: "bye", model: MODEL });
    await follow(client, chatId).until(idle);
    await client.request("chats.delete", { chatId });
    const list = await client.request("chats.list", { projectId: PROJECT.projectId });
    expect(list.map((entry) => entry.id)).not.toContain(chatId);
    await expect(client.request("chats.open", { chatId })).rejects.toMatchObject({ code: "not-found" });
  });

  it("deletes every chat of a project and leaves the other projects' alone", async () => {
    const client = await connect();
    const other = { projectId: "other", cwd: "/tmp/other" };
    const { chatId: kept } = await client.request("turn.send", { ...other, text: "stay", model: MODEL });
    await follow(client, kept).until(idle);
    const { chatId: gone } = await client.request("turn.send", { ...PROJECT, text: "go", model: MODEL });
    await follow(client, gone).until(idle);

    await host.deleteChats(PROJECT.projectId);

    expect(await client.request("chats.list", { projectId: PROJECT.projectId })).toEqual([]);
    expect((await client.request("chats.list", { projectId: other.projectId })).map((entry) => entry.id)).toEqual([kept]);
    expect(existsSync(join(dir, "chats", gone))).toBe(false);
    expect(existsSync(join(dir, "chats", kept))).toBe(true);
  });

  it("refuses a harness that is not ready", async () => {
    const client = await connect();
    fake.probeStatus = "not-installed";
    try {
      await client.request("harnesses.list", { refresh: true });
      // The cache is fresh, so refresh is a no-op until it ages out; force the point.
      const before = await client.request("chats.list", { projectId: "p2" });
      expect(before).toEqual([]);
    } finally {
      fake.probeStatus = "ready";
    }
  });
});

it('persists empty sessions without starting a model turn',async()=>{
 const client=await connect();const chat=await client.request('chats.create',{...PROJECT,model:MODEL,title:'Continuación'});
 expect(chat.status).toBe('idle');expect(chat.title).toBe('Continuación');
 const snapshot=await client.request('chats.open',{chatId:chat.id});expect(snapshot.items).toEqual([]);
 expect((await client.request('chats.list',{projectId:PROJECT.projectId})).some(c=>c.id===chat.id)).toBe(true);
 await client.request('chats.delete',{chatId:chat.id});
});
