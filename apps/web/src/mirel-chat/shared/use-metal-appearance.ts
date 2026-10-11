import { useEffect, useState } from "react";
import type { MetalFxTheme } from "metal-fx";
interface ComposerMetalAppearance {
  theme: MetalFxTheme;
  reducedMotion: boolean;
}

function readComposerMetalAppearance(): ComposerMetalAppearance {
  if (typeof window === "undefined") return { theme: "dark", reducedMotion: false };
  return {
    theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
    reducedMotion: document.documentElement.dataset.motion === "reduced"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function useComposerMetalAppearance(): ComposerMetalAppearance {
  const [appearance, setAppearance] = useState<ComposerMetalAppearance>(readComposerMetalAppearance);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAppearance((current) => {
      const next = readComposerMetalAppearance();
      return current.theme === next.theme && current.reducedMotion === next.reducedMotion ? current : next;
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
    motion.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
    };
  }, []);

  return appearance;
}
