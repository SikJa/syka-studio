# Long page flown like a runway

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-page-runway-flyover
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: high; role: accent; formats: launch, feature, walkthrough

## Mechanism
A whole long page lies on a steeply tilted plane that recedes to a horizon, and the view travels along it faster and faster, so the page reads as one landscape and is cut at full speed.

## Use when
Showing the length or completeness of a page, document, feed or site in about a second without asking anyone to read it; a fast connective beat between two readable product shots, or the carrier for a change made mid-move, such as a theme switch.

## Avoid when
The content must be read, the page is short (it reads as a tilted card instead), or the frame is vertical and leaves too little runway; use it once per film.

## Original recipe (adapt to Syka native time and nodes)
Lay the whole page out as live components at desktop width inside a runway plane about 75% of frame width and 2x frame height long (overflow hidden), in a full-frame parent with perspective 1200 px and its perspective-origin at frame centre; give the plane transform-origin 50% 100%, rotateX(55deg) and put its bottom edge on the frame's bottom edge, so its far edge recedes to a horizon about 25% down the frame and its sides converge like a runway. Move the page inside the plane, never the camera: translateY = Y0 + 6n + 0.225n² for n = f − s up to 54 (plane speed 6 → 30 px/f), then +36 px per frame to the cut, so content streams toward the viewer and the page's upper sections emerge from the horizon (start with its lower sections on the plane so the hero arrives last); at the near edge the screen speed is about 0.95x the plane speed and the far half moves much slower. Fade the far end with an alpha mask on the plane, mask-image linear-gradient(to top, #000 45%, transparent 95%), so the stage colour swallows the horizon in one hue, and keep the empty stage above the horizon as the caption band, where one short line lands with src/fx/Words.tsx in screen space while the page streams below it. Nothing on the plane is meant to be read: keep the motion-blur pass on for the whole flight and cut on its last, fastest frame into a shot that opens moving the same way.

## Original timing
Flight 80 f: plane speed 6 → 30 px/f over 54 f (closed form 6n + 0.225n², linear acceleration with no ease-out), then 36 px/f for 26 f into the cut, about 1,900 px of travel (page at least plane length + 2,000 px); near-edge screen speed ≈ 6 → 34 px/f, under the blur pass throughout; rotateX 55°, perspective 1200 px, plane 2x frame height; caption words 6 f apart, landed by f40 of the flight; cut on the final frame.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
