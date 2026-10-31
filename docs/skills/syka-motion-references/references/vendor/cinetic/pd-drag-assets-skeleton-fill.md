# Drag assets in, skeletons fill

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-drag-assets-skeleton-fill
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: feature, walkthrough

## Mechanism
The cursor drags a fanned stack of images into the input; after the drop they appear as grey skeleton thumbnails that fill with the real images one by one.

## Use when
The product takes real material as input (files, photos, documents) and the viewer should see that context going in.

## Avoid when
The input is text only; the drag path would cross text being read; more than six assets (show a count chip instead).

## Original recipe (adapt to Syka native time and nodes)
Build the stack as four image cards rotated −12°, −4°, 4° and 12° that travel with the cursor along cursorArc (src/fx/Cursor.tsx, bow 0.2) on E.smooth, each card evaluated 1 f behind the one above so the fan trails slightly; pressAt marks the pickup and the release. On the drop frame (or just after a cut), mount the thumbnails as C.mist rounded rects in the input's attachment row and fade each image up over 8 f on E.smooth with a 1.04 → 1 scale, i × 8 f apart. The input's other contents shift by FLIP as the row opens over 18 f on E.ui, and the drag path stays clear of any text being read.

## Original timing
Drag ≈ 72 f on E.smooth; thumbnails 8 f each at a 6-10 f stagger (≈ 36 f for four); attachment row opens over 18 f on E.ui.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
