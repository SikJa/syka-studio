import type { SettingsPage } from './state';

export type SettingsSectionInfo = {
  id: SettingsPage;
  label: string;
  description: string;
  icon: string;
  /** What the search finds besides the name: the titles of its options. */
  keywords: readonly string[];
};
export type SettingsGroupInfo = { label: string; sections: readonly SettingsSectionInfo[] };

/**
 * Settings in Syka Code's order: Preferencias, Agentes, Trabajo, Aplicación
 * and Avanzado. Page ids stay the ones the app already opens (`groq`,
 * `codex`, `plugins`), so every existing link keeps working.
 */
export const SETTINGS_GROUPS: readonly SettingsGroupInfo[] = [
  { label: 'Preferencias', sections: [
    { id: 'general', label: 'General', description: 'El espacio de trabajo, los chats y los permisos de Syka.', icon: 'settings', keywords: ['títulos', 'chat', 'steer', 'archivar', 'contexto', 'densidad', 'bandeja', 'enviar'] },
    { id: 'profile', label: 'Perfil', description: 'Tu nombre, tu foto y tu avatar, guardados en este equipo.', icon: 'user', keywords: ['nombre', 'foto', 'avatar'] },
    { id: 'appearance', label: 'Apariencia', description: 'Color de acento, tema, movimiento y escala de la interfaz.', icon: 'theme', keywords: ['tema', 'acento', 'movimiento', 'escala', 'cursor', 'densidad', 'oscuro', 'claro'] },
    { id: 'chat', label: 'Chat', description: 'Selector de modelos y material del cuadro de mensaje.', icon: 'settings', keywords: ['modelo', 'esfuerzo', 'composer'] },
    { id: 'notifications', label: 'Notificaciones', description: 'Avisos cuando un chat termina, pregunta o necesita tu atención.', icon: 'bell', keywords: ['avisos', 'sonido', 'escritorio'] },
    { id: 'shortcuts', label: 'Atajos', description: 'Accesos rápidos para configurar, editar y revisar.', icon: 'keyboard-shortcut', keywords: ['Ctrl', 'teclado'] },
  ] },
  { label: 'Agentes', sections: [
    { id: 'codex', label: 'Cuentas', description: 'Conectá tus asistentes y elegí cómo editar.', icon: 'agent.codex', keywords: ['Claude', 'Codex', 'Antigravity', 'Hermes', 'motores', 'cuentas', 'modelos'] },
    { id: 'providers', label: 'Proveedores', description: 'Modelos de otros servicios y de tu PC (Ollama, LM Studio) en Claude Code y Codex.', icon: 'waypoints', keywords: ['OpenRouter', 'DeepSeek', 'API', 'clave', 'modelos'] },
    { id: 'groq', label: 'Voz y transcripción', description: 'Los subtítulos de tus videos y el dictado: Groq, OpenAI, Codex o un servicio compatible.', icon: 'captions', keywords: ['Groq', 'Codex', 'Whisper', 'dictado', 'voz', 'micrófono', 'idioma', 'transcribir', 'subtítulos'] },
    { id: 'plugins', label: 'MCP', description: 'Servidores MCP que amplían las herramientas del agente.', icon: 'ai-mcp-cli', keywords: ['servidores', 'plugins', 'herramientas'] },
    { id: 'skills', label: 'Skills', description: 'Tu biblioteca de flujos reutilizables de edición.', icon: 'sparkles', keywords: ['recetas', 'flujos'] },
    { id: 'tools', label: 'Herramientas', description: 'Herramientas locales, grabación y dependencias.', icon: 'settings', keywords: ['FFmpeg', 'Python', 'yt-dlp', 'grabación'] },
  ] },
  { label: 'Trabajo', sections: [
    { id: 'brand-kit', label: 'Brand kit', description: 'Identidad, colores y voz de tu marca.', icon: 'visual', keywords: ['marca', 'colores', 'logo'] },
    { id: 'glossary', label: 'Glosario', description: 'Nombres y términos para tus transcripciones.', icon: 'captions', keywords: ['términos', 'nombres'] },
    { id: 'zernio', label: 'Zernio', description: 'Conexiones y cuentas para publicar tus videos.', icon: 'external-link', keywords: ['publicar', 'redes'] },
  ] },
  { label: 'Aplicación', sections: [
    { id: 'storage', label: 'Almacenamiento', description: 'Espacio disponible, limpieza automática y conservación de archivos.', icon: 'navigation.folder', keywords: ['caché', 'papelera', 'limpieza'] },
    { id: 'diagnostics', label: 'Diagnóstico', description: 'Uso de la app, proveedores y tamaño del historial, sin datos privados.', icon: 'settings', keywords: ['rendimiento', 'memoria', 'CPU'] },
  ] },
  { label: 'Avanzado', sections: [
    { id: 'help', label: 'Acerca de', description: 'Versión, recursos y ayuda para trabajar con Syka.', icon: 'help', keywords: ['ayuda', 'versión', 'novedades'] },
  ] },
];

export function sectionInfo(page: SettingsPage): SettingsSectionInfo {
  for (const group of SETTINGS_GROUPS) {
    const found = group.sections.find(section => section.id === page);
    if (found) return found;
  }
  return SETTINGS_GROUPS[0]!.sections[0]!;
}

const normalize = (text: string) => text.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase();

/** Groups with only the sections that match the search (accents and case aside). */
export function filterSettings(groups: readonly SettingsGroupInfo[], query: string): readonly SettingsGroupInfo[] {
  const needle = normalize(query.trim());
  if (!needle) return groups;
  return groups
    .map(group => ({ ...group, sections: group.sections.filter(section => [section.label, ...section.keywords].some(text => normalize(text).includes(needle))) }))
    .filter(group => group.sections.length > 0);
}
