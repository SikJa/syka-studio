/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";

import { DETAIL_MAX, IMAGES_MAX, IMAGE_MAX, collectResult, QuestionBox } from "../src/host/harness";
import type { ChatEvent as Event } from '../src/protocol';

const png = (data = "iVBORw0KGgo=") => ({ type: "image", source: { type: "base64", media_type: "image/png", data } });

describe('question lifecycle', () => {
  it('retains choice values and clean visible answers while giving the provider photo paths', async () => {
    const events: Event[] = [], box = new QuestionBox(event => events.push(event));
    const result = box.ask([{ id: 'style', header: 'Style', question: '¿Qué estilo?', options: [], multiSelect: false, allowOther: true, secret: false }]);
    const opened = events[0]!; if (opened.type !== 'request.opened') throw Error('missing request');
    box.settle(opened.request.id, { answers: { style: ['Premium'] }, attachments: ['/project/foto.png'] });
    const response = await result;
    expect(typeof response).toBe('object');
    if (typeof response !== 'object') throw Error('missing response');
    expect(response.answers.style?.[0]).toBe('Premium');
    expect(response.answers.style?.[1]).toContain('/project/foto.png');
    expect(events.find(e => e.type === 'item.completed')).toMatchObject({ item: { answers: { style: ['Premium'] } } });
  });
  it('does not open a question for an already canceled turn', async () => {
    const events: Event[] = [], box = new QuestionBox(event => events.push(event)), signal = AbortSignal.abort();
    expect(await box.ask([], signal)).toBe('cancel');
    expect(events).toEqual([]); expect(box.size).toBe(0);
  });
  it('handles cancellation during delivery and never settles twice', async () => {
    const controller = new AbortController(), events: Event[] = [];
    const box = new QuestionBox(event => { events.push(event); if (event.type === 'request.opened') controller.abort(); });
    expect(await box.ask([], controller.signal)).toBe('cancel');
    expect(box.size).toBe(0);
    expect(events.map(event => event.type)).toEqual(['request.opened', 'request.resolved']);
    expect(box.settle('absent', 'skip')).toBe(false);
  });
  it('skip is delegation, while a later abort cannot erase the recorded answer', async () => {
    const controller = new AbortController(), events: Event[] = [], box = new QuestionBox(event => events.push(event));
    const answer = box.ask([], controller.signal);
    const opened = events[0]!; if (opened.type !== 'request.opened') throw Error('missing request');
    expect(box.settle(opened.request.id, 'skip')).toBe(true);
    expect(await answer).toBe('skip'); controller.abort();
    expect(events.map(event => event.type)).toEqual(['request.opened', 'request.resolved', 'item.completed']);
    expect(box.size).toBe(0);
  });
});

describe("collectResult", () => {
  it("joins text parts and keeps images that fit", () => {
    const result = collectResult([{ type: "text", text: "read it" }, png()]);
    expect(result).toEqual({ output: "read it", images: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }] });
  });

  it("returns only images when there is no text", () => {
    expect(collectResult([png()])).toEqual({ images: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }] });
  });

  it("leaves a marker for an image over the cap, and for other part kinds", () => {
    const result = collectResult([png("x".repeat(IMAGE_MAX + 1)), { type: "document", source: "not-an-image" }]);
    expect(result).toEqual({ output: "[image]\n[document]" });
  });

  it("keeps at most IMAGES_MAX images", () => {
    const parts = Array.from({ length: IMAGES_MAX + 2 }, () => png());
    const result = collectResult(parts);
    expect(result.images).toHaveLength(IMAGES_MAX);
    expect(result.output).toBe("[image]\n[image]");
  });

  it("truncates long text like any other output", () => {
    const result = collectResult([{ type: "text", text: "y".repeat(DETAIL_MAX + 10) }]);
    expect(result.output).toHaveLength(DETAIL_MAX + 1);
    expect(result.output?.endsWith("…")).toBe(true);
  });

  it("drops empty output", () => {
    expect(collectResult([])).toEqual({});
    expect(collectResult([{ type: "text", text: "  " }])).toEqual({});
  });
});
