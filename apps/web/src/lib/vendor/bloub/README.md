# Bloub engine attribution

Framework-independent TypeScript engine from https://github.com/jeremy-prt/bloub,
commit `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`, retrieved 2026-10-13.
The 12 TypeScript modules are unmodified; the adjacent LICENSE is upstream's MIT license.
No Vue runtime, application code, remote assets, telemetry or build scripts are included.

Syka's adapter is `../../syka-mascot.ts`: the actual Syka composing ribbon orb
is the body. Only the upstream engine's mathematical eyes, blinks and expression
morphing are reused, together with original task gestures. Eye paths are now
used directly, with Syka grey/metal/translucent materials instead of full white. Its README distinguishes the code's MIT
license from the original imitated x.ai visual branding; that branding is not bundled.

Earlier exploration (not shown in the current preview): `robot-heads@0.3.0`, MIT, installed from npm at an exact version.
https://github.com/fayazara/robot-heads/tree/58ebf6439a8125a769f63b22ffd35bc18834b1b5
The React wrapper is `../../../mirel-chat/features/agents/syka-robot-mascot.tsx`.
