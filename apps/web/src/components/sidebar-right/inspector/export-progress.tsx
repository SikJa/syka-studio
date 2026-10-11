/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show, Portal } from "solid-js/web";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatDuration } from "@/utils/formatters";
import type { EncoderConfig } from "@diffusionstudio/encoder";

/** The settings this overlay reads: the encoder's, less how it is driven. */
export type ExportConfig = Omit<
  EncoderConfig,
  "target" | "scene" | "onProgress" | "realizeScene" | "comment"
>;

type ExportProgressProps = {
  open: boolean;
  progress: number;
  remaining?: { minutes: number; seconds: number };
  config?: ExportConfig;
  width: number;
  height: number;
  duration: number;
  onCancel: () => void;
};

export function ExportProgress(props: ExportProgressProps) {
  const cfg = () => props.config;

  const format = () => (cfg()?.format ?? "mp4").toUpperCase();
  const fps = () => cfg()?.video?.fps ?? 30;
  const videoCodec = () => cfg()?.video?.codec ?? "avc";
  const audioCodec = () => cfg()?.audio?.codec ?? "aac";
  const sampleRate = () =>
    Math.round((cfg()?.audio?.sampleRate ?? 48000) / 1000);
  const bitrate = () => {
    const bps = cfg()?.video?.bitrate ?? 10e6;
    return `${(bps / 1e6).toFixed(1)} Mbps`;
  };

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 bg-overlay-strong" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-background px-6 py-6 text-foreground shadow-xl" role="status" aria-live="polite">
            <h4 class="text-lg">Exportando composición</h4>

            <div class="mt-4 flex w-full flex-col gap-2">
              <div
                class="grid w-full auto-cols-auto grid-flow-col grid-rows-4 gap-y-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-3 text-xs
                  [&>div]:w-2 [&>p]:text-foreground [&>span]:text-muted-foreground"
              >
                <span>Duración</span>
                <span>Resolución</span>
                <span>Bitrate</span>
                <span>Fotogramas</span>

                <p>{formatDuration(props.duration)}</p>
                <p>
                  {props.width} x {props.height}
                </p>
                <p>{bitrate()}</p>
                <p>{fps()} FPS</p>

                <div />
                <div />
                <div />
                <div />

                <span>Códec de video</span>
                <span>Contenedor</span>
                <span>Códec de audio</span>
                <span>Muestreo</span>

                <p>{videoCodec()}</p>
                <p>{format()}</p>
                <p>{audioCodec()}</p>
                <p>{sampleRate()} KHz</p>
              </div>

              <div>
                <div class="mt-2 mb-2 flex w-full justify-between text-sm">
                  <p class="text-muted-foreground">Progreso</p>
                  <p>
                    {props.progress}%
                    <Show when={props.remaining}>
                      {(r) => (
                        <span>
                          {" "}
                          &middot; {r().minutes}min {r().seconds}s
                        </span>
                      )}
                    </Show>
                  </p>
                </div>
                <div class="relative h-2 w-full overflow-hidden rounded-full bg-foreground/20">
                  <div
                    class="h-full bg-foreground rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${props.progress}%` }}
                  />
                </div>
              </div>
            </div>

            <Button
              class="mt-6 border-foreground/15 bg-foreground/10 shadow-none gap-0.5 pl-1 pr-3"
              onClick={props.onCancel}
            >
              <Icon name="spinner-loader" class="size-6 animate-spin motion-reduce:animate-none" />
              Cancelar
            </Button>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
