import { describe, expect, it, vi } from 'vitest';
import { loadNativeWindowStyle } from './native-window-style';

describe('optional native window styling', () => {
  it('retains the native callbacks when the addon loads', () => {
    const style = { setCornerRadius: vi.fn(), setBackdrop: vi.fn() }, warn = vi.fn();
    expect(loadNativeWindowStyle(() => style, warn)).toBe(style); expect(warn).not.toHaveBeenCalled();
  });
  it.each(['missing addon', 'wrong architecture', 'missing dependent library'])('allows normal startup with %s', message => {
    const warn = vi.fn();
    expect(loadNativeWindowStyle(() => { throw Error(message); }, warn)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
  it('refuses invalid exports without crashing the app', () => {
    expect(loadNativeWindowStyle(() => ({ setCornerRadius: 1 }), vi.fn())).toBeNull();
  });
});
