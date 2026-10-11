export type NativeWindowStyle = {
  setCornerRadius(handle: Buffer, radius: number): void;
  setBackdrop(handle: Buffer, blur: number, r: number, g: number, b: number, a: number): void;
};

/** Optional styling must not prevent startup when a native addon cannot load. */
export function loadNativeWindowStyle(load: () => unknown, warn: (message: string) => void = console.warn): NativeWindowStyle | null {
  try {
    const style = load() as Partial<NativeWindowStyle> | null;
    if (typeof style?.setCornerRadius !== 'function' || typeof style.setBackdrop !== 'function') throw Error('Invalid native window-style exports');
    return style as NativeWindowStyle;
  } catch (error) {
    warn(`[window-style] Usando el estilo de ventana del sistema: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
