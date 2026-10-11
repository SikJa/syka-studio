import { VISUAL_SELECT_SHORTCUT } from '@/agent-chat/visual-target-state';
export const EDITOR_SHORTCUTS = [
  ['Espacio', 'Reproducir / pausar'], ['J / K / L', 'Retroceder / detener / avanzar'],
  ['A / D', 'Un cuadro atrás / adelante'], ['S / W', 'Un segundo atrás / adelante'],
  ['Inicio / Fin', 'Límites del video o área de trabajo'], ['Ctrl + Enter', 'Pantalla completa'],
  ['Esc', 'Salir de pantalla completa'], ['V / H', 'Seleccionar / mano'],
  [VISUAL_SELECT_SHORTCUT, 'Señalar componentes para el agente'], ['Shift + clic', 'Sumar un componente a la referencia'],
  ['F / R / T', 'Lienzo / rectángulo / texto'], ['Ctrl + B', 'Dividir en el cabezal'],
  ['Ctrl + Z', 'Deshacer'], ['Ctrl + Shift + Z', 'Rehacer'],
] as const;
export function platformShortcut(value: string): string {
  return document.documentElement.dataset.platform === 'darwin' ? value.replaceAll('Ctrl', '⌘').replaceAll('Shift', '⇧') : value;
}
