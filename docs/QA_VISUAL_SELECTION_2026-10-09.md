# Selección visual y pendientes del video de Whispera

## Cambios integrados

- Ctrl + Shift + S abre o cierra «Señalar componentes» dentro del editor, también desde el composer. El atajo aparece en la barra de preview, el listado de atajos y el menú + del chat. No actúa dentro de otros diálogos.
- Shift + clic suma componentes a una misma referencia. El botón + del panel permite sumar sin modificador. Se pueden quitar componentes individualmente; cada texto HTML conserva su source y selector propios, aunque tenga el mismo contenido que otro.
- Los contornos señalan cada componente, mientras la captura abarca el conjunto. La selección conserva el instante del video y rechaza referencias si cambia la escena, el cuadro o alguno de los componentes.
- El panel mide hasta 300 px de ancho; el composer y la captura son más compactos. «Volver a marcar» está en la cabecera. Se retiró el aviso «Se guarda como nota, sin enviarla».
- Se puede guardar una captura sin indicación. En ese caso queda como contexto, sin inventar una orden de edición.
- «Enviar notas» usa directamente el envío existente del chat. El composer también acepta las notas con el mensaje vacío. El envío conserva las notas si falla y las retira después de la aceptación del host; mantiene la cola y las restricciones de las preguntas pendientes.
- Proyectos incluye paginado, contador y búsqueda en toda la lista; la pantalla ya no oculta definitivamente los proyectos posteriores al onceavo.
- Ayuda incluye el Discord proporcionado por Sikora.
- Storage muestra bytes y cantidad de archivos por proyecto, total y espacio libre en el disco de cada carpeta. Usa las ubicaciones registradas en este equipo, sin rutas fijas de desarrollo. Omite enlaces simbólicos, deduplica rutas y señala carpetas no disponibles o mediciones parciales. Los archivos enlazados desde otras carpetas no se incluyen.

## Verificación

- TypeScript de web y desktop: aprobado.
- Pruebas de medición de carpetas, referencias vacías y selección nativa: aprobadas.
- `scripts/qa-html-text-picker.mjs`: escena aislada real en Chromium, con dos textos «HACÉ», hover/clic, escala y rotación, selección múltiple, eliminación y agregado, atajo desde textarea, captura sin mensaje, rechazo de referencias desactualizadas y envío desde el panel y el composer. La escritura de adjuntos usa un bridge simulado; no se toca un proyecto del usuario ni se envía un turno a un modelo.
- `scripts/qa-selection-settings.mjs`: Electron oculto con perfil propio, UI y bridge nativos. Comprueba 24 proyectos en tres páginas, búsqueda fuera de la página actual, Discord y medición real de 24 carpetas con 300 bytes en total. Incluye pruebas de espacio libre.
- Syka se cerró normalmente y volvió a abrirse con el backend actualizado. La ventana y el servidor local responden. El editor queda a disposición del usuario; su aprobación visual y una edición real con el agente siguen siendo verificaciones del usuario.

Resultados: `output/playwright/html-text-picker/verification.json` y `.runtime/qa/selection-settings/verification.json`. Las cifras de esas pruebas son datos de las escenas aisladas, no el peso de los proyectos de Sikora.

## Estado del resto del pedido

- Grabación con el mecanismo de Whispera, audio del sistema, micrófono y transcripción: implementada en el trabajo anterior. La solicitud real al proveedor de transcripción requiere su cuenta configurada.
- Auditoría del peso del entorno: entregada; aproximadamente 7,9 GB instalados con los runtimes auditados. No es el tamaño de un instalador generado.
- Inicio de sesión para importación de YouTube: pendiente. El importador sigue informando los casos restringidos; aún no tiene conexión de cuenta para descargarlos.
- Limpieza de proyectos de prueba: pendiente de identificar sin ambigüedad el proyecto de 28 segundos que debe conservarse. Esta intervención no borró proyectos del usuario.
