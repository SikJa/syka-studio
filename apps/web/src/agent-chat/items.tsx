/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// One component per item kind. Small enough to live together: what they
// share is the 12 px body text and the muted 11 px chrome.

import { For, Show, createSignal } from "solid-js";

import { Icon } from "@/components/ui/icon";

import type { Item } from "@diffusionstudio/agent-chat";

import { SentAttachment } from "./sent-attachment";
import { ImageGenerationItem } from './image-generation-item';

import "./activity.css";
import {MirelMessage,MirelTrace,MirelUserText} from "./mirel-messages";

type Of<K extends Item["kind"]> = Extract<Item, { kind: K }>;

export function UserItem(props: { item: Of<"user"> }) {
  return (
    <div data-chat-message="user" class="syka-user-message flex flex-col items-end gap-1">
      <Show when={props.item.attachments?.length}>
        <div class="syka-sent-attachments">
          <For each={props.item.attachments}>{(path) => <SentAttachment path={path} />}</For>
        </div>
      </Show>
      <Show when={props.item.text.trim()}>
        <div class="syka-user-bubble whitespace-pre-wrap break-words text-[12px] leading-5 text-foreground">
          <MirelUserText text={props.item.text}/>
        </div>
      </Show>
    </div>
  );
}

export function AssistantItem(props: { item: Of<"assistant"> }) { return <MirelMessage item={props.item}/>; }

/** Only explicitly identified public provider summaries reach this component. */
export function ReasoningItem(props: { item: Of<"reasoning"> }) {
  const [open, setOpen] = createSignal(true);
  const expandable = () => props.item.text.trim().length > 0;
  return (
    <div class="pr-0.5">
      <button
        type="button"
        class="flex h-6 items-center text-[11px] text-muted-foreground focus-ring rounded-sm"
        classList={{ "hover:text-foreground": expandable(), "cursor-default": !expandable() }}
        aria-expanded={open()}
        onClick={() => expandable() && setOpen(!open())}
      >
        <Icon name={open() ? "chevron-down" : "chevron-right"} class="size-6" />
        <span>Resumen del razonamiento</span>
      </button>
      <Show when={open()}>
        <div class="mt-0.5 whitespace-pre-wrap break-words border-l border-border pl-2 text-[11px] leading-4 text-muted-foreground">
          {props.item.text}
        </div>
      </Show>
    </div>
  );
}

export function WebSearchItem(props: { item: Of<'tool'> }) {
  const url = () => /^https?:\/\/\S+$/i.test(props.item.detail ?? '') ? props.item.detail : undefined;
  return <section class="syka-web-search" aria-label={props.item.title}>
    <div><Icon name="search" class="size-3.5"/><span>{props.item.title}</span><small>{props.item.status === 'running' ? 'En curso' : props.item.status === 'failed' ? 'Falló' : ''}</small></div>
    <Show when={props.item.detail}>
      <Show when={url()} fallback={<p>{props.item.detail}</p>}>
        <a href={url()} target="_blank" rel="noopener noreferrer">{props.item.detail}</a>
      </Show>
    </Show>
  </section>;
}

export function ToolItem(props: { item: Of<"tool"> }) {
  const [open, setOpen] = createSignal(false);
  const expandable = () => !!(props.item.detail || props.item.output || props.item.images?.length);
  return (
    <div class="pr-0.5">
      <MirelTrace item={props.item}/>
      <Show when={expandable()}>
        <button type="button" class="flex h-6 items-center rounded-sm text-[11px] text-muted-foreground hover:text-foreground focus-ring" aria-expanded={open()} onClick={() => setOpen(!open())}>
          <Icon name={open() ? "chevron-down" : "chevron-right"} class="size-5"/>
          Ver resultado de {props.item.title}
        </button>
      </Show>      <Show when={open()}>
        <div class="mt-0.5 flex flex-col gap-1 border-l border-border pl-2">
          <Show when={props.item.detail}>
            <pre class="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">{props.item.detail}</pre>
          </Show>
          <Show when={props.item.output}>
            <pre class="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-input p-1.5 text-[11px] leading-4 text-foreground">
              {props.item.output}
            </pre>
          </Show>
          <For each={props.item.images}>
            {(image) => (
              <img
                src={`data:${image.mediaType};base64,${image.data}`}
                alt={`${props.item.title} result`}
                class="max-h-60 max-w-full self-start rounded-md border border-border object-contain"
                loading="lazy"
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/** The compact record of what was asked and answered: "Format → 9:16", or "Skipped". */
export function QuestionItem(props: { item: Of<"question"> }) {
  return (
    <div class="flex flex-col gap-0.5 px-0.5 text-[11px] text-muted-foreground">
      <For each={props.item.questions}>
        {(question) => (
          <div class="flex min-w-0 items-center gap-1">
            <span class="shrink-0 rounded bg-input px-1 py-px text-[10px] font-450">{question.header || "Question"}</span>
            <span class="shrink-0">→</span>
            <span class="min-w-0 whitespace-normal break-words text-foreground" title={question.question}>
              {props.item.answers === null ? "Skipped" : props.item.answers[question.id]?.join(", ") || "Skipped"}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

export function NoticeItem(props: { item: Of<"notice"> }) {
  return (
    <div
      class="px-0.5 text-[11px] leading-4 break-words"
      classList={{ "text-muted-foreground": props.item.level === "info", "text-destructive": props.item.level === "error" }}
    >
      {props.item.text}
    </div>
  );
}

/** Dispatches on kind. */
export function ChatItem(props: { item: Item }) {
  const item = () => props.item;
  return (
    <>
      <Show when={item().kind === "user"}>
        <UserItem item={item() as Of<"user">} />
      </Show>
      <Show when={item().kind === "assistant"}>
        <Show when={(item() as Of<'assistant'>).phase === 'commentary'} fallback={<AssistantItem item={item() as Of<'assistant'>}/>}>
          <p class="syka-public-progress">{(item() as Of<'assistant'>).text}</p>
        </Show>
      </Show>
      {/* Thinking the model keeps to itself arrives as an empty block: nothing to show. */}
      <Show when={item().kind === "reasoning" && (item() as Of<"reasoning">).summary && (item() as Of<"reasoning">).text.trim()}>
        <ReasoningItem item={item() as Of<"reasoning">} />
      </Show>
      <Show when={item().kind === "tool"}>
        <Show when={(item() as Of<'tool'>).name === 'imageGeneration'} fallback={<Show when={(item() as Of<'tool'>).name === 'webSearch'} fallback={<ToolItem item={item() as Of<'tool'>}/>}><WebSearchItem item={item() as Of<'tool'>}/></Show>}><ImageGenerationItem item={item() as Of<'tool'>}/></Show>
      </Show>
      <Show when={item().kind === "question"}>
        <QuestionItem item={item() as Of<"question">} />
      </Show>
      <Show when={item().kind === "notice"}>
        <NoticeItem item={item() as Of<"notice">} />
      </Show>
    </>
  );
}
