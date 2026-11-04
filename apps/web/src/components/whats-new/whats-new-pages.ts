import type { SettingsPage } from '@/components/settings/state';

/** The pages of this release's story; the art for each lives in whats-new-art.tsx. */
export type WhatsNewPageId = 'recipes' | 'plan' | 'offer' | 'liquid' | 'steer' | 'skills';

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
    id: 'recipes', hues: [350, 300],
    title: 'Recetas para cada tipo de video',
    body: 'Una receta guarda cómo hacés un tipo de video: formato, ritmo, cámara, sonido y reglas. Arrancás con tres de fábrica: lanzamiento, YouTube y vertical.',
  },
  {
    id: 'plan', hues: [212, 268],
    title: 'Un plan por video',
    body: 'El agente arma el video fase por fase: brief, material, historias, escenas y construcción. No entrega como listo sin un plan completo y un control de calidad aprobado sobre la versión final.',
  },
  {
    id: 'offer', hues: [28, 340],
    title: 'Tu receta mejora con cada video',
    body: 'Cuando el agente entrega un video, Syka te ofrece guardarlo como receta tuya o sumarle las correcciones que pediste. Elegís qué mejoras guardar.',
  },
  {
    id: 'liquid', hues: [190, 230],
    title: 'Tarjetas Liquid Glass',
    body: 'Nueva skill para videos a cámara: vidrio con refracción real sobre tu toma, cifras con su fuente, frases, pasos y placa. Todo queda editable y nunca te tapa la cara.',
  },
  {
    id: 'steer', hues: [262, 318],
    title: 'Corregí a Claude mientras trabaja',
    body: 'Lo que escribís durante un turno de Claude entra en ese mismo turno. Sus preguntas ya no se cortan al minuto: espera tu respuesta.',
  },
  {
    id: 'skills', hues: [168, 228],
    title: 'Skills y flujos, ordenado',
    body: 'La biblioteca muestra tus skills y las bases que podés usar directamente. Las guías internas del agente siguen funcionando sin llenarte la lista.',
  },
];
