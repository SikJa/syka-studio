/** @jsxImportSource react */
import { useEffect, useState, useRef } from "react";
import PixelCard from "./pixel-card/PixelCard";
import "./effort-pixels.css";

/** Mounted inside this slider's fill, never a document-wide portal. */
export function EffortPixels({
  kind,
  vertical,
  width,
  reduced,
}: {
  kind: "ultra" | "fast";
  vertical: boolean;
  width: number;
  reduced: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<string[]>(["#ffffff"]);
  useEffect(() => {
    const update = () => {
      if (!root.current) return;
      const accent = getComputedStyle(root.current).color;
      const next = [
        "#ffffff",
        `color-mix(in srgb, ${accent} 30%, white)`,
        `color-mix(in srgb, ${accent} 55%, white)`,
      ];
      setColors((old) => (old.join() === next.join() ? old : next));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  if (!visible) return null;
  return (
    <div
      ref={root}
      className="syka-effort-pixels"
      data-kind={kind}
      data-reduced={reduced || undefined}
      aria-hidden="true"
      inert
      style={
        vertical
          ? {
              width: 32,
              height: width,
              inset: "auto",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%) rotate(90deg)",
            }
          : undefined
      }
    >
      {!reduced && (
        <PixelCard
          trigger="always"
          intro={false}
          noFocus
          clickPulse={false}
          theme="dark"
          colors={colors}
          gap={5}
          pixelSize={2.8}
          speed={kind === "fast" ? 75 : 55}
          revealDuration={350}
          spotlight={0}
          glow={0}
          opacity={1}
          fade={0}
          radius={16}
        />
      )}
    </div>
  );
}
