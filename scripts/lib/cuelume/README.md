# Pinned Cuelume offline renderer

Cuelume 0.2.8, by Daniel Belyi, MIT licensed. Source revision:
`2a1ba4fc1b67e8371c9f37e37a51e61353166335` from
<https://github.com/danielwh2/cuelume>.

`PINNED.json` records upstream and local SHA-256 values. The nine `dist` modules
have only had their TypeScript types removed with Syka's existing TypeScript
toolchain. `scripts/sound.mjs` is the unchanged upstream Node offline renderer;
it uses the same recipes, envelopes, room, level matching and seeded noise.
It does not create a browser or a live AudioContext. See `LICENSE`.

Run `node scripts/prepare-cuelume-sounds.mjs` from the Syka repository to rebuild
the bundled WAV catalog. It requires Node with TypeScript stripping support,
preserves the other packs, rejects changed files and records quantized stereo
measurements. Frozen WAVs have no live strike randomness or typing cadence.
The installer contains the rendered WAVs and their MIT notice; rendering does
not add a runtime npm dependency or replace the editor's native audio engine.
