import type { SettingsPage } from '@/components/settings/state';

/** The pages of this release's story; the art for each lives in whats-new-art.tsx. */
export type WhatsNewPageId = 'gate' | 'music' | 'camera' | 'chats' | 'questions' | 'dock';

export interface WhatsNewPage {
  id: WhatsNewPageId;
  title: string;
  body: string;
  /** A pair of hues the hero glides to. */
  hues: readonly [number, number];
  link?: { label: string; settings: SettingsPage };
}

export const WHATS_NEW_PAGES: readonly WhatsNewPage[] = [
  {
    id: 'gate', hues: [350, 300],
    title: 'Control de calidad antes de entregar',
    body: 'El agente revisa tu video cuadro por cuadro: tramos vacíos, imagen congelada, textos cortados, tapados o encimados. Si algo falla, lo corrige antes de responderte.',
  },
  {
    id: 'music', hues: [28, 340],
    title: 'Música real de Mixkit',
    body: 'Para una pieza nueva busca temas en Mixkit, compara al menos tres, baja el elegido y anota la licencia. Componer música queda como último recurso.',
  },
  {
    id: 'camera', hues: [212, 268],
    title: 'Mejor cámara y encuadre',
    body: 'Capturas grandes que se leen en un teléfono, acercamientos que llegan al control que importa y cortes en movimiento. Si el producto queda chico en un cuadro vacío, te avisa.',
  },
  {
    id: 'chats', hues: [168, 228],
    title: 'Chats que abren al instante',
    body: 'El chat del proyecto se precarga apenas lo elegís y las imágenes viejas se ordenan en segundo plano. Los chats se nombran solos y cada herramienta muestra su nombre real.',
    link: { label: 'Ver tiempos en Diagnóstico', settings: 'diagnostics' },
  },
  {
    id: 'questions', hues: [262, 318],
    title: 'El agente vuelve a preguntarte',
    body: 'Con Claude, las herramientas para consultarte y revisar el video quedan siempre a mano: cuando falta una decisión, te pregunta en vez de adivinar.',
  },
  {
    id: 'dock', hues: [40, 200],
    title: 'Una barra del reproductor más clara',
    body: 'Pantalla completa, señalar y capturar se marcan mientras están activos, y cada botón muestra su atajo en un tooltip prolijo.',
  },
];
