import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colord } from 'colord';
import { accentTokens, contrast, DEFAULT_ACCENT, formatColor, parseColor } from '../apps/web/src/lib/appearance/color.ts';
import { APPEARANCE_KEY, readAccent, saveAccent, accent, appearanceSaved } from '../apps/web/src/lib/appearance/controller.ts';

test('closed grammar rejects CSS, broken channels, unsupported values', () => {
  for (const value of ['', 'red', 'var(--evil)', '#fff; color:red', 'url(https://x)', {}, null, 'rgb(256 0 0)', 'hsl(20 110% 0%)', 'oklch(101% .2 30)', 'rgb(0 0 0 / -1)', 'hsl(1 2 3)', 'rgb(NaN 0 0)']) assert.equal(parseColor(value), null, String(value));
  assert.equal(parseColor('#abc'), '#AABBCC');
  assert.equal(parseColor('008cff'), DEFAULT_ACCENT);
  assert.equal(parseColor('rgb(255 0 128 / 50%)'), '#FF008080');
  assert.equal(parseColor('hsl(120 100% 50%)'), '#00FF00');
  assert.equal(parseColor('oklch(100% 0 0)'), '#FFFFFF');
});
test('all formats round-trip and preserve alpha within quantization tolerance', () => {
  for (const value of ['#008CFF', '#A78BFA', '#000000', '#FFFFFF', '#68C6AC80']) for (const format of ['HEX', 'RGB', 'HSL', 'OKLCH']) {
    const parsed = parseColor(formatColor(value, format)); assert.ok(parsed, `${value} ${format}`);
    const a = colord(value).toRgb(), b = colord(parsed).toRgb();
    for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(a[channel] - b[channel]) <= 3, `${value} ${format} ${channel}`);
    assert.ok(Math.abs(a.a - b.a) <= .01);
  }
});
test('button and selection contrast >=4.5; focus >=3 against neutral surfaces, both themes', () => {
  const colors = ['#000000', '#FFFFFF', '#008CFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#A78BFA', '#EF83B5', '#68C6AC', '#FFFFFF00', '#00000080'];
  // Sample the gamut, in addition to extrema and presets.
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) colors.push(colord({r,g,b}).toHex());
  for (const dark of [true, false]) for (const value of colors) {
    const t = accentTokens(value, dark);
    for (const key of ['--primary', '--primary-hover', '--primary-pressing']) assert.ok(contrast(t[key], t['--primary-foreground']) >= 4.5, `${value} ${dark} ${key}`);
    for (const key of ['--tertiary', '--tertiary-hover', '--tertiary-pressing', '--selection']) assert.ok(contrast(t[key], t['--selection-foreground']) >= 4.5, `${value} ${dark} ${key}`);
    for (const surface of dark ? ['#121212', '#171717', '#202022', '#292929'] : ['#FFFFFF', '#F2F2F2', '#E8E8E8']) assert.ok(contrast(t['--ring'], surface) >= 3, `${value} focus ${surface}`);
    assert.ok(Object.values(t).every(v => /^#[a-f0-9]{6}$/i.test(v)));
    assert.ok(!('--accent' in t) && !('--destructive' in t) && !('--meter-green' in t));
  }
});
test('versioned persistence, corrupt/missing/denied storage fallback, write failure', () => {
  const state = new Map();
  const storage = { getItem: k => state.get(k) ?? null, setItem: (k,v) => state.set(k,v) };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  assert.equal(readAccent(storage), DEFAULT_ACCENT);
  assert.equal(saveAccent('#a78bfa'), true);
  assert.equal(readAccent(storage), '#A78BFA');
  assert.equal(accent(), '#A78BFA');
  const saved = storage.getItem(APPEARANCE_KEY);
  assert.equal(saveAccent('var(--x)'), false); assert.equal(storage.getItem(APPEARANCE_KEY), saved);
  for (const invalid of ['oops', '{}', '{"version":2,"accent":"#fff"}', '{"version":1,"accent":"url(x)"}']) { state.set(APPEARANCE_KEY, invalid); assert.equal(readAccent(storage), DEFAULT_ACCENT); }
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  assert.equal(saveAccent('#fff'), true); assert.equal(appearanceSaved(), false); assert.equal(accent(), '#FFFFFF');
  assert.equal(readAccent({ getItem() { throw new Error('denied'); } }), DEFAULT_ACCENT);
});
