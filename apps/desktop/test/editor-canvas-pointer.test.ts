import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PointerEvents } from '@/engine/traits';
import { createEngine } from '@/engine/create-engine';

vi.mock('somoto', () => ({toast: vi.fn()}));

// Rendering is not exercised, but the renderer allocates its identity matrix.
vi.hoisted(() => {
  vi.stubGlobal('DOMMatrix', class {});
  vi.stubGlobal('DOMRect', class {});
  vi.stubGlobal('Path2D', class {});
  vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => {}, removeItem: () => {}});
  vi.stubGlobal('document', {fonts: {addEventListener: () => {}}});
});

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal('DOMMatrix', class {});
  vi.stubGlobal('DOMRect', class {});
  vi.stubGlobal('Path2D', class {});
  vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => {}, removeItem: () => {}});
  vi.stubGlobal('document', {fonts: {addEventListener: () => {}}});
});

describe('canvas releases and floating editor controls', () => {
  it('leaves chat text selection and copy to the browser, while canvas keys still work', () => {
    vi.stubGlobal('ResizeObserver', class { disconnect() {} });
    class Element {isContentEditable=false; constructor(private chat=false){} closest(){return this.chat ? this : null;} }
    vi.stubGlobal('HTMLElement',Element); vi.stubGlobal('HTMLInputElement',class{});vi.stubGlobal('HTMLTextAreaElement',class{});
    let selection: unknown=null;
    vi.stubGlobal('window',{getSelection:()=>selection});
    const engine=createEngine('chat-copy-test',{audioContext:{} as AudioContext});
    const input=engine as unknown as {onKeyDown(event:KeyboardEvent):void};
    const preventDefault=vi.fn();
    input.onKeyDown({key:'c',ctrlKey:true,target:new Element(true),preventDefault} as unknown as KeyboardEvent);
    expect(preventDefault).not.toHaveBeenCalled();
    selection={isCollapsed:false,anchorNode:{parentElement:new Element(true)}};
    input.onKeyDown({key:'c',ctrlKey:true,target:new Element(),preventDefault} as unknown as KeyboardEvent);
    expect(preventDefault).not.toHaveBeenCalled();
    input.onKeyDown({key:'ArrowRight',target:new Element(),preventDefault} as unknown as KeyboardEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    selection=null;
    input.onKeyDown({key:'ArrowRight',target:new Element(),preventDefault} as unknown as KeyboardEvent);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    engine.world.destroy();
  });
  it('ignores releases from popovers and keeps off-canvas gesture completion', () => {
    vi.stubGlobal('ResizeObserver', class { disconnect() {} });
    const engine = createEngine('pointer-test', {audioContext: {} as AudioContext});
    // Exercise the real input boundary without starting playback or a renderer.
    const input = engine as unknown as {
      canvas: Pick<HTMLCanvasElement, 'getBoundingClientRect'>;
      onPointerDown(event: PointerEvent): void;
      onPointerUp(event: PointerEvent): void;
    };
    input.canvas = {getBoundingClientRect: () => ({left:100,top:50} as DOMRect)};
    const pointer = (pointerId: number) => ({pointerId,button:0,clientX:180,clientY:90} as PointerEvent);
    const queue = engine.world.get(PointerEvents)!.queue;
    input.onPointerUp(pointer(7));
    expect(queue).toHaveLength(0);
    input.onPointerDown(pointer(1));
    input.onPointerUp(pointer(7));
    expect(queue.map(event => event.type)).toEqual(['pointerdown']);
    input.onPointerUp(pointer(1));
    input.onPointerUp(pointer(1));
    expect(queue.map(event => event.type)).toEqual(['pointerdown','pointerup']);
    expect(queue[1]).toMatchObject({clientX:80,clientY:40});
    engine.world.destroy();
  });
});
