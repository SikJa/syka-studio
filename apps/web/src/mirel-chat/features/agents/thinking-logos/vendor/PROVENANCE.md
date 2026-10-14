# Thinking Logos

TypeScript engine and baker from https://github.com/enesozturk/thinking-logos
at commit `c18bc9c6470766f9a615303d35b43f446f0342b9`.

The adjacent LICENSE contains the upstream MIT license and the original Thinking Orbs attribution.
Syka imports the pure engine at runtime. The DOM-based baker is used only by
`scripts/prepare-thinking-logos.mjs`, not by the chat component.

Local compile-only changes: unused parameter `rMin` renamed `_rMin` in core.ts;
unused LogoBinding / Line type imports and unused smoothE in logoDeform.ts removed.
Rendering formulas and presets are unchanged.
