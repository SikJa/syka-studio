import { createSignal } from 'solid-js';

export const EDITOR_TOUR_VERSION = 1;
export const EDITOR_TOUR_KEY = 'syka.editor-tour';
export const EDITOR_TOUR_EVENT = 'syka:editor-tour';
/** Other contextual suggestions wait until this guide leaves the screen. */
export const [editorTourVisible, setEditorTourVisible] = createSignal(false);

export type TourProgress = { version: number; status: 'new' | 'dismissed' | 'completed'; step: number; updatedAt?: string };
type TourStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readTourProgress(storage: Pick<TourStorage, 'getItem'>): TourProgress {
  const fresh: TourProgress = { version: EDITOR_TOUR_VERSION, status: 'new', step: 0 };
  try {
    const value = JSON.parse(storage.getItem(EDITOR_TOUR_KEY) || 'null');
    return value?.version === EDITOR_TOUR_VERSION && ['dismissed', 'completed'].includes(value.status)
      && Number.isInteger(value.step) && value.step >= 0 ? value : fresh;
  } catch { return fresh; }
}
export function saveTourProgress(storage: TourStorage, status: 'dismissed' | 'completed', step: number): TourProgress {
  const progress: TourProgress = { version: EDITOR_TOUR_VERSION, status: readTourProgress(storage).status === 'completed' ? 'completed' : status, step: Math.max(0, Math.floor(step)), updatedAt: new Date().toISOString() };
  try { storage.setItem(EDITOR_TOUR_KEY, JSON.stringify(progress)); } catch { /* The tour also works in a storage-restricted window. */ }
  return progress;
}
export function requestEditorTour() { window.dispatchEvent(new Event(EDITOR_TOUR_EVENT)); }

export type TourRect = { x: number; y: number; width: number; height: number };
export function placeTourCard(target: TourRect | null, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const edge = 12, top = 44, gap = 14;
  const clamp = (x: number, y: number) => ({ x: Math.max(edge, Math.min(x, viewport.width - card.width - edge)), y: Math.max(top, Math.min(y, viewport.height - card.height - edge)) });
  if (!target) return clamp(viewport.width - card.width - edge, viewport.height - card.height - edge);
  const positions = [
    clamp(target.x + target.width + gap, target.y + (target.height - card.height) / 2),
    clamp(target.x - card.width - gap, target.y + (target.height - card.height) / 2),
    clamp(target.x + (target.width - card.width) / 2, target.y + target.height + gap),
    clamp(target.x + (target.width - card.width) / 2, target.y - card.height - gap),
  ];
  const overlap = (p: { x: number; y: number }) => Math.max(0, Math.min(p.x + card.width, target.x + target.width) - Math.max(p.x, target.x)) * Math.max(0, Math.min(p.y + card.height, target.y + target.height) - Math.max(p.y, target.y));
  return positions.sort((a, b) => overlap(a) - overlap(b))[0]!;
}

export type EditorTourStep = { id: string; title: string; body: string; selector: string; fallback?: string; shortcut?: string };
/** Targets use stable UI identifiers, independent of translated names. */
export function resolveEditorTourTarget<T>(
  step: Pick<EditorTourStep, 'selector' | 'fallback'>,
  query: (selector: string) => Iterable<T>,
  isVisible: (element: T) => boolean,
  priority: (element: T) => number = () => 0,
): T | undefined {
  const find = (selector: string) => [...query(selector)]
    .filter(isVisible).sort((a, b) => priority(b) - priority(a))[0];
  return find(step.selector) ?? (step.fallback ? find(step.fallback) : undefined);
}
export const EDITOR_TOUR_STEPS: EditorTourStep[] = [
  { id: 'project', title: 'Todo empieza en tu proyecto', body: 'Este menú reúne archivos, ajustes y exportación. El video se guarda como proyecto local: podés cerrarlo y volver a editarlo.', selector: '[data-tour-target="project-menu"]' },
  { id: 'chat', title: 'Contale qué querés hacer', body: 'Escribí en el chat o adjuntá material y referencias. Podés seguir mandando indicaciones mientras trabaja. Tu borrador queda intacto durante este recorrido.', selector: '[data-tour-target="chat-message"]', fallback: '[data-tour-target="left-tab-chat"]' },
  { id: 'model', title: 'Elegí con quién editar', body: 'Este selector cambia el modelo y el esfuerzo del próximo mensaje. Las conexiones y los modelos visibles se configuran en Modelos e IA.', selector: '[data-tour-target="model-picker"]' },
  { id: 'voice', title: 'También podés dictar', body: 'El micrófono convierte tu voz en texto para el chat. Si todavía no está disponible, conectá Groq en Configuración; podés revisar el texto antes de enviarlo.', selector: 'button[data-tour-target="dictation"]' },
  { id: 'assets', title: 'Tus archivos, a mano', body: 'En Assets están los videos, fotos y audios del proyecto. Arrastralos al chat para dar contexto o a la timeline para colocarlos en una escena.', selector: '[data-tour-target="left-tab-assets"]' },
  { id: 'preview', title: 'Mirá el resultado acá', body: 'Esta es la previsualización del video. Usá los controles de abajo para pausar, avanzar o ver el cuadro exacto que querés corregir.', selector: '.syka-preview-surface', shortcut: 'Espacio: reproducir o pausar' },
  { id: 'point', title: 'Señalá qué hay que mejorar', body: 'Pausá en el momento elegido y activá este botón. Señalá una tarjeta, texto o motion editable y explicá el cambio. No separa elementos que ya están grabados dentro de un video.', selector: '[data-tour-target="visual-select"]' },
  { id: 'capture', title: 'Una captura da contexto', body: 'Marcá una zona del cuadro para adjuntar su imagen y una nota. Revisá las notas antes de enviarlas al chat; podés describir exactamente qué querés cambiar.', selector: '[data-tour-target="visual-capture"]' },
  { id: 'timeline', title: 'Ajustá el ritmo del video', body: 'La timeline muestra cuándo aparece cada clip. Seleccionalo para moverlo o recortarlo. El cabezal indica el momento que estás viendo.', selector: '#timeline-canvas', shortcut: 'Ctrl + B: dividir en el cabezal' },
  { id: 'library', title: 'Probá recursos y referencias', body: 'En Biblioteca encontrás subtítulos, motions, logos, sonidos y skills. Previsualizá cada recurso antes de usarlo; también podés pasarlo al chat como referencia.', selector: '[data-right-sidebar] [data-tour-target="right-tab-library"]', fallback: '[data-right-sidebar]' },
  { id: 'properties', title: 'Los detalles de cada elemento', body: 'Seleccioná un clip o componente y abrí Propiedades. Ahí ajustás estilo, posición, animación o audio según el elemento seleccionado.', selector: '[data-right-sidebar] [data-tour-target="right-tab-properties"]', fallback: '[data-right-sidebar]' },
  { id: 'undo', title: 'Probá cambios con tranquilidad', body: 'Deshacer y Rehacer recuperan cambios de edición. Para revisar una corrección del agente, mirá el resultado en el mismo segundo antes de seguir.', selector: '[data-tour-target="undo"]', shortcut: 'Ctrl + Z: deshacer' },
  { id: 'export', title: 'Revisá y exportá', body: 'Reproducí el video y escuchá el audio. Cuando esté listo, tocá Exportar arriba a la derecha y elegí dónde guardar el archivo. Este recorrido no inicia una exportación.', selector: 'button[data-tour-target="export"]' },
];
