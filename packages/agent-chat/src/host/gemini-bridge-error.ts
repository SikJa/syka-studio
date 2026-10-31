const messages: Record<string, string> = {
  conversation_mismatch: 'El chat de Gemini no coincide con el historial confirmado de Syka. No se mezclaron conversaciones ni se reenvió el contexto. Para reiniciar la prueba, abrí un chat vacío en la misma pestaña de Gemini.',
  user_interrupted: 'Gemini Web: el turno se detuvo al editar el mensaje o usar un control de envío, modelo o cambio de chat. Volvé a intentar desde Syka cuando termines esa acción.',
  request_cancelled: 'Gemini Web: el turno fue cancelado antes de completarse. No se reenvió el mensaje.',
  request_timeout: 'Gemini Web no terminó dentro del tiempo disponible. No se reenvió el mensaje.',
  model_unavailable: 'Gemini Web dejó de confirmar Argon. Revisá el selector de la pestaña y volvé a comprobar conexiones. No se eligió otro modelo.',
  input_rejected: 'Gemini Web no conservó el texto completo del mensaje. El puente frenó el envío para evitar una consulta incompleta.',
  draft_present: 'Hay un borrador en la pestaña de Gemini. Guardalo o vacialo antes de enviar desde Syka.',
  extension_unavailable: 'Se perdió la conexión con la extensión. Conectá la misma pestaña de Gemini y volvé a comprobar conexiones.',
  extension_outdated: 'Recargá la extensión Syka desde brave://extensions y conectá de nuevo la pestaña de Gemini.',
  page_not_ready: 'El puente no encontró un control de Gemini a tiempo. Revisá la pestaña; no se reintentó el envío.',
  new_chat_not_ready: 'Gemini no terminó de preparar el chat vacío. No se envió el mensaje.',
  send_button_unavailable: 'El mensaje quedó escrito en Gemini, pero el botón Enviar no apareció habilitado. No se envió.',
  send_not_acknowledged: 'El puente pulsó Enviar una vez, pero Gemini no confirmó la recepción. Revisá esa pestaña antes de repetir.',
  response_controls_unavailable: 'El editor o el selector desaparecieron durante la respuesta de Gemini y no volvieron a aparecer. No se eligió otro modelo.',
  authentication_blocked: 'Google pidió una comprobación o bloqueó el acceso en la pestaña de Gemini. El puente se detuvo.',
};

/** OpenCode can nest the bridge error as JSON in ACP data/details/message. */
export function geminiBridgeError(error: unknown): string | undefined {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const seen = new Set<unknown>();
  for (let visited = 0; queue.length && visited < 40; visited++) {
    const { value, depth } = queue.shift()!;
    if (depth > 7 || value === null || value === undefined || seen.has(value)) continue;
    seen.add(value);
    if (typeof value === 'string') {
      if (value.length <= 8000 && value.trim().startsWith('{')) {
        try { queue.push({ value: JSON.parse(value), depth: depth + 1 }); } catch { /* Not a structured bridge error. */ }
      }
      continue;
    }
    if (typeof value !== 'object') continue;
    const object = value as Record<string, unknown>;
    if (typeof object.code === 'string' && Object.hasOwn(messages, object.code)) return messages[object.code];
    for (const key of ['data', 'error', 'message', 'details', 'cause']) queue.push({ value: object[key], depth: depth + 1 });
  }
  return undefined;
}
