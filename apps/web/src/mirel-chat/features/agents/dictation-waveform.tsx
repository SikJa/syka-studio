/** @jsxImportSource react */
import { useEffect, useRef } from "react";

/** Samples the existing microphone stream locally; never routes sound to speakers. */
export function DictationWaveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const painter = element?.getContext("2d");
    if (!element || !painter) return;
    const color = getComputedStyle(element).color;
    // A fixed 2x backing surface keeps the rounded bars crisp without a large canvas.
    painter.setTransform(2, 0, 0, 2, 0, 0);
    const draw = (levels: number[], offset = 0) => {
      painter.clearRect(0, 0, 320, 32); painter.fillStyle = color;
      levels.forEach((level, i) => {
        const height = 3 + level * 25;
        const x = i * (320 / 48) - offset;
        painter.globalAlpha = .48 + level * .4;
        painter.beginPath(); painter.roundRect(x, (32 - height) / 2, 3.2, height, 1.6); painter.fill();
      });
      painter.globalAlpha = 1;
    };
    const levels = Array<number>(49).fill(0); draw(levels);
    if (!active || !stream) return;
    let context: AudioContext;
    try { context = new AudioContext(); } catch { return; }
    const source = context.createMediaStreamSource(stream), analyser = context.createAnalyser();
    analyser.fftSize = 256; source.connect(analyser);
    void context.resume().catch(() => {});
    const samples = new Uint8Array(analyser.fftSize);
    let envelope = 0, lastSample = performance.now();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
      // Compress the microphone range so normal speech has presence; silence stays flat.
      const target = Math.min(1, Math.pow(Math.max(0, rms - .006) * 7, .65));
      envelope += (target - envelope) * (target > envelope ? .72 : .22);
      const now = performance.now();
      if (now - lastSample >= 80) { levels.shift(); levels.push(envelope); lastSample = now; }
      draw(levels, Math.min(1, (now - lastSample) / 80) * (320 / 48));
    }, 33);
    return () => { clearInterval(timer); source.disconnect(); analyser.disconnect(); void context.close().catch(() => {}); };
  }, [stream, active]);
  return <canvas ref={canvas} width={640} height={64} className="dictation-waveform" role="img" aria-label={active ? "Nivel de tu voz" : "Grabación en pausa"}/>;
}
