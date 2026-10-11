import { t } from '@/i18n';

export function homeGreeting(displayName: string, now = new Date()) {
  const name = displayName.trim().slice(0,80);
  const person = name ? `, ${name}` : '';
  const hour = now.getHours();
  const lines = hour >= 5 && hour < 12
    ? ['Buen día{person}. ¿Qué editamos hoy?', '¿Qué cocinamos hoy{person}?', '¿Qué creamos esta mañana{person}?']
    : hour >= 12 && hour < 20
      ? ['Buenas tardes{person}. ¿Qué armamos?', '¿Qué editamos esta tarde{person}?', '¿Qué cocinamos hoy{person}?']
      : ['Buenas noches{person}. ¿Qué creamos?', '¿Qué cocinamos esta noche{person}?', '¿En qué trabajamos esta noche{person}?'];
  // Stable while composing; changes with the local hour, not on every keystroke.
  return t(lines[(now.getDate() + hour) % lines.length]).replace('{person}', () => person);
}
