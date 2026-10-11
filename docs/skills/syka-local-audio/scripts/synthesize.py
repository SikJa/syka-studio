"""Deterministic local PCM cues. No dependencies, network or existing-file overwrite."""
import argparse
import math
import random
import struct
import wave
from pathlib import Path

RATE = 48000


def render(kind, duration, bpm, seed):
    count = round(duration * RATE)
    rng = random.Random(seed)
    samples = []
    low_noise = 0.0
    beat = 60.0 / bpm
    for i in range(count):
        t = i / RATE
        u = i / max(1, count - 1)
        if kind == "pop":
            phase = 2 * math.pi * (120 * t + 220 * 0.035 * (1 - math.exp(-t / 0.035)))
            value = math.sin(phase) * math.exp(-t / 0.055)
        elif kind == "click":
            value = rng.uniform(-1, 1) * math.exp(-t / 0.007)
        elif kind == "whoosh":
            low_noise = 0.75 * low_noise + 0.25 * rng.uniform(-1, 1)
            value = low_noise * math.sin(math.pi * u) ** 2
        elif kind == "chime":
            value = sum(math.sin(2 * math.pi * f * t) * math.exp(-t / decay)
                        for f, decay in [(523.25, 0.6), (659.25, 0.45), (783.99, 0.35)]) / 3
        else:
            # Simple electronic bed: arpeggio, soft pad and synthesized kick.
            notes = (130.81, 164.81, 196.0, 261.63)
            phase = t % (beat / 2)
            note = notes[int(t / (beat / 2)) % len(notes)]
            arp = math.sin(2 * math.pi * note * phase) * math.exp(-phase / 0.12)
            kick_t = t % beat
            kick = math.sin(2 * math.pi * (50 * kick_t + 60 * 0.025 * (1 - math.exp(-kick_t / 0.025)))) * math.exp(-kick_t / 0.06)
            pad = sum(math.sin(2 * math.pi * f * t) for f in notes[:3]) / 3
            value = 0.28 * arp + 0.25 * kick + 0.12 * pad
        # Both ends meet silence; prevents boundary clicks and abrupt truncated tails.
        fade = min(1, t / 0.004, (duration - 1 / RATE - t) / min(0.08, duration / 3))
        samples.append(value * max(0, fade))
    peak = max(abs(x) for x in samples) or 1
    scale = (10 ** (-6 / 20)) * 32767 / peak
    return b"".join(struct.pack("<h", round(x * scale)) for x in samples)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=("pop", "click", "whoosh", "chime", "bed"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--duration", type=float)
    parser.add_argument("--bpm", type=float, default=96)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    duration = args.duration if args.duration is not None else {"pop": 0.22, "click": 0.08, "whoosh": 0.5, "chime": 1.2, "bed": 8}[args.kind]
    if not math.isfinite(duration) or not 0.04 <= duration <= 120:
        parser.error("duration must be between 0.04 and 120 seconds")
    if not math.isfinite(args.bpm) or not 30 <= args.bpm <= 240:
        parser.error("bpm must be between 30 and 240")
    pcm = render(args.kind, duration, args.bpm, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as destination:
        with wave.open(destination, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm)
    print(str(args.output.resolve()))


if __name__ == "__main__":
    main()
