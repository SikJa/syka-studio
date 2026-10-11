/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A harness that needs no binary: for the tests and for developing the UI
// without spending tokens. It is never offered to users. What it does is
// driven by the prompt:
//   "ask …"    opens a question and echoes the answer
//   "fail …"   ends the turn in failure
//   "slow …"   streams for a while (interruptible)
//   anything   echoes the prompt back as a reply, with a tool call in between

import { QuestionBox, newItemId } from "./harness";

import type { HarnessInfo, RequestResponse } from "../protocol";
import type { Emit, Harness, HarnessSession, OpenOptions, ResumeCursor, TurnOutcome } from "./harness";

export type FakeOptions = {
  /** Milliseconds between deltas. */
  tickMs?: number;
  /** Words a "slow" reply streams. */
  slowWords?: number;
  /** Test barrier: keep the first assistant delta in flight until interruption. */
  holdAfterFirstDelta?: boolean;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const waitForInterrupt = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

class FakeSession implements HarnessSession {
  readonly resume: ResumeCursor;
  private readonly options: FakeOptions;
  private readonly cwd: string;
  private abort: AbortController | null = null;
  private questions: QuestionBox | null = null;
  private turn: Promise<TurnOutcome> | null = null;
  readonly opened: OpenOptions;
  readonly sends: {model:string;effort?:string;fast?:boolean}[] = [];
  readonly inputs: string[] = [];

  constructor(options: OpenOptions, fake: FakeOptions) {
    this.options = fake;
    this.cwd = options.cwd;
    this.opened = options;
    this.resume = options.resume ?? { codex: { threadId: `fake-${newItemId("s")}` } };
  }

  send(text: string, model: string, emit: Emit, effort?:string, fast?:boolean): Promise<TurnOutcome> {
    this.inputs.push(text);
    this.sends.push({model,effort,fast});
    const abort = new AbortController();
    this.abort = abort;
    this.questions = new QuestionBox(emit);
    const run = this.run(text, model, emit, abort.signal).finally(() => {
      this.abort = null;
      if (!this.questions?.size) this.questions = null;
    });
    this.turn = run;
    return run;
  }

  private async run(text: string, model: string, emit: Emit, signal: AbortSignal): Promise<TurnOutcome> {
    const tick = this.options.tickMs ?? 5;
    const lower = text.toLowerCase();

    if (lower.startsWith("fail")) throw new Error("The fake harness was told to fail");

    if (lower.startsWith("ask")) {
      const ask = lower.startsWith('ask workspace') ? this.opened.askUser! : this.questions!.ask.bind(this.questions);
      const requested = ask(
        [
          {
            id: "Which format?",
            header: "Format",
            question: "Which format should the video be?",
            ...(lower.includes('recommended') ? {context:'Fixture: a wide layout with two comparison columns.',recommendation:{label:'16:9',reason:'Keeps the two columns legible side by side.'}} : {}),
            options: [
              { label: "16:9", description: "Landscape" },
              { label: "9:16", description: "Vertical" },
            ],
            multiSelect: false,
            allowOther: true,
            secret: false,
          },
        ],
        signal,
      );
      if (lower.startsWith('ask detached')) {
        emit({type: 'item.completed', item: {id: newItemId('a'), kind: 'assistant', text: 'The question is waiting for your answer.'}});
        return {status: 'completed'};
      }
      const response: RequestResponse = await requested;
      if (response === "cancel") return { status: "interrupted" };
      const answer = response === "skip" ? "no answer" : Object.values(response.answers).flat().join(", ");
      const id = newItemId("a");
      emit({ type: "item.started", item: { id, kind: "assistant", text: "" } });
      emit({ type: "item.delta", itemId: id, text: `You chose ${answer}.` });
      emit({ type: "item.completed", item: { id, kind: "assistant", text: `You chose ${answer}.` } });
      return { status: "completed" };
    }

    const reasoning = newItemId("r");
    emit({ type: "item.started", item: { id: reasoning, kind: "reasoning", text: "" } });
    emit({ type: "item.delta", itemId: reasoning, text: "Thinking about it" });
    emit({ type: "item.completed", item: { id: reasoning, kind: "reasoning", text: "Thinking about it" } });

    const tool = newItemId("t");
    emit({ type: "item.started", item: { id: tool, kind: "tool", name: "Read", title: "Read", detail: `${this.cwd}/package.json`, status: "running" } });
    await sleep(tick, signal);
    if (signal.aborted) return { status: "interrupted" };
    emit({ type: "item.completed", item: { id: tool, kind: "tool", name: "Read", title: "Read", detail: `${this.cwd}/package.json`, status: "done" } });

    const words = lower.startsWith("slow")
      ? Array.from({ length: this.options.slowWords ?? 200 }, (_, i) => `word${i}`)
      : `(${model}) ${text}`.split(" ");
    const id = newItemId("a");
    let acc = "";
    emit({ type: "item.started", item: { id, kind: "assistant", text: "" } });
    for (const [index, word] of words.entries()) {
      if (signal.aborted) return { status: "interrupted" };
      const piece = (index ? " " : "") + word;
      acc += piece;
      emit({ type: "item.delta", itemId: id, text: piece });
      if (index === 0 && this.options.holdAfterFirstDelta) {
        await waitForInterrupt(signal);
        if (signal.aborted) return { status: "interrupted" };
      }
      await sleep(tick, signal);
    }
    if (signal.aborted) return { status: "interrupted" };
    emit({ type: "item.completed", item: { id, kind: "assistant", text: acc } });
    return { status: "completed" };
  }

  respond(requestId: string, response: RequestResponse): void {
    this.questions?.settle(requestId, response);
  }

  async interrupt(): Promise<void> {
    this.questions?.cancelAll();
    this.abort?.abort();
    await this.turn?.catch(() => {});
  }

  async close(): Promise<void> {
    await this.interrupt();
  }
}

export class FakeHarness implements Harness {
  readonly id = "codex" as const;
  readonly options: FakeOptions;
  readonly sessions: FakeSession[] = [];
  probeStatus: HarnessInfo["status"] = "ready";

  constructor(options: FakeOptions = {}) {
    this.options = options;
  }

  async probe(): Promise<HarnessInfo> {
    return {
      id: this.id,
      label: "Fake",
      status: this.probeStatus,
      version: "0.0.0",
      models: [
        { id: "fake-fast", label: "Fake Fast",supportsFast:true },
        { id: "fake-smart", label: "Fake Smart" },
      ],
      defaultModel: "fake-fast",
    };
  }

  async open(options: OpenOptions): Promise<HarnessSession> {
    const session = new FakeSession(options, this.options);
    this.sessions.push(session);
    return session;
  }
}
