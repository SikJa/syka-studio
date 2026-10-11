/** @jsxImportSource react */
import { useLayoutEffect, useState, type RefObject, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/** Escape the chat's overflow:hidden and fit the whole menu inside the viewport. */
export function ModelMenuPortal({ anchor, children }: { anchor: RefObject<HTMLButtonElement | null>; children: ReactNode }) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(280, window.innerWidth - 24);
      const above = rect.top - 16, below = window.innerHeight - rect.bottom - 16;
      const up = above >= Math.min(400, below);
      setStyle({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        ...(up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
        '--model-menu-height': `${Math.min(520, Math.max(120, up ? above : below))}px`,
      } as CSSProperties & { '--model-menu-height': string });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor]);
  return createPortal(<div className="syka-mirel-composer agent-composer syka-model-portal" style={style}>{children}</div>, document.fullscreenElement ?? document.body);
}
