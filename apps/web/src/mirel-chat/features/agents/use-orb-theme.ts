import { useEffect, useState, type RefObject } from 'react';

/** Kobalte owns Syka's theme; thinking-orbs' auto mode observes data-theme. */
export function useOrbTheme(host: RefObject<HTMLElement | null>): 'dark' | 'light' | 'auto' {
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('auto');
  useEffect(() => {
    const update = () => {
      const value = host.current?.closest('[data-kb-theme]')?.getAttribute('data-kb-theme');
      setTheme(value === 'dark' || value === 'light' ? value : 'auto');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {attributes: true, subtree: true, attributeFilter: ['data-kb-theme']});
    return () => observer.disconnect();
  }, [host]);
  return theme;
}
