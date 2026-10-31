import { Button } from '@/components/ui/button';

export function TimelineNavigationControls(props: { fit: () => void; zoomBy: (factor: number) => void }) {
  return <div class="flex shrink-0 items-center gap-1 border-l border-border pl-2" role="group" aria-label="Navegación de timeline">
    <Button variant="ghost" class="px-2" aria-label="Alejar timeline" title="Alejar timeline" onClick={() => props.zoomBy(0.8)}>−</Button>
    <Button variant="ghost" class="px-2 whitespace-nowrap" aria-label="Ver toda la timeline" title="Ver toda la escena. Ctrl + rueda: zoom bajo el cursor. Shift + rueda o arrastre con botón central: desplazarse." onClick={() => props.fit()}>Ver todo</Button>
    <Button variant="ghost" class="px-2" aria-label="Acercar timeline" title="Acercar timeline" onClick={() => props.zoomBy(1.25)}>+</Button>
  </div>;
}
