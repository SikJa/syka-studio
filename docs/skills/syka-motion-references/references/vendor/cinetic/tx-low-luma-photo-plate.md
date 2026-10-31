# Low-luma photo plate

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-low-luma-photo-plate
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
A real photograph sits behind the UI or type, graded almost to black or thrown out of focus, adding context and tonal texture without stealing contrast from the copy.

## Use when
Dark-stage films that need real-world context (a desk, a city, a workspace) or a material, crafted feel behind sparse type or a floating panel.

## Avoid when
Light stages; a busy photo that stays above ~12% mean luma and fights the type; stock imagery unrelated to the product's world; decorative bokeh that names no job.

## Original recipe (adapt to Syka native time and nodes)
A full-bleed <Img> overscanned 6% sits under everything, in one of two settings: (a) a sharp texture plate behind statements, `filter: grayscale(1) brightness(0.25) contrast(1.15)` tuned until its mean luma is 5-8%; (b) a defocused context plate behind a moving panel, pre-blurred offline at a 40 px radius (PIL GaussianBlur saved as PNG, so the browser never animates a blur; use src/fx/RackFocus.tsx if focus must change) with `brightness(0.6) saturate(0.4)`, translated at 0.3x the panel's or camera's translation for parallax. Keep plate hues neutral or cool, run the film's global grain over it so the dark ramps do not band, and separate the panel on top with a luminance step (C.ink2) and `inset 0 1px 0 rgba(255,255,255,.08)`. Plates may hard-cut on beats under a locked foreground whose pill or headline stays pixel-identical across the cut.

## Original timing
A plate holds its shot (90-420 f) with 0.3x parallax or a 0.5-1.5 px/f drift; montage cuts under a locked foreground every 15-30 f on beats; never a fade on the plate.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
