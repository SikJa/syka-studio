/** Small dependency-free stereo measurements. No synthesis or audio mutation. */
export const SFX_RATE = 48000;
export const SOUND_BANDS = [[30, 125], [125, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 8000], [8000, 16000]] as const;
const round = (value: number) => Math.round(value * 10000) / 10000;

function powerSpectrum(values: Float64Array) {
  const n = values.length, re = values.slice(), im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j]!, re[i]!];
  }
  for (let width = 2; width <= n; width <<= 1) {
    const angle = -2 * Math.PI / width;
    for (let base = 0; base < n; base += width) for (let k = 0; k < width / 2; k++) {
      const c = Math.cos(angle * k), s = Math.sin(angle * k), a = base + k, b = a + width / 2;
      const tr = c * re[b]! - s * im[b]!, ti = c * im[b]! + s * re[b]!;
      re[b] = re[a]! - tr; im[b] = im[a]! - ti; re[a] = re[a]! + tr; im[a] = im[a]! + ti;
    }
  }
  return re.subarray(0, n / 2 + 1).map((value, i) => value * value + im[i]! * im[i]!);
}

export function soundProfile(pcm: Buffer, rate = SFX_RATE) {
  if (!pcm.length || pcm.length % 8) throw Error('Se necesita PCM estéreo completo.');
  const frames = pcm.length / 8, window = Math.max(1, Math.round(rate * .002));
  const energy: number[] = [], powers = new Float64Array(1025);
  let peak = 0, squares = 0, leftSquares = 0, rightSquares = 0, cross = 0;
  for (let i = 0; i < frames; i += window) {
    let sum = 0;
    for (let j = i; j < Math.min(frames, i + window); j++) {
      const left = pcm.readFloatLE(j * 8), right = pcm.readFloatLE(j * 8 + 4);
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw Error('PCM inválido.');
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      sum += left * left + right * right; leftSquares += left * left; rightSquares += right * right; cross += left * right;
    }
    squares += sum; energy.push(Math.sqrt(sum / (2 * Math.min(window, frames - i))));
  }
  // Non-overlapping Hann windows, separately per channel: no mono cancellation.
  for (let start = 0; start < frames; start += 2048) for (let channel = 0; channel < 2; channel++) {
    const values = new Float64Array(2048);
    for (let j = 0; j < Math.min(2048, frames - start); j++) values[j] = pcm.readFloatLE((start + j) * 8 + channel * 4) * (.5 - .5 * Math.cos(2 * Math.PI * j / 2047));
    const spectrum = powerSpectrum(values); for (let k = 1; k < spectrum.length; k++) powers[k] += spectrum[k]!;
  }
  const bands = SOUND_BANDS.map(([lowHz, highHz]) => {
    let power = 0; for (let k = 1; k < powers.length; k++) if (k * rate / 2048 >= lowHz && k * rate / 2048 < highHz) power += powers[k]!;
    return { lowHz, highHz, power };
  });
  let total = 0, weighted = 0, low = 0, high = 0, peakBin = 0, logPower = 0, binCount = 0;
  const floor = Math.max(...powers) * 1e-6 + 1e-30;
  for (let k = 1; k < powers.length; k++) {
    const hz = k * rate / 2048; if (hz < 30 || hz >= 16000) continue;
    const value = powers[k]!; total += value; weighted += value * hz;
    if (hz < 150) low += value; if (hz >= 6000) high += value;
    if (value > powers[peakBin]!) peakBin = k;
    logPower += Math.log(Math.max(floor, value)); binCount++;
  }
  const maxEnergy = Math.max(...energy), peakIndex = energy.indexOf(maxEnergy);
  const prior = energy.slice(0, peakIndex + 1), onset = prior.findIndex(v => v >= maxEnergy * .1), almostPeak = prior.findIndex(v => v >= maxEnergy * .9);
  const end = energy.slice(Math.max(0, energy.length - 10));
  const bandTotal = bands.reduce((sum, band) => sum + band.power, 0);
  const rms = Math.sqrt(squares / (2 * frames));
  const centroid = total > 1e-20 ? weighted / total : null;
  return {
    durationSeconds: round(frames / rate), peakDb: peak ? round(20 * Math.log10(peak)) : null, rmsDb: rms ? round(20 * Math.log10(rms)) : null,
    peakOffsetSeconds: maxEnergy ? round(peakIndex * window / rate) : null,
    onsetOffsetSeconds: maxEnergy ? round(onset * window / rate) : null,
    riseMs: maxEnergy ? round(Math.max(0, almostPeak - onset) * window / rate * 1000) : null,
    centroidHz: centroid === null ? null : Math.round(centroid),
    brightness: centroid === null ? null : centroid < 1500 ? 'dark' as const : centroid > 4000 ? 'bright' as const : 'balanced' as const,
    lowEnergyRatio: total > 1e-20 ? round(low / total) : null, highEnergyRatio: total > 1e-20 ? round(high / total) : null,
    flatness: total > 1e-20 ? round(Math.exp(logPower / binCount) / (total / binCount)) : null,
    dominantFrequencyHz: total > 1e-20 ? round(peakBin * rate / 2048) : null,
    endRelativeDb: maxEnergy ? round(20 * Math.log10(Math.max(...end) / maxEnergy + 1e-12)) : null,
    stereoCorrelation: leftSquares && rightSquares ? round(cross / Math.sqrt(leftSquares * rightSquares)) : null,
    bands: bands.map(({ lowHz, highHz, power }) => ({ lowHz, highHz, energyRatio: bandTotal > 1e-20 ? round(power / bandTotal) : 0, rms: rms * Math.sqrt(bandTotal > 1e-20 ? power / bandTotal : 0) })),
    spectralMethod: '2048-sample Hann FFT, stereo channel energies, 30–16000 Hz; approximate band RMS',
  };
}
export type SoundProfile = ReturnType<typeof soundProfile>;
