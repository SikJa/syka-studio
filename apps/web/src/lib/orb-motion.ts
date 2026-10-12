/** One bounded pulse on the existing canvas; no renderer or shape changes. */
export function pulseOrb(element: Element | null | undefined) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced') return;
  const canvas = element?.querySelector('canvas');
  if (!canvas) return;
  for (const animation of canvas.getAnimations()) animation.cancel();
  canvas.animate([
    { transform: 'scale(1)' }, { transform: 'scale(.82)', offset: .3 },
    { transform: 'scale(1.07)', offset: .7 }, { transform: 'scale(1)' },
  ], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
}
