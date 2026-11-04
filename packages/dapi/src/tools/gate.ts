/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { z } from "zod";
import { defineTool } from "../tool";
import { SceneId } from "../schemas";

export const GateIssueCode = z.enum([
  "empty-frames",
  "frozen",
  "text-cut",
  "text-covered",
  "text-overlap",
  "small-subject",
  "line-missing",
  "line-unsafe",
]);

export const GateLine = z.object({
  id: z.string().describe("the plan's scene id"),
  text: z.string(),
  start: z.number().describe("seconds relative to the scene's export start"),
  end: z.number(),
  layer: z.string().optional().describe("source stamp of the text layer the plan says shows it"),
  margins: z.object({ top: z.number(), bottom: z.number(), left: z.number(), right: z.number() }).optional()
    .describe("share of the frame each side keeps clear, from the recipe's safe zone; 5% each when unset"),
});

export const GateIssue = z.object({
  code: GateIssueCode,
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  node: z.string().optional().describe("source stamp of the text concerned, when there is one"),
  other: z.string().optional().describe("source stamp of the element covering or overlapping it"),
  ranges: z.array(z.object({ start: z.number(), end: z.number() })),
});

export const gate = defineTool({
  name: "gate",
  title: "Film gate",
  description:
    "Watch a scene the way an export draws it, frame by frame (5 per second by default), and fail what a viewer would see as broken: frames that are almost empty, stretches where nothing changes, text that leaves the canvas, text covered by an element drawn over it, and two texts on top of each other; it warns when the product picture sits small in a mostly empty frame. With a video plan, every scene line must show whole inside the 5% safe margin during its scene. Local, no credits. Run it on the finished scene before replying and fix every error, then run it again; ranges are seconds relative to the scene's export start, the clock capture uses. Warnings are judged: say why one is intended. The final hold may stand still for finalHold seconds. Text inside a clip or mask that hides it on purpose can show as cut or covered: confirm with capture.",
  input: z.object({
    id: SceneId,
    fps: z.number().min(2).max(10).optional().describe("frames examined per second (default 5)"),
    finalHold: z.number().min(0).max(6).optional().describe("seconds the last frame may hold still (default 3)"),
    lines: z.array(GateLine).max(64).optional().describe("filled in by Syka from the video plan (00 Plan/plan.json); leave it out"),
    stillMax: z.number().min(1).max(30).optional().describe("seconds the whole frame may stand still mid-film, from the plan's recipe (default 1.6); leave it out"),
  }),
  output: z.object({
    passed: z.boolean().describe("true when no error was found"),
    duration: z.number(),
    framesChecked: z.int(),
    issues: z.array(GateIssue),
  }),
  environment: "renderer",
});
