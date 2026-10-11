# Generated assets

Assets that don't exist yet are **declared as values** with the `generate` namespace from `@diffusionstudio/jsx`. A declaration returns an **`AssetRef`** that is passed wherever a source is expected (`src`, `startFrame`, `endFrame`, `refs`). This makes generative content declarative: the project describes the asset it wants and the app produces it on mount.

```tsx
import { generate } from "@diffusionstudio/jsx";

const hero = generate.image({
  prompt: "A neon city at night, cinematic",
  model: "flux-2-turbo",
  aspectRatio: "16:9",
  seed: 42,
});

// one generated asset can feed another
const heroMotion = generate.video({
  prompt: "slow camera push-in",
  model: "kling-3-pro",
  startFrame: hero,
  duration: 5,
});

export default function Project() {
  return (
    <stage background="#161616" camera={[0.3, 0, 0, 0.3, 85, 150]}>
      <scene name="Intro" width={1920} height={1080} active>
        <video src={heroMotion} width={1920} height={1080} start={0} end={5} />
        <image src={hero} x={40} y={40} width={200} height={112} />
      </scene>
    </stage>
  );
}
```

Declarations are **pure**: calling `generate.*` validates its options and returns a ref; nothing is requested until an element carrying it mounts. A ref that is never used by a mounted element (directly or as an input to another asset) is never generated. Declarations may live at module scope or inside components.

Generation is **asynchronous and non-blocking**: the element is on the canvas immediately, showing a generating state, and its paint attaches when the asset lands. [`context`](../tools/context.md) reports where each one stands — generating, failed with the reason, or done with the library path it landed as — and a declaration that fails leaves its element carrying the reason, recorded in the library (see [errors.md](./errors.md#failed-sources)).

## Declaration options

[`models`](../tools/models.md) lists valid `model` ids and per-model constraints; [`voices`](../tools/voices.md) lists voices.

```ts
type AssetInput = string | AssetRef;   // path, URL, asset id, or another declaration

generate.image(opts: {
  prompt: string;                  // required
  model?: string;                  // default: the first image model from `models`
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";   // default "16:9"
  refs?: AssetInput[];             // image references
  seed?: number;                   // reproducible generation
}): AssetRef;

generate.video(opts: {
  prompt: string;                  // required
  model?: string;                  // default: the first video model from `models`
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";   // default "16:9"
  duration?: number;               // whole seconds; default 5
  audio?: boolean;                 // generate audio alongside; models with the `audio` feature only
  startFrame?: AssetInput;         // image used as the first frame
  endFrame?: AssetInput;           // image used as the last frame; `end-frame` feature only
  seed?: number;
}): AssetRef;

generate.voice(opts: {
  prompt: string;                  // required: the text to speak
  voice?: string;                  // default: the first voice from `voices`
  seed?: number;
}): AssetRef;

generate.audio(opts: {
  prompt: string;                  // required
  model?: string;                  // default: the first audio model from `models`
  duration?: number;               // seconds; default 30 for music, the model's own default for sfx
  seed?: number;
}): AssetRef;
```

## Transforms

`transform.*` declares an asset made from another. Each takes what it works on as its argument — a source string or another declaration — and returns an `AssetRef` like `generate.*` does, usable anywhere a source is:

```ts
transform.upscale(input: AssetInput): AssetRef;            // twice the pixels; a picture or footage — enlarges the source, not the box
transform.removeBackground(input: AssetInput): AssetRef;   // the subject cut out, the rest transparent; pictures only
transform.addAudio(input: AssetInput): AssetRef;           // footage scored with a generated soundtrack; independent of `volume` and `muted`
```

A chain reads inside out and runs in that order:

```tsx
<image src={transform.upscale(transform.removeBackground(generate.image({ prompt: "a red fox" })))} width={800} height={450} />
```

generates, cuts out, then enlarges. Each step is cached by step and input, so wrapping a further transform around a chain does not re-run what is inside it, and a transform over a library asset (`transform.upscale("footage/fox.png")`) leaves that asset as it is. A transform over the wrong kind of asset — a background removal over footage — fails like a spec a model cannot take (see [errors.md](./errors.md#failed-sources)).

## Dependency order

`startFrame`, `endFrame`, `refs`, and a transform's input accept other `AssetRef`s. The dependency graph is built from these values and generated in topological order, so referenced assets exist before the assets that consume them. Because dependencies are **values, not string ids**, a declaration can only reference refs that already exist; reference cycles are impossible by construction. Assets referenced only as inputs generate too, but produce no node of their own.

## Caching and idempotency

Generation is long-running and consumes credits, so results are **cached by content**: a key derived from the fully-resolved spec — `type`, `model`, `prompt`, the resolved ids of any references, `seed`, and the rest of the options, with the defaults filled in. Re-mounting an unchanged project reuses cached assets instead of regenerating, two declarations with identical specs collapse to a single asset, and identical concurrent declarations share one request; changing any option produces a new asset. Set `seed` to make a spec reproducible.

Finished generations are stored in the project's library under `generated/` with their spec key, so the cache survives app restarts — and a save that only touched an unrelated part of the file regenerates nothing. Deleting the asset from the library regenerates it on the next mount.

Where a generation stands is recorded there too: a run in flight is a `pending` entry of the library, and one that failed stays as an `error` entry carrying its reason, which answers the declaration — instead of another run — until the entry is removed (see [errors.md](./errors.md#failed-sources)).
