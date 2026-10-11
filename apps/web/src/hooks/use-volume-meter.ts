/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, onCleanup } from 'solid-js';

export type ChannelLevels = {
  rms: number;
  peak: number;
};

const ZERO_LEVELS: ChannelLevels[] = [
  { rms: 0, peak: 0 },
  { rms: 0, peak: 0 },
];

type Listener = (levels: ChannelLevels[]) => void;

/**
 * A single shared AudioWorkletNode tapped onto a GainNode. Multiple
 * `useVolumeMeter` consumers pointing at the same GainNode reuse the same
 * worklet — the meter math runs once and the result fans out to every
 * subscribed listener.
 */
type SharedMeter = {
  workletNode: AudioWorkletNode;
  listeners: Set<Listener>;
  lastLevels: ChannelLevels[];
};

const sharedMeters = new WeakMap<GainNode, SharedMeter>();
const modulesLoaded = new WeakSet<BaseAudioContext>();

async function ensureModuleLoaded(ctx: BaseAudioContext) {
  if (modulesLoaded.has(ctx)) return;
  await ctx.audioWorklet.addModule(getVolumeMeterWorkletUrl());
  modulesLoaded.add(ctx);
}

function parseLevels(data: Float32Array): ChannelLevels[] {
  const channels = data.length / 2;
  const out: ChannelLevels[] = [];
  for (let ch = 0; ch < Math.min(channels, 2); ch++) {
    out.push({ rms: data[ch * 2], peak: data[ch * 2 + 1] });
  }
  // Pad mono → stereo for the meter UI.
  while (out.length < 2) {
    out.push(out[0] ?? { rms: 0, peak: 0 });
  }
  return out;
}

/**
 * Attach `listener` to the meter for `gainNode`, creating the worklet on
 * demand. Returns a teardown function — when the last listener detaches the
 * worklet is disconnected and the shared entry is dropped.
 */
async function subscribe(gainNode: GainNode, listener: Listener): Promise<() => void> {
  const existing = sharedMeters.get(gainNode);
  if (existing) {
    existing.listeners.add(listener);
    // Replay the last value so a freshly-attached consumer doesn't render
    // ZERO_LEVELS for one frame.
    listener(existing.lastLevels);
    return () => detach(gainNode, listener);
  }

  const ctx = gainNode.context;
  await ensureModuleLoaded(ctx);

  // Another consumer may have raced ahead while addModule was awaiting.
  const racedExisting = sharedMeters.get(gainNode);
  if (racedExisting) {
    racedExisting.listeners.add(listener);
    listener(racedExisting.lastLevels);
    return () => detach(gainNode, listener);
  }

  const workletNode = new AudioWorkletNode(ctx, 'volume-meter', {
    channelCount: 2,
    channelCountMode: 'explicit',
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  const shared: SharedMeter = {
    workletNode,
    listeners: new Set([listener]),
    lastLevels: ZERO_LEVELS,
  };

  workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const levels = parseLevels(event.data);
    shared.lastLevels = levels;
    for (const l of shared.listeners) l(levels);
  };

  // Tap the gain node's output. The worklet's output is left disconnected
  // so it doesn't double the signal into the audio destination.
  gainNode.connect(workletNode);

  sharedMeters.set(gainNode, shared);
  return () => detach(gainNode, listener);
}

function detach(gainNode: GainNode, listener: Listener) {
  const shared = sharedMeters.get(gainNode);
  if (!shared) return;
  shared.listeners.delete(listener);
  if (shared.listeners.size > 0) return;

  shared.workletNode.port.onmessage = null;
  try {
    shared.workletNode.disconnect();
  } catch {
    /* already disconnected */
  }
  sharedMeters.delete(gainNode);
}

/**
 * Returns reactive per-channel RMS + peak levels for the given GainNode.
 * Multiple callers pointing at the same node share a single worklet — the
 * audio-thread work runs once regardless of how many meters are mounted.
 *
 * Call `connect(gainNode)` to wire it up and `disconnect()` to tear down.
 */
export function useVolumeMeter() {
  const [levels, setLevels] = createSignal<ChannelLevels[]>(ZERO_LEVELS);

  let currentGainNode: GainNode | null = null;
  let teardown: (() => void) | null = null;
  // Tracks the latest subscription request so an in-flight subscribe() that
  // resolves after a newer connect()/disconnect() can be discarded.
  let subscriptionToken = 0;

  const handleLevels: Listener = (next) => setLevels(next);

  const disconnect = () => {
    subscriptionToken++;
    currentGainNode = null;
    if (teardown) {
      teardown();
      teardown = null;
    }
    setLevels(ZERO_LEVELS);
  };

  const connect = async (gainNode: GainNode) => {
    if (currentGainNode === gainNode && teardown) return;

    disconnect();
    currentGainNode = gainNode;
    const token = ++subscriptionToken;

    const release = await subscribe(gainNode, handleLevels);

    // A newer connect()/disconnect() landed while we were awaiting — drop
    // this subscription instead of leaking it.
    if (token !== subscriptionToken) {
      release();
      return;
    }

    teardown = release;
  };

  onCleanup(disconnect);

  return { levels, connect, disconnect };
}

/**
 * AudioWorklet processor for volume metering.
 *
 * Computes per-channel RMS and peak values with smoothing and peak-hold,
 * all on the audio thread. Posts ready-to-display values to the main thread
 * via MessagePort so the UI just writes them into a signal.
 *
 * The processor is a pass-through — input is copied to output so it can be
 * inserted anywhere in the audio graph without affecting playback.
 */
function volumeMeterWorkletCode() {
  /* global AudioWorkletProcessor, registerProcessor, sampleRate */
  const SMOOTHING_DOWN = 0.85;
  const SMOOTHING_UP = 0.4;
  const PEAK_SMOOTHING_UP = 0.2;
  const PEAK_DECAY = 0.97;
  const MAX_CHANNELS = 2;

  class VolumeMeterProcessor extends AudioWorkletProcessor {
    private framesSinceLastPost = 0;
    private readonly updateInterval: number;

    // Per-channel smoothing state
    private smoothedRms: number[] = [0, 0];
    private smoothedPeak: number[] = [0, 0];
    private peakHoldValues: number[] = [0, 0];
    private peakHoldFrames: number[] = [0, 0];
    private readonly peakHoldDuration: number;

    constructor(options: { processorOptions?: { updateIntervalMs?: number; peakHoldMs?: number } }) {
      super();
      const ms = options.processorOptions?.updateIntervalMs ?? 16;
      this.updateInterval = Math.round((sampleRate * ms) / 1000);
      this.peakHoldDuration = Math.round((sampleRate * (options.processorOptions?.peakHoldMs ?? 600)) / 1000);
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]) {
      const input = inputs[0];
      if (!input || input.length === 0) return true;

      // Pass-through
      const output = outputs[0];
      for (let ch = 0; ch < input.length; ch++) {
        if (output[ch]) {
          output[ch].set(input[ch]);
        }
      }

      const blockSize = input[0].length;
      const channels = Math.min(input.length, MAX_CHANNELS);

      // Accumulate RMS and peak per block for smoothing
      for (let ch = 0; ch < channels; ch++) {
        const samples = input[ch];
        let sumSq = 0;
        let peak = 0;

        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          sumSq += s * s;
          const abs = s < 0 ? -s : s;
          if (abs > peak) peak = abs;
        }

        const rawRms = Math.sqrt(sumSq / samples.length);

        // Smooth RMS (fast attack, slow release)
        const rmsFactor = rawRms > this.smoothedRms[ch] ? SMOOTHING_UP : SMOOTHING_DOWN;
        this.smoothedRms[ch] = this.smoothedRms[ch] * rmsFactor + rawRms * (1 - rmsFactor);

        // Peak hold with decay
        if (peak >= this.peakHoldValues[ch]) {
          this.peakHoldValues[ch] = peak;
          this.peakHoldFrames[ch] = 0;
        } else {
          this.peakHoldFrames[ch] += blockSize;
          if (this.peakHoldFrames[ch] > this.peakHoldDuration) {
            this.peakHoldValues[ch] *= PEAK_DECAY;
          }
        }

        // Smooth peak for display
        const peakFactor = peak > this.smoothedPeak[ch] ? PEAK_SMOOTHING_UP : SMOOTHING_DOWN;
        this.smoothedPeak[ch] = this.smoothedPeak[ch] * peakFactor + peak * (1 - peakFactor);
      }

      this.framesSinceLastPost += blockSize;

      if (this.framesSinceLastPost >= this.updateInterval) {
        this.framesSinceLastPost = 0;

        // Layout: [rms0, peak0, rms1, peak1, ...]
        const data = new Float32Array(channels * 2);
        for (let ch = 0; ch < channels; ch++) {
          data[ch * 2] = this.smoothedRms[ch];
          data[ch * 2 + 1] = this.smoothedPeak[ch];
        }

        this.port.postMessage(data);
      }

      return true;
    }
  }

  registerProcessor('volume-meter', VolumeMeterProcessor);
}

let workletUrl: string | null = null;

export function getVolumeMeterWorkletUrl(): string {
  if (!workletUrl) {
    const blob = new Blob(
      [`(${volumeMeterWorkletCode.toString()})()`],
      { type: 'application/javascript' },
    );
    workletUrl = URL.createObjectURL(blob);
  }
  return workletUrl;
}
