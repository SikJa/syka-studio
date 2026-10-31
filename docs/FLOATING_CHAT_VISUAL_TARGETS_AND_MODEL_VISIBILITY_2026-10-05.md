# Chat flotante, referencias visuales y modelos — 05/10/2026

## Comportamiento entregado

El chat se puede desacoplar como panel flotante dentro del editor. Conserva conversación, borrador, cola, adjuntos y el composer compartido de Mirel. No crea una segunda sesión. El desacople no abre otra ventana del sistema operativo.

- Icono sin texto en la esquina derecha de la cabecera, en el espacio antes ocupado por «Syka». Acopla/desacopla con un clic; tiene trazo de 2 px, terminaciones redondeadas y un botón de 28 px con radio de 10 px. Las etiquetas accesibles y tooltip indican la acción. Se retiró el botón textual encima del composer; el clic derecho permanece como acceso secundario.
- Arrastrar la cabecera mueve el panel; sus controles no inician el arrastre. La esquina inferior permite cambiar tamaño, también con las flechas del teclado.
- Arrastrar hacia el borde izquierdo muestra **Soltá para fijar el chat** en una fila reservada arriba del composer, con texto claro, fondo neutro y transición `panel-reveal`. No se superpone a los mensajes. Al soltar, el chat vuelve al espacio de la barra lateral. Cancelar o perder la captura del puntero limpia el aviso.
- Posición y tamaño se guardan localmente y se limitan al tamaño de la ventana. Los bordes son redondeados.
- Se retiró el botón de ventana que el usuario rechazó. La transición usa 520 ms y la curva de `transitions-dev`; respeta movimiento reducido. Su copia visual es inerte y desaparece incluso cuando se interrumpen transiciones consecutivas. El chat real permanece montado.

En pantalla completa, el mismo chat pasa debajo del video con composer compacto e historial desplegable. Al salir, vuelve al panel flotante o a la barra lateral según su estado anterior. La altura del composer se mide para mantener los controles del video por encima de los adjuntos y del texto.

## Señalar componentes y capturar una zona

La barra del lienzo ofrece **Señalar componente editable** y **Capturar zona para el agente**. Activar el modo pausa el video. La selección usa la geometría, transformaciones, orden de dibujo y jerarquía real del motor; no intenta seleccionar DOM dentro de los píxeles del canvas.

Se puede señalar una tarjeta, un grupo, un texto o un elemento nativo de captions. El diálogo permite elegir un componente padre, explicar la modificación e incluir una captura. También se puede arrastrar una región del video, incluso si el contenido está grabado en el archivo original.

**Preparar en el chat** conserva el borrador, agrega la referencia y, si se solicita, un PNG local dentro de los adjuntos del proyecto. No envía un mensaje ni modifica la composición. La imagen se recorta desde el render limpio del motor, con un tamaño máximo de 1920 píxeles en su dimensión mayor.

La referencia contiene escena, momento/frame, tipo, nombre, Source, Key y contexto disponible de grupos/loops. `elementSnapshotSha256` describe el árbol autoral observado; no es un hash del PNG. Antes de adjuntar se revalidan proyecto, escena, tiempo, elemento y revisión. Si el contexto cambió durante la preparación, se rechaza el objetivo obsoleto. La instrucción pide al agente volver a leer el source antes de editar.

Un botón o un texto grabado dentro de un MP4 se puede capturar como referencia, pero no se convierte en un componente editable. El contrato específico de cue/palabra de captions y las acciones dedicadas de timeline/inspector siguen pendientes; la selección nativa entregada no equivale a esos flujos completos.

## Luz ambiente

En pantalla completa hay un control de luz ambiente. El efecto toma colores del video renderizado y los difumina detrás, con un hueco sobre el área de la imagen para mantener la preview original. Se puede apagar y su preferencia queda guardada.

Corrección posterior: la capa de ambiente cubre toda la pantalla, incluido el espacio detrás del composer y los controles. El lienzo mantiene su altura reservada; el hueco de la luz se calcula desde el rectángulo real del render hacia la capa completa. El fondo inferior usa el mismo color de la etapa del motor, también con el efecto apagado. Esto elimina el corte horizontal negro sin recortar ni teñir el video. QA nativo después de recargar: cobertura completa, fondo coincidente, hueco alineado, controles fuera del video, interruptor y borrador preservado; cero errores de página. TypeScript y build web aprobados. Evidencia: `output/playwright/fullscreen-bottom-result.json` y `output/playwright/fullscreen-bottom-after.png`.

Se muestrea una imagen de 96 × 54 a intervalos de 125 ms; con movimiento reducido se espacian a 500 ms. No se procesa en segundo plano cuando la página está oculta. El efecto sólo pertenece a la interfaz: no se exporta ni aparece en la captura del motor.

## Elegir modelos visibles

En **Configuración → Modelos e IA → Modelos visibles** se mantienen los controles por asistente y por proveedor de Hermes. Además, cada asistente con catálogo tiene una lista desplegable con búsqueda, un interruptor por modelo y **Mostrar todos / Ocultar todos**.

Las preferencias se guardan en este equipo por ruta de proveedor e ID exacto del modelo. Ocultar una variante en Antigravity no oculta ese ID en Claude directo. Los modelos nuevos aparecen por defecto, y las preferencias de modelos temporalmente ausentes se conservan. Ocultar modelos limita la elección en chats nuevos; los chats existentes mantienen su modelo y su identidad. No se desconectan cuentas.

Los modelos de Antigravity llevan su icono como marca principal, con un distintivo pequeño de Claude, Gemini u OpenAI. El composer muestra **vía Antigravity** y el menú explicita, por ejemplo, **Claude · vía Antigravity**. Claude directo conserva su propia marca. La ruta visual identifica la conexión; no promete disponibilidad de cuota.

## Verificación realizada

- TypeScript web y build web aprobados. Persisten los avisos existentes de `use client`, sourcemaps y tamaño de chunks.
- 16 tests aprobados en tres archivos seleccionados por Vitest, incluyendo filtros individuales, compatibilidad de preferencias y selección geométrica real del motor.
- QA dentro de la app Electron: clic derecho para acoplar/desacoplar, arrastre, cambio de tamaño, colocación final, transición de 520 ms, movimiento reducido y conservación del borrador. También se verificó pantalla completa, retorno al panel flotante, luz ambiente y su control.
- QA visual: selección de un texto nativo mediante Source, conservación del momento y del borrador, dos capturas PNG realmente guardadas. Ningún mensaje enviado.
- QA de modelos: interruptores individuales reales, controles de todos/ninguno, persistencia después de recargar y exclusión de modelos ocultos del menú. La marca y el texto de la ruta de Opus se verificaron en el composer y en el menú.
- QA de interrupciones: diez pares de acople/desacople en el mismo frame y cambios durante la animación. Al terminar queda un solo chat, sin copia visual residual ni borrador perdido.
- Graphify actualizado con 100 archivos de código públicos permitidos, extracción AST local y sin documentos, medios, credenciales ni llamadas cloud.

Evidencia local:

- `output/playwright/floating-visual-targets-result.json`
- `output/playwright/individual-model-visibility-result.json`
- `output/playwright/rapid-chat-docking-result.json`
- `output/playwright/visible-chat-placement-result.json`: icono en la esquina derecha de la cabecera, sin texto ni fila vacía en el footer, trazo de 2 px redondeado, acople/desacople real, arrastre, aviso legible, borrador preservado y movimiento reducido; sin errores de página.
- `output/playwright/chat-placement-header.png`: captura de la cabecera con el nuevo icono.
- `output/playwright/floating-chat-refined.png`
- `output/playwright/fullscreen-ambient.png`
- `output/playwright/native-component-reference.png`
- `output/playwright/model-visibility-settings.png`
- `output/playwright/antigravity-routed-models.png`

Estas pruebas validan interacción y contexto, no una nueva edición enviada a un proveedor. No se ejecutó una tarea de modelo ni se publicó contenido. Se restauraron proyecto, modelo, filtros y borradores originales después de las pruebas.
