/** Editorial criteria adapted from Amanda Sartini; evidence must come from the piece. */
export const LAUNCH_RULES = [
  { id: 'stage', criterion: 'Entorno tranquilo y producto protagonista; identidad y contraste legibles.' },
  { id: 'chapters', criterion: 'Capítulos orientan cuando hacen falta; duración según acción y lectura.' },
  { id: 'action-result', criterion: 'Demostrar disparador → reacción → resultado y respaldar cada función.' },
  { id: 'mute', criterion: 'Texto y demostración comprensibles también sin sonido.' },
  { id: 'opening', criterion: 'Primer cuadro real comunica producto/promesa y funciona como portada.' },
  { id: 'camera', criterion: 'Cámara dirige atención; controlar nitidez y mantener foco durante lectura.' },
  { id: 'callouts', criterion: 'Callouts señalan el control real y respetan escala, recorte y área segura.' },
  { id: 'audio-sync', criterion: 'Montaje y acciones coordinados con música/voz/ataques medidos según el audio elegido.' },
  { id: 'contrast', criterion: 'Contraste de luz, escala o densidad con propósito; actividad secundaria sin mover texto en lectura.' },
  { id: 'closing', criterion: 'Cierre muestra producto, mensaje y CTA respaldados por disponibilidad real.' },
  { id: 'vertical', criterion: 'Recomponer variantes solicitadas; comprobar lectura en cada destino.' },
  { id: 'truth', criterion: 'Datos de demo preparados y rotulados; capacidades reales, sin claims inventados.' },
] as const;
