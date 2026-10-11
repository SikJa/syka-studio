/** @jsxImportSource react */
import {
  ArrowUp,
  ChevronRight,
  LoaderCircle,
  MessageCircleQuestion,
  Scissors,
  Smile,
  SpellCheck,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./selection-actions.css";

export type SelectionActionKind = "describe" | "change";

export interface SelectionActionContext {
  /** The exact text selected by the user, including intentional whitespace. */
  text: string;
  /** A safe clone of the selected DOM range at the time the action runs. */
  range: Range;
  /** The element whose contents are eligible for selection actions. */
  container: HTMLElement;
  /** Optional free-form instruction entered in the pill. */
  instruction?: string;
}

export type SelectionActionHandler = (
  context: SelectionActionContext,
) => void | Promise<void>;

export interface SelectionActionsLabels {
  toolbar: string;
  describe: string;
  change: string;
  placeholder: string;
  send: string;
  describing: string;
  changing: string;
  showMore: string;
  showLess: string;
  unavailable: string;
  error: string;
}

export interface SelectionPresetAction {
  id: string;
  label: string;
  instruction: string;
  busyLabel: string;
  icon: ReactNode;
}

export interface SelectionActionsProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  labels?: Partial<SelectionActionsLabels>;
  minSelectionLength?: number;
  onChange?: SelectionActionHandler;
  onDescribe?: SelectionActionHandler;
  onError?: (error: unknown, action: SelectionActionKind) => void;
  onOpenChange?: (open: boolean) => void;
  portalTarget?: HTMLElement | null;
  presetActions?: readonly SelectionPresetAction[];
}

export interface SelectionRectLike {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface SelectionActionsPosition {
  left: number;
  placement: "above" | "below";
  top: number;
}

interface SelectionSnapshot {
  key: string;
  range: Range;
  text: string;
}

const DEFAULT_LABELS: SelectionActionsLabels = {
  toolbar: "Acciones para el texto seleccionado",
  describe: "Describir",
  change: "Cambiar",
  placeholder: "Describí los cambios",
  send: "Aplicar indicación",
  describing: "Describiendo…",
  changing: "Cambiando…",
  showMore: "Mostrar más acciones",
  showLess: "Mostrar menos acciones",
  unavailable: "Esta acción todavía no está conectada",
  error: "No se pudo completar la acción.",
};

const PRESET_ICON_PROPS = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

export const DEFAULT_SELECTION_PRESET_ACTIONS: readonly SelectionPresetAction[] = [
  {
    id: "shorten",
    label: "Acortar",
    instruction: "Acortá el texto seleccionado sin perder su intención.",
    busyLabel: "Acortando…",
    icon: <Scissors {...PRESET_ICON_PROPS} />,
  },
  {
    id: "tone",
    label: "Tono",
    instruction: "Cambiá el tono del texto seleccionado manteniendo su significado.",
    busyLabel: "Cambiando tono…",
    icon: <Smile {...PRESET_ICON_PROPS} />,
  },
  {
    id: "grammar",
    label: "Gramática",
    instruction: "Corregí la gramática del texto seleccionado sin cambiar su voz.",
    busyLabel: "Corrigiendo…",
    icon: <SpellCheck {...PRESET_ICON_PROPS} />,
  },
];

const VIEWPORT_MARGIN = 12;
const TOOLBAR_GAP = 9;
const FALLBACK_TOOLBAR_WIDTH = 385;
const FALLBACK_TOOLBAR_HEIGHT = 36;
const MIN_BUSY_VISIBILITY_MS = 520;

function clamp(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) return (minimum + maximum) / 2;
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Keeps the pill inside the viewport and flips it above the selection when the
 * lower edge would be clipped. Exported so positioning stays independently
 * testable without mounting the component.
 */
export function getSelectionActionsPosition({
  anchorRect,
  toolbarHeight,
  toolbarWidth,
  viewportHeight,
  viewportWidth,
}: {
  anchorRect: SelectionRectLike;
  toolbarHeight: number;
  toolbarWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}): SelectionActionsPosition {
  const effectiveWidth = Math.min(
    toolbarWidth,
    Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2),
  );
  const halfWidth = effectiveWidth / 2;
  const centeredOnSelection = anchorRect.left + anchorRect.width / 2;
  const left = clamp(
    centeredOnSelection,
    VIEWPORT_MARGIN + halfWidth,
    viewportWidth - VIEWPORT_MARGIN - halfWidth,
  );
  const belowTop = anchorRect.bottom + TOOLBAR_GAP;
  const aboveTop = anchorRect.top - TOOLBAR_GAP - toolbarHeight;
  const fitsBelow = belowTop + toolbarHeight <= viewportHeight - VIEWPORT_MARGIN;
  const fitsAbove = aboveTop >= VIEWPORT_MARGIN;
  const placement = !fitsBelow && fitsAbove ? "above" : "below";
  const unclampedTop = placement === "above" ? aboveTop : belowTop;

  return {
    left: Math.round(left),
    placement,
    top: Math.round(
      clamp(
        unclampedTop,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - toolbarHeight),
      ),
    ),
  };
}

function isRangeInsideContainer(range: Range, container: HTMLElement) {
  return container.contains(range.startContainer) && container.contains(range.endContainer);
}

function getRangeAnchorRect(range: Range): SelectionRectLike | null {
  const lineRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  const lastLine = lineRects.at(-1);
  const bounds = range.getBoundingClientRect();
  if (lastLine) {
    const horizontalBounds = bounds.width > 0 ? bounds : lastLine;
    return {
      bottom: lastLine.bottom,
      height: lastLine.height,
      left: horizontalBounds.left,
      right: horizontalBounds.right,
      top: lastLine.top,
      width: horizontalBounds.width,
    };
  }
  return bounds.width > 0 || bounds.height > 0 ? bounds : null;
}

function createSelectionKey(range: Range, text: string) {
  return [
    text,
    range.startOffset,
    range.endOffset,
    range.startContainer.textContent?.length ?? 0,
    range.endContainer.textContent?.length ?? 0,
  ].join("\u0000");
}

function readSelectionSnapshot(
  selection: Selection | null,
  container: HTMLElement,
  minSelectionLength: number,
): SelectionSnapshot | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed || !isRangeInsideContainer(range, container)) return null;

  const text = selection.toString();
  if (text.trim().length < minSelectionLength || !getRangeAnchorRect(range)) return null;

  return {
    key: createSelectionKey(range, text),
    range: range.cloneRange(),
    text,
  };
}

function getViewportSize() {
  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    width: window.visualViewport?.width ?? window.innerWidth,
  };
}

export function SelectionActions({
  children,
  className = "",
  disabled = false,
  labels: labelsProp,
  minSelectionLength = 1,
  onChange,
  onDescribe,
  onError,
  onOpenChange,
  portalTarget: portalTargetProp,
  presetActions = DEFAULT_SELECTION_PRESET_ACTIONS,
}: SelectionActionsProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const hostRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastToolbarWidthRef = useRef(0);
  const previousBusyRef = useRef(false);
  const widthAnimationRef = useRef<Animation | null>(null);
  const openRef = useRef(false);
  const interactingWithToolbarRef = useRef(false);
  const dismissedSelectionRef = useRef<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(
    portalTargetProp ?? null,
  );
  const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null);
  const [position, setPosition] = useState<SelectionActionsPosition | null>(null);
  const [prompt, setPrompt] = useState("");
  const [typingWidth, setTypingWidth] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busyAction, setBusyAction] = useState<{
    kind: SelectionActionKind;
    label: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateOpen = useCallback(
    (nextOpen: boolean) => {
      if (openRef.current === nextOpen) return;
      openRef.current = nextOpen;
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const dismiss = useCallback(() => {
    if (snapshot) dismissedSelectionRef.current = snapshot.key;
    interactingWithToolbarRef.current = false;
    widthAnimationRef.current?.cancel();
    widthAnimationRef.current = null;
    lastToolbarWidthRef.current = 0;
    previousBusyRef.current = false;
    setSnapshot(null);
    setPosition(null);
    setPrompt("");
    setTypingWidth(null);
    setExpanded(false);
    setErrorMessage(null);
    updateOpen(false);
  }, [snapshot, updateOpen]);

  const placeToolbar = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (!snapshot) return;

      let anchorRect: SelectionRectLike | null = null;
      try {
        anchorRect = getRangeAnchorRect(snapshot.range);
      } catch {
        dismiss();
        return;
      }
      if (!anchorRect) {
        dismiss();
        return;
      }

      const viewport = getViewportSize();
      const toolbarBounds = toolbarRef.current?.getBoundingClientRect();
      const nextPosition = getSelectionActionsPosition({
        anchorRect,
        toolbarHeight: toolbarBounds?.height || FALLBACK_TOOLBAR_HEIGHT,
        toolbarWidth: toolbarBounds?.width || FALLBACK_TOOLBAR_WIDTH,
        viewportHeight: viewport.height,
        viewportWidth: viewport.width,
      });
      setPosition((current) =>
        current?.left === nextPosition.left &&
        current.top === nextPosition.top &&
        current.placement === nextPosition.placement
          ? current
          : nextPosition,
      );
    });
  }, [dismiss, snapshot]);

  const syncSelection = useCallback(() => {
    const host = hostRef.current;
    if (!host || disabled || busyAction) return;
    if (
      interactingWithToolbarRef.current ||
      (toolbarRef.current && toolbarRef.current.contains(document.activeElement))
    ) {
      return;
    }

    const nextSnapshot = readSelectionSnapshot(
      window.getSelection(),
      host,
      Math.max(1, minSelectionLength),
    );
    if (!nextSnapshot) {
      if (openRef.current) dismiss();
      dismissedSelectionRef.current = null;
      return;
    }
    if (dismissedSelectionRef.current === nextSnapshot.key) return;

    dismissedSelectionRef.current = null;
    setSnapshot((current) => (current?.key === nextSnapshot.key ? current : nextSnapshot));
    setPrompt((current) => (snapshot?.key === nextSnapshot.key ? current : ""));
    if (snapshot?.key !== nextSnapshot.key) {
      setTypingWidth(null);
      setExpanded(false);
    }
    setErrorMessage(null);
    updateOpen(true);
  }, [busyAction, disabled, dismiss, minSelectionLength, snapshot?.key, updateOpen]);

  const scheduleSelectionSync = useCallback(() => {
    window.requestAnimationFrame(syncSelection);
  }, [syncSelection]);

  useEffect(() => {
    setPortalTarget(portalTargetProp ?? document.body);
  }, [portalTargetProp]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const beginSelection = () => { dismissedSelectionRef.current = null; };
    host.addEventListener("pointerdown", beginSelection);
    document.addEventListener("selectionchange", scheduleSelectionSync);
    host.addEventListener("pointerup", scheduleSelectionSync);
    host.addEventListener("keyup", scheduleSelectionSync);
    return () => {
      host.removeEventListener("pointerdown", beginSelection);
      document.removeEventListener("selectionchange", scheduleSelectionSync);
      host.removeEventListener("pointerup", scheduleSelectionSync);
      host.removeEventListener("keyup", scheduleSelectionSync);
    };
  }, [scheduleSelectionSync]);

  useEffect(() => {
    if (!snapshot) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolbarRef.current?.contains(target)) {
        interactingWithToolbarRef.current = true;
        return;
      }
      if (!hostRef.current?.contains(target)) dismiss();
    };
    const handleDocumentPointerUp = () => {
      interactingWithToolbarRef.current = false;
    };
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        hostRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("pointerup", handleDocumentPointerUp, true);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      document.removeEventListener("pointerup", handleDocumentPointerUp, true);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [dismiss, snapshot]);

  useLayoutEffect(() => {
    if (!snapshot) return;
    placeToolbar();

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(placeToolbar);
    if (hostRef.current) resizeObserver?.observe(hostRef.current);
    if (toolbarRef.current) resizeObserver?.observe(toolbarRef.current);
    window.addEventListener("resize", placeToolbar);
    window.addEventListener("scroll", placeToolbar, true);
    window.visualViewport?.addEventListener("resize", placeToolbar);
    window.visualViewport?.addEventListener("scroll", placeToolbar);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", placeToolbar);
      window.removeEventListener("scroll", placeToolbar, true);
      window.visualViewport?.removeEventListener("resize", placeToolbar);
      window.visualViewport?.removeEventListener("scroll", placeToolbar);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [placeToolbar, snapshot]);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const content = toolbarContentRef.current;
    if (!toolbar || !content || !snapshot) return;

    const nextWidth = Math.ceil(content.getBoundingClientRect().width) + 8;
    const previousWidth = lastToolbarWidthRef.current || Math.ceil(toolbar.getBoundingClientRect().width);
    const busyChanged = previousBusyRef.current !== Boolean(busyAction);
    const reducedMotion =
      document.documentElement.dataset.motion === "reduced" ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    if (
      busyChanged &&
      Math.abs(nextWidth - previousWidth) > 1 &&
      !reducedMotion &&
      typeof toolbar.animate === "function"
    ) {
      widthAnimationRef.current?.cancel();
      const animation = toolbar.animate(
        [{ width: `${previousWidth}px` }, { width: `${nextWidth}px` }],
        { duration: 320, easing: "cubic-bezier(.23, 1, .32, 1)" },
      );
      widthAnimationRef.current = animation;
      animation.onfinish = () => {
        lastToolbarWidthRef.current = nextWidth;
        widthAnimationRef.current = null;
        placeToolbar();
      };
    } else {
      lastToolbarWidthRef.current = nextWidth;
    }

    previousBusyRef.current = Boolean(busyAction);
    return () => {
      widthAnimationRef.current?.cancel();
      widthAnimationRef.current = null;
    };
  }, [busyAction, placeToolbar, snapshot]);

  useEffect(() => {
    const content = toolbarContentRef.current;
    if (!content || !snapshot) return;

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (widthAnimationRef.current?.playState === "running") return;
      lastToolbarWidthRef.current = Math.ceil(content.getBoundingClientRect().width) + 8;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [snapshot]);

  useEffect(() => {
    if (!disabled) return;
    dismiss();
  }, [disabled, dismiss]);

  const runAction = useCallback(
    async (kind: SelectionActionKind, instruction?: string, busyLabel?: string) => {
      const host = hostRef.current;
      if (!snapshot || !host || busyAction) return;
      const handler = kind === "describe" ? onDescribe : onChange;
      if (!handler) return;
      const startedAt = window.performance.now();
      const reducedMotion =
        document.documentElement.dataset.motion === "reduced" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      setExpanded(false);
      setBusyAction({
        kind,
        label: busyLabel ?? (kind === "describe" ? labels.describing : labels.changing),
      });
      setErrorMessage(null);
      try {
        const trimmedInstruction = instruction?.trim();
        const context: SelectionActionContext = {
          container: host,
          range: snapshot.range.cloneRange(),
          text: snapshot.text,
          ...(trimmedInstruction ? { instruction: trimmedInstruction } : {}),
        };
        await handler(context);
        const remainingBusyTime = reducedMotion
          ? 0
          : MIN_BUSY_VISIBILITY_MS - (window.performance.now() - startedAt);
        if (remainingBusyTime > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remainingBusyTime));
        }
        dismiss();
      } catch (error) {
        setErrorMessage(labels.error);
        onError?.(error, kind);
      } finally {
        setBusyAction(null);
      }
    },
    [
      busyAction,
      dismiss,
      labels.changing,
      labels.describing,
      labels.error,
      onChange,
      onDescribe,
      onError,
      snapshot,
    ],
  );

  const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (prompt.trim() && onChange) void runAction("change", prompt);
  };

  const hasPrompt = prompt.trim().length > 0;
  const toolbar = snapshot && portalTarget ? createPortal(
    <div
      className="selection-actions-float"
      data-placement={position?.placement ?? "below"}
      data-ready={Boolean(position)}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0 }}
    >
      <div
        ref={toolbarRef}
        className="selection-actions-toolbar"
        data-mode={busyAction ? "busy" : hasPrompt ? "typing" : expanded ? "expanded" : "idle"}
        role="toolbar"
        aria-label={labels.toolbar}
        aria-keyshortcuts="Alt+Enter Escape"
        style={{
          width: !busyAction && hasPrompt && typingWidth ? typingWidth : undefined,
        }}
        onPointerDown={() => {
          interactingWithToolbarRef.current = true;
        }}
        onPointerLeave={() => {
          if (!toolbarRef.current?.contains(document.activeElement)) {
            interactingWithToolbarRef.current = false;
          }
        }}
      >
        <div
          ref={toolbarContentRef}
          className="selection-actions-content"
          style={{
            width: !busyAction && hasPrompt && typingWidth ? typingWidth - 8 : undefined,
          }}
        >
          {busyAction ? <span className="selection-actions-busy" role="status">
            <LoaderCircle size={13} aria-hidden="true" />
            <span className="selection-actions-shimmer">{busyAction.label}</span>
          </span> : <>
            <div
              className="selection-actions-prompt-shell"
              style={{
                maxWidth: expanded ? 0 : hasPrompt && typingWidth ? typingWidth - 40 : 145,
                opacity: expanded ? 0 : 1,
                transform: expanded ? "translateX(-8px)" : "translateX(0)",
              }}
            >
              <div
                className="selection-actions-prompt"
                style={{ width: hasPrompt && typingWidth ? typingWidth - 40 : 145 }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  aria-label={labels.placeholder}
                  placeholder={labels.placeholder}
                  disabled={!onChange}
                  onChange={(event) => {
                    const nextPrompt = event.target.value;
                    if (!prompt.trim() && nextPrompt.trim()) {
                      setTypingWidth(Math.ceil(toolbarRef.current?.getBoundingClientRect().width ?? 0));
                    } else if (!nextPrompt.trim()) {
                      setTypingWidth(null);
                    }
                    setPrompt(nextPrompt);
                  }}
                  onKeyDown={handlePromptKeyDown}
                />
              </div>
            </div>

            <div
              className="selection-actions-action-shell"
              style={{
                maxWidth: hasPrompt ? 0 : expanded ? 520 : 226,
                opacity: hasPrompt ? 0 : 1,
                transform: hasPrompt ? "translateX(-8px)" : "translateX(0)",
              }}
            >
              {!expanded ? <span className="selection-actions-divider" aria-hidden="true" /> : null}
              <button
                type="button"
                title={onDescribe ? undefined : labels.unavailable}
                disabled={!onDescribe}
                onClick={() => void runAction("describe")}
              >
                <MessageCircleQuestion size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>{labels.describe}</span>
              </button>
              <button
                type="button"
                title={onChange ? undefined : labels.unavailable}
                disabled={!onChange}
                onClick={() => void runAction("change")}
              >
                <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>{labels.change}</span>
              </button>

              <div
                className="selection-actions-more"
                style={{
                  maxWidth: expanded ? 290 : 0,
                  opacity: expanded ? 1 : 0,
                  marginLeft: expanded ? 2 : 0,
                }}
              >
                {presetActions.map((preset) => <button
                  key={preset.id}
                  type="button"
                  title={onChange ? undefined : labels.unavailable}
                  disabled={!onChange}
                  onClick={() => void runAction("change", preset.instruction, preset.busyLabel)}
                >
                  {preset.icon}
                  <span>{preset.label}</span>
                </button>)}
              </div>

              {presetActions.length ? <>
                <span className="selection-actions-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="selection-actions-expand"
                  aria-label={expanded ? labels.showLess : labels.showMore}
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </> : null}
            </div>

            <div
              className="selection-actions-send-shell"
              style={{
                maxWidth: hasPrompt ? 30 : 0,
                opacity: hasPrompt ? 1 : 0,
                transform: hasPrompt ? "scale(1)" : "scale(.88)",
              }}
            >
              <button
                type="button"
                className="selection-actions-send"
                aria-label={labels.send}
                disabled={!onChange}
                onClick={() => void runAction("change", prompt)}
              >
                <ArrowUp size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </>}
        </div>

      </div>
      {errorMessage ? <span className="selection-actions-error" role="alert">{errorMessage}</span> : null}
    </div>,
    portalTarget,
  ) : null;

  return <>
    <div
      ref={hostRef}
      className={`selection-actions-boundary ${className}`.trim()}
      data-selection-actions-boundary=""
      tabIndex={-1}
    >
      {children}
      <span className="selection-actions-announcer" aria-live="polite">
        {snapshot
          ? "Texto seleccionado. Presioná Alt más Enter para abrir las acciones."
          : ""}
      </span>
    </div>
    {toolbar}
  </>;
}

export default SelectionActions;
