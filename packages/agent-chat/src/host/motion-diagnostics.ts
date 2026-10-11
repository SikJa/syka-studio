import { mediaProcess } from './media-analysis';

const WIDTH = 32, HEIGHT = 18, PIXELS = WIDTH * HEIGHT;
type Frame = { index: number; seconds: number };
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Low-resolution temporal screening, not an aesthetic or text detector. */
export function inspectMotionFrames(raw: Buffer, frames: Frame[], loop = false, declaredCuts: number[] = []) {
  if (raw.length !== frames.length * PIXELS || frames.length < 2) throw Error('Los cuadros diagnósticos no coinciden con los timestamps del archivo.');
  const image = (i: number) => raw.subarray(i * PIXELS, (i + 1) * PIXELS);
  const difference = (a: Buffer, b: Buffer) => { let sum = 0; for (let i = 0; i < PIXELS; i++) sum += Math.abs(a[i]! - b[i]!); return sum / PIXELS; };
  const flashes: { frame: number; seconds: number; change: number; returnDifference: number; nearDeclaredCut: boolean }[] = [];
  let strongestChange = { frame: 1, seconds: frames[1]!.seconds, difference: 0 };
  for (let n = 1; n < frames.length; n++) {
    const change = difference(image(n - 1), image(n));
    if (change > strongestChange.difference) strongestChange = { frame: frames[n]!.index, seconds: frames[n]!.seconds, difference: round(change) };
    if (n === frames.length - 1) continue;
    const after = difference(image(n), image(n + 1)), returns = difference(image(n - 1), image(n + 1));
    if (change >= 40 && after >= 40 && returns < Math.min(change, after) * .2) {
      const radius = Math.max(frames[n]!.seconds - frames[n - 1]!.seconds, frames[n + 1]!.seconds - frames[n]!.seconds);
      flashes.push({ frame: frames[n]!.index, seconds: frames[n]!.seconds, change: round(change), returnDifference: round(returns), nearDeclaredCut: declaredCuts.some(t => Math.abs(t - frames[n]!.seconds) <= radius) });
    }
  }
  let loopSeam: { difference: number; velocityDifference: number; needsInspection: boolean } | null = null;
  if (loop && frames.length >= 3) {
    const first = image(0), second = image(1), last = image(frames.length - 1), previous = image(frames.length - 2);
    // Normalize unequal VFR intervals to the first interval before comparing velocities.
    const dtFirst = frames[1]!.seconds - frames[0]!.seconds, dtLast = frames.at(-1)!.seconds - frames.at(-2)!.seconds;
    if (dtFirst <= 0 || dtLast <= 0) throw Error('Intervalos temporales inválidos.');
    let velocity = 0;
    for (let i = 0; i < PIXELS; i++) velocity += Math.abs((last[i]! - previous[i]!) * dtFirst / dtLast - (second[i]! - first[i]!));
    const diff = difference(first, last);
    loopSeam = { difference: round(diff), velocityDifference: round(velocity / PIXELS), needsInspection: diff > 20 || velocity / PIXELS > 20 };
  }
  return { method: '32x18 grayscale consecutive encoded frames', decodedFrames: frames.length,
    flashCandidates: flashes.slice(0, 24), flashCandidatesTotal: flashes.length, strongestChange, loopSeam,
    limitations: ['Un flash puede ser intencional; las señales no rechazan la pieza automáticamente.', 'La diferencia global no detecta todos los saltos de objetos, clipping ni texto ilegible.', 'Esto examina el archivo exportado; no prueba el seek determinista de la fuente actual.'] };
}

export async function motionDiagnostics(ffmpeg: string, source: string, frames: Frame[], loop = false, cuts: number[] = []) {
  if (frames.length < 2) return { skipped: 'El archivo tiene menos de dos cuadros.' };
  const decoded = await mediaProcess(ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-i', source, '-map', '0:v:0', '-an', '-vf', `scale=${WIDTH}:${HEIGHT}:flags=area,format=gray`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], 14_000_000);
  return inspectMotionFrames(decoded.stdout, frames, loop, cuts);
}
