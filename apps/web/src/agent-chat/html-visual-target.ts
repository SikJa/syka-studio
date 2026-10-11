import { Cache, Color, Computed, Host, Paint, PaintType, Source, entityWorldMat, invert2D, store, transformPoint } from '@diffusionstudio/runtime';
import type { SceneNode } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import type { CaptureBox } from './visual-target-model';

export type HtmlVisualTarget = {
  kind: 'html-text' | 'html-element';
  root: Element;
  element: Element;
  /** The native geometry remains the owner; its DOM child is a source reference. */
  paint: Entity;
  source: string | null;
  selector: string;
  text: string;
  box: CaptureBox;
};

function paintRoots(node: Entity) {
  return [node, ...(node.get(Cache)?.fills ?? [])].filter(paint => paint.get(Paint)?.value === PaintType.HTML);
}

/** An HTML-only geometry has no native fill to hit in its transparent areas. */
export function isHtmlOnlyTarget(node: Entity): boolean {
  const paints = [node, ...(node.get(Cache)?.fills ?? [])];
  return paintRoots(node).length > 0 && !node.has(Color) &&
    !paints.some(paint => paint.get(Paint)?.value !== undefined && paint.get(Paint)?.value !== PaintType.HTML);
}

/** Child indices make duplicate labels addressable without inventing native layers. */
export function htmlSelector(root: Element, element: Element): string {
  const parts: string[] = [];
  for (let current: Element | null = element; current && current !== root; current = current.parentElement) {
    const siblings = Array.from(current.parentElement?.children ?? []).filter(sibling => sibling.localName === current!.localName);
    parts.unshift(`${current.localName}:nth-of-type(${siblings.indexOf(current) + 1})`);
  }
  return parts.length ? ':scope > ' + parts.join(' > ') : ':scope';
}

function domSource(node: SceneNode | null, element: Element): string | null {
  if (!node) return null;
  if (node.element === element) return node.entity.isAlive() ? node.entity.get(Source)?.value ?? null : null;
  for (const child of node.children) {
    // DOM text nodes have no composition entity.
    if (!('entity' in child)) continue;
    const source = domSource(child as SceneNode, element);
    if (source) return source;
  }
  return null;
}

const contains = (rect: DOMRect, point: { x: number; y: number }) => rect.width > 0 && rect.height > 0 && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

function visibleColor(color: string) {
  return !!color && color !== 'transparent' && !/^rgba\([^)]*,\s*0(?:\.0*)?\s*\)$/.test(color);
}

/** DOM containers are layout boxes, not necessarily painted surfaces. */
function paintedBox(element: Element, style: CSSStyleDeclaration, rect: DOMRect, point: { x: number; y: number }) {
  if (!contains(rect, point)) return false;
  if (visibleColor(style.backgroundColor) || style.backgroundImage !== 'none') return true;
  if (['img', 'svg', 'canvas', 'video', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line'].includes(element.localName)) return true;
  return (point.x < rect.left + parseFloat(style.borderLeftWidth) && visibleColor(style.borderLeftColor)) ||
    (point.x > rect.right - parseFloat(style.borderRightWidth) && visibleColor(style.borderRightColor)) ||
    (point.y < rect.top + parseFloat(style.borderTopWidth) && visibleColor(style.borderTopColor)) ||
    (point.y > rect.bottom - parseFloat(style.borderBottomWidth) && visibleColor(style.borderBottomColor));
}

/** Browser layout includes CSS transforms and multiline text, independent of preview zoom. */
export function pickHtmlDom(root: Element, point: { x: number; y: number }) {
  const view = root.ownerDocument.defaultView;
  if (!view) return null;
  const candidates: { element: Element; rects: DOMRect[]; text: string; z: number; order: number }[] = [];
  const elements = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 2000)];
  for (const [order, element] of elements.entries()) {
    const style = view.getComputedStyle(element);
    if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) continue;
    const rects: DOMRect[] = [];
    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType !== 3 || !child.textContent?.trim()) continue;
      const range = root.ownerDocument.createRange();
      range.selectNodeContents(child);
      const parts = Array.from(range.getClientRects());
      if (parts.some(rect => contains(rect, point))) {
        rects.push(...parts); text += child.textContent;
      }
    }
    if (!rects.length) {
      const rect = element.getBoundingClientRect();
      if (paintedBox(element, style, rect, point)) rects.push(rect);
    }
    if (!rects.some(rect => contains(rect, point))) continue;
    let visible = true;
    // Hidden/clipped ancestors must not leave ghost targets at another frame.
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const parentStyle = view.getComputedStyle(ancestor);
      if (parentStyle.display === 'none' || parentStyle.visibility !== 'visible' || Number(parentStyle.opacity) === 0 ||
          (/(hidden|clip|scroll|auto)/.test(parentStyle.overflow) && !contains(ancestor.getBoundingClientRect(), point))) { visible = false; break; }
      if (ancestor === root) break;
    }
    if (visible) candidates.push({ element, rects, text: text.trim(), z: Number(style.zIndex) || 0, order });
  }
  // A foreground image/decorative leaf can cover text; don't select through it.
  return candidates.sort((a, b) => b.z - a.z || b.order - a.order)[0] ?? null;
}

export function pickHtmlTarget(world: World, owner: Entity, point: { x: number; y: number }): HtmlVisualTarget | null {
  const computed = store(world, Computed), id = owner.id(), matrix = entityWorldMat(world, owner);
  if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-12) return null;
  const local = transformPoint(invert2D(matrix), point.x, point.y);
  const originX = computed.originX[id] ?? 0, originY = computed.originY[id] ?? 0;
  for (const paint of paintRoots(owner).reverse()) {
    const host = paint.get(Host), root = host?.element;
    if (!(root instanceof Element)) continue;
    const rootRect = root.getBoundingClientRect();
    if (!rootRect.width || !rootRect.height) continue;
    const hit = pickHtmlDom(root, { x: rootRect.left + local.x - originX, y: rootRect.top + local.y - originY });
    if (!hit) continue;
    const corners = hit.rects.flatMap(rect => [
      transformPoint(matrix, rect.left - rootRect.left + originX, rect.top - rootRect.top + originY),
      transformPoint(matrix, rect.right - rootRect.left + originX, rect.top - rootRect.top + originY),
      transformPoint(matrix, rect.right - rootRect.left + originX, rect.bottom - rootRect.top + originY),
      transformPoint(matrix, rect.left - rootRect.left + originX, rect.bottom - rootRect.top + originY),
    ]);
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    return { kind: hit.text ? 'html-text' : 'html-element', root, element: hit.element, paint,
      source: domSource(host ?? null, hit.element), selector: htmlSelector(root, hit.element), text: hit.text,
      box: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
  }
  return null;
}

export function htmlTargetDetails(target: HtmlVisualTarget) {
  return { type: target.kind, source: target.source, ownerPaint: target.paint.get(Source)?.value ?? null,
    selector: target.selector, tag: target.element.localName, text: target.text,
    instruction: 'Resolve this child inside the current HTML source. Preserve its siblings. This DOM child is not a native timeline clip.' };
}
