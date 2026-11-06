/** @jsxImportSource react */
/* Copied from Syka Code (B:/Code Apps/Syka-Next, features/thread/thinking), which
 * copies AICSS Thinking + Reasoning (MIT, see LICENSE in this folder). */
/**
 * Thinking + Reasoning de AICSS (https://www.aicss.dev/components/thinking-reasoning),
 * copiado de su registro con su CSS (salvo el `min-height` de la demo, que en un
 * chat dejaba 200 px vacíos bajo cada bloque plegado). Misma geometría, mismo
 * revelado, el mismo viewport con difuminados y el mismo plegado.
 *
 * Lo que en la demo simulaban los temporizadores lo pone el chat:
 *  - las frases son la actividad real del turno: el razonamiento que publica el
 *    motor, frase a frase, y cada herramienta con su verbo resaltado (DEC-006);
 *  - plegado, no pinta las frases (se montan al abrir) y sin will-change fijo: un
 *    chat largo con muchos bloques no carga capas ni cientos de frases ocultas;
 *  - «pensando» dura lo que dura la actividad; al empezar la respuesta se pliega,
 *    salvo que el usuario lo haya abierto o cerrado a mano (DEC-007).
 */
import { useRef, useState, type JSX } from 'react'
import { es, fmt } from './strings'
import styles from './ThinkingReasoning.module.css'

export interface ThinkingEntry {
  readonly key: string
  /** Herramienta: su verbo («Ejecutó», «Leyó»…), resaltado delante del texto. Razonamiento: null. */
  readonly verb: string | null
  readonly text: string
}

// Geometry - keep in sync with the CSS below.
const SENT_H = 40 // 2 lines × 20px
const GAP = 4
const MAX_H = 180 // viewport grows with content up to this, then scrolls
const FADE = 16 // top/bottom fade once the viewport is capped

export function ThinkingReasoning({ entries, thinking, elapsedS }: { entries: readonly ThinkingEntry[]; thinking: boolean; elapsedS: number }): JSX.Element {
  // Mientras piensa, abierto; al terminar se pliega en el resumen. Lo que el
  // usuario elige a mano (null: nada) se respeta en los dos estados.
  const [manual, setManual] = useState<boolean | null>(null)
  // Which soft fades to show while scrolling the unfolded reasoning.
  const [fade, setFade] = useState({ top: false, bottom: true })
  const viewportRef = useRef<HTMLDivElement>(null)

  const done = !thinking
  const open = manual ?? false
  const expanded = manual ?? !done
  // Plegado y quieto, por dentro no se pinta nada: un chat largo no carga cientos de
  // frases ocultas. Se pintan al abrir y se quitan al terminar de plegarse.
  const [painted, setPainted] = useState(expanded)
  if (expanded && !painted) setPainted(true)
  const count = entries.length
  const contentH = count > 0 ? count * SENT_H + (count - 1) * GAP : 0
  const capped = contentH > MAX_H
  const viewH = capped ? MAX_H : contentH
  const scrollable = done && open
  const translate = scrollable ? 0 : capped ? MAX_H - FADE - contentH : 0

  const showTop = scrollable ? fade.top : capped
  const showBottom = scrollable ? fade.bottom : capped
  const mask = capped ? `linear-gradient(to bottom, transparent 0, #000 ${String(showTop ? FADE : 0)}px, #000 calc(100% - ${String(showBottom ? FADE : 0)}px), transparent 100%)` : 'none'

  const onScroll = (): void => {
    const el = viewportRef.current
    if (!el) return
    setFade({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1
    })
  }

  const toggle = (): void => {
    const next = !expanded
    if (next) {
      setFade({ top: false, bottom: true })
      if (viewportRef.current) viewportRef.current.scrollTop = 0
    }
    setManual(next)
  }

  return (
    <div className={styles.tr}>
      <button type="button" className={styles.trHeader + ' ' + styles.isClickable} aria-expanded={expanded} aria-label={es.thread.thinkingToggle} onClick={toggle}>
        {done ? (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>{es.thread.thoughtVerb}</span> {fmt(es.thread.thoughtForSeconds, { seconds: elapsedS })}
          </span>
        ) : (
          <span className={styles.trLabel + ' ' + styles.trShimmer}>{es.thread.thinkingEllipsis}</span>
        )}
        {done && (
          <svg className={styles.trChevron} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div
        className={styles.trCollapsible + (expanded ? '' : ' ' + styles.isCollapsed)}
        onTransitionEnd={(event) => {
          if (!expanded && event.target === event.currentTarget) setPainted(false)
        }}
      >
        <div className={styles.trInner}>
          {painted ? (
          <div
            ref={viewportRef}
            className={styles.trViewport + (scrollable ? ' ' + styles.isScroll : '')}
            style={{ height: `${String(viewH)}px`, WebkitMaskImage: mask, maskImage: mask }}
            onScroll={scrollable ? onScroll : undefined}
          >
            <div className={styles.trStream} style={{ transform: `translateY(${String(translate)}px)` }}>
              {entries.map((entry) => (
                <p key={entry.key} className={styles.trSentence} title={entry.verb === null ? entry.text : `${entry.verb} ${entry.text}`}>
                  {entry.verb === null ? null : <span className={styles.trVerb}>{entry.verb} </span>}
                  {entry.text}
                </p>
              ))}
            </div>
          </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
