/* The texts Message Actions uses, as in Syka Code (src/renderer/src/i18n/es.ts,
 * thread.actions) so the component is copied without changes. */
export const es = {
  thread: {
    actions: {
      good: 'Buena respuesta',
      bad: 'Mala respuesta',
      copy: 'Copiar mensaje',
      copied: 'Copiado',
      react: 'Agregar reacción',
      reaction: 'Reacción {emoji}',
      reply: 'Responder',
      more: 'Más acciones',
      readAloud: 'Leer en voz alta',
      stopReading: 'Dejar de leer',
      fork: 'Bifurcar chat',
      forkShort: 'Bifurcar',
      forkHint: 'Seguir en un chat nuevo desde aquí',
      save: 'Guardar mensaje',
      unsave: 'Quitar de guardados',
      regenerate: 'Regenerar respuesta',
      report: 'Reportar',
      searchEmoji: 'Buscar emoji',
      noEmoji: 'No se encontraron emojis',
      justNow: 'ahora',
      minutesAgo: 'hace {count} min',
      hoursAgo: 'hace {count} h',
      daysAgo: 'hace {count} d',
    },
  },
} as const;

export function fmt(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replaceAll(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
