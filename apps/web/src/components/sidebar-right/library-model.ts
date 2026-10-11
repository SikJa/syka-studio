import type { InspectorSection } from './inspector/inspector';
export const PROPERTY_SECTIONS: { id: InspectorSection; label: string }[] = [
  { id: 'basic', label: 'Básico' },
  { id: 'style', label: 'Estilo' },
  { id: 'effects', label: 'Efectos' },
  { id: 'animation', label: 'Animación' },
  { id: 'transition', label: 'Transiciones' },
  { id: 'audio', label: 'Audio' },
  { id: 'all', label: 'Todo' },
];
export const RESOURCE_DRAG_TYPE = 'application/x-syka-editor-resource';
export const RESOURCE_PREVIEW_DRAG_TYPE = 'application/x-syka-editor-resource-preview';
export type EditorResourceDrop = {
  id: string;
  targetId?: number;
  start?: number;
};
export function skillSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}
export function flowInstructions(
  name: string,
  steps: string[],
  preferences: string[],
): string {
  const slug = skillSlug(name);
  if (!slug || !steps.some((s) => s.trim()))
    throw Error('Poné un nombre y al menos un paso.');
  return `---\nname: ${slug}\ndescription: ${JSON.stringify('Flujo de edición: ' + name)}\n---\n\n# ${name}\n\nTrabajá sólo sobre el alcance indicado al ejecutar esta skill. Usá las herramientas reales de Syka y verificá el resultado en la composición principal. Conservá los medios originales y el historial de deshacer. No crees otro lienzo salvo pedido explícito.\n\n## Pasos\n${steps
    .filter((s) => s.trim())
    .map((s, i) => `${i + 1}. ${s.trim()}`)
    .join(
      '\n',
    )}\n\n## Preferencias de edición\n${preferences.length ? preferences.map((s) => '- ' + s).join('\n') : '- Confirmar el estilo a partir del proyecto.'}\n\nAl terminar explicá lo aplicado y cualquier paso que no se pudo realizar. No afirmes éxito sin verificarlo.\n`;
}
