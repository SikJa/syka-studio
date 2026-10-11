# Errors

Where each [pipeline](./README.md#pipeline) stage fails, and with what effect:

| Stage | Where it surfaces | Effect |
| ----- | ----------------- | ------ |
| **Compile** (syntax, an unresolved import, a PascalCase composition tag, a control-flow component with no import) | A "Project failed to compile" toast, with the compiler's message; also on the app console ([`logs`](../tools/logs.md)) | Nothing is remounted. The canvas keeps the last good render, so a project in the middle of an edit is never blanked. |
| **Evaluate / mount** (a throw at module scope or during render, a root that is not `<stage>`, a tag the host does not know, an element parented into its own subtree) | A "Project failed to render" toast with the thrown message | The half-built document is disposed — **nothing is left behind** — and the previous render stays on the canvas. |
| **Source resolution** (a path that does not exist, an unreachable URL, a per-model constraint on `aspectRatio` / `duration` / a feature flag, a caption with no audible audio in its scene) | The element on the canvas, and `generations` in [`context`](../tools/context.md) | Per element, not per mount: everything else stays mounted and playable. The element stops showing its generating state and is left without a paint, carrying the reason — see below. |

Runtime errors are reported against the compiled module. Since types are stripped rather than checked, run `npx tsc --noEmit` in the project folder to catch what the compile will not.

## Failed sources

A failed **generation** is recorded in the library, never in your file. The library holds a partial document for every generation the project has asked for: `pending` while the model runs, replaced by the asset when it lands, and kept as `error` — with the reason — when it does not. In `assets.yml`:

```yaml
- id: 3f9c1a7e2b8d4c05
  path: generated/a red fox
  type: IMAGE
  generation:
    key: '{"type":"image","model":"…","prompt":"a red fox",…}'
  state: error
  error: Model refused the prompt
```

That record is what keeps a refused or impossible generation from being run — or paid for — again by every reopen of the project: a declaration whose key stands in error resolves to that error, and its element carries the message without anything being requested. The source that declared it is not written to.

**Removing the record is what asks for the run again**, and it is the only thing that does — not another take, not another prompt. Delete the entry in the asset panel (or its record in `assets.yml`), or use *Retry* on it, which deletes the record and re-asks at once for every element still waiting on the answer. Changing the declaration is a new key, and so a new generation; the old record stays until removed.

Only generations are recorded this way: a load that failed is cheap to try again, and an asset that has since been put back should simply load.

## Blank or partial `<html>` content in captures

A composition that looks right in the viewport but captures black, frozen, or partially missing frames is almost always one of four things — check them in this order:

1. **A stateful animation seek.** anime.js records a tween's start values at the tween's *first* render, and captures/exports sample frames out of order — so a tween whose target was written to outside the timeline before its first render bakes that mutated state in as its starting values and replays it at every subsequent frame. Symptom: deterministic but *order-dependent* wrong frames — the same time renders when requested first and comes out wrong when requested after a later frame. See the caveat in [html.md](./html.md): give tweens explicit start values with `{ from, to }`, never write to or reset tween targets between seeks, and derive capture-critical values statelessly from `time()`.
2. **`scale()` on a large or clipped subtree.** The rasterizer renders these as empty (see [html.md limitations](./html.md#requirements-and-limitations)). Symptom: one wrapper's entire subtree missing at every sampled time while siblings render. Fix: translate/opacity animation; `scale` only on small content-sized leaves without inner clips.
3. **Fractional `opacity` nested under fractional `opacity`.** The rasterizer drops the ancestor's whole subtree while its opacity is between 0 and 1 if any descendant carries its own `opacity` < 1 (see [html.md limitations](./html.md#requirements-and-limitations)). Symptom: an element blank at every time its entrance/exit fade is mid-flight, rendering normally the moment the animated opacity reaches exactly 1 — deterministic per time and independent of sampling order. Fix: animate `opacity` on one level only; dim children with `rgba()`/`hsl()` alpha colors.
4. **`Error drawing <HtmlPaint> content: … No cached paint record for element`** in `logs`, or html content missing from the first sampled frame(s) of a capture while later frames render: the offline draw raced the browser's paint snapshot for a freshly mounted host. Engine-side, not a composition bug — until the `whenReady` paint-snapshot fix ships, re-request the affected time or lead the capture with a throwaway frame.
