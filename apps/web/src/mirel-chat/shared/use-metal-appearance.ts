import { useEffect, useState } from "react";
import type { MetalFxTheme } from "metal-fx";
interface ComposerMetalAppearance {
  theme: MetalFxTheme;
  reducedMotion: boolean;
  /** Pause the WebGL ring: reduced motion, or a window in the background or hidden. */
  paused: boolean;
}

// The metal ring is a 60 fps WebGL shader. It animates while the Syka window
// is open and focused, and keeps its last frame when the window is in the
// background, minimized or hidden, so it never spends GPU for nobody.
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
function active(): boolean {
  return typeof document !== "undefined" && document.hasFocus() && !document.hidden;
}
let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("focus", notify);
  window.addEventListener("blur", notify);
  document.addEventListener("visibilitychange", notify);
}

function readComposerMetalAppearance(): ComposerMetalAppearance {
  if (typeof window === "undefined") return { theme: "dark", reducedMotion: false, paused: true };
  const reducedMotion = document.documentElement.dataset.motion === "reduced"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
    reducedMotion,
    paused: reducedMotion || !active(),
  };
}

export function useComposerMetalAppearance(): ComposerMetalAppearance {
  const [appearance, setAppearance] = useState<ComposerMetalAppearance>(readComposerMetalAppearance);

  useEffect(() => {
    install();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAppearance((current) => {
      const next = readComposerMetalAppearance();
      return current.theme === next.theme && current.reducedMotion === next.reducedMotion && current.paused === next.paused ? current : next;
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
    motion.addEventListener("change", sync);
    listeners.add(sync);
    sync();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      listeners.delete(sync);
    };
  }, []);

  return appearance;
}
