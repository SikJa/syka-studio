# Referencias compactas para el agente · QA 2026-10-06

## Pedido revisado

Se revisó localmente la grabación `C:/Users/Sikora/Videos/Whispera/Compartir/af48ed5ee7d0fd00/Whispera-2026-10-06_19-51-14.mp4` y su transcripción adjunta. Watch se usó con backend local, sin transcripción remota ni subidas. El ejemplo de “layer” del video es el preset **Layer Blur** de la biblioteca derecha.

## Implementación

- Efectos, animaciones, transiciones, presets del inspector y recursos vinculados (motions, logos, sonidos) ofrecen **Usar con el agente** en el menú contextual.
- Un preset/recurso se guarda en `Attachment.reference`, separado del texto del usuario. El borrador conserva el texto existente.
- Fotos, documentos y referencias comparten la pila compacta. La miniatura de un preset se toma de su canvas real; las imágenes de recursos se limitan a 320 px para no retener el original completo en el borrador.
- Al abrir una referencia se muestran nombre, indicación, momento, selección, contexto completo desplegable y ubicación local cuando corresponde. Un documento ofrece su portada de archivo y “Mostrar archivo”.
- Al enviar, `prepareReferences` escribe un archivo local `referencias-syka.json` mediante el IPC real. El JSON incluye instrucciones, preset/valor, rutas, `componentPath`, `componentFiles`, `usage`, composición, tiempo y elementos seleccionados. No se descartan metadatos para simplificar la UI.
- La X usa un SVG simétrico centrado, con nombre accesible. Se puede quitar una referencia concreta desde la tarjeta o el detalle, sin borrar las restantes.
- Menú y detalle usan tiempos/easing de Transitions Dev, respetan movimiento reducido y restauran foco. El menú conserva su portal durante la salida; no depende de que una ventana ocluida emita `animationend` puntualmente.

## Comprobación real del agente

Instancia aislada: Vite **5260**, MCP **43280**, CDP **9430**. Proyecto: `.runtime/reference-ux-project`, ID `795351d5-8ef5-48dd-87bf-4bfe8180b422`.

Chat real: **cb11499c-7555-46a9-a775-ed7f3cfe48b5**.
Modelo: **Codex gpt-6.1-sol**, esfuerzo **xhigh**.

Se seleccionó la capa editable “Tarjeta de prueba”, se ubicó el cabezal en **2,4 s**, se adjuntaron **Brightness** y **Carrusel circular** por las acciones de biblioteca y se envió desde el composer visible. No se interceptó la conexión de este ensayo. El pedido indicó leer y confirmar, sin editar ni exportar.

El agente ejecutó **syka_files**, estado **done**, y confirmó:

- Brightness / `effect-brightness` / `effect` / `brightness`.
- Carrusel circular / `CircleGallery.mp4`.
- Composición `index.tsx:main`; tiempo **2,4 s**.
- Selección “Tarjeta de prueba”, source `index.tsx:qa-card`.
- `componentFiles`: `CircleGallery.tsx`, `motion-time.ts`, `README.md`.

La fuente del proyecto conserva una fecha de modificación anterior al envío real. El transcript sólo registra lectura, sin edición ni exportación. El agente aclaró correctamente que 2,4 s es el instante de la composición, no un rango de recorte del MP4 de muestra.

Evidencia: `.runtime/reference-ux-results/real-run.json`, `real-transcript.json`, `real-confirmation.txt`, `09-real-before-send.png`, `10-real-agent-confirmation.png`.

## Otras pruebas

- Menú contextual real de Layer Blur y captura de su canvas nativo.
- Arrastre con el mouse de un preset desde biblioteca al cuerpo del chat.
- Drops de PNG y PDF fuera del composer y dentro del composer.
- Pila mixta de seis adjuntos, apertura de una tarjeta trasera, eliminación exacta de un PDF y de una foto. El resto conserva sus claves.
- Centro del SVG de la X respecto de su botón: error medido **0 px** en ambos ejes.
- Flechas/Enter/Escape en la pila, retorno de foco, movimiento reducido del sistema.
- Manifesto escrito por IPC y leído de disco; selección e instrucciones completas.
- Handler real de Enviar con el último salto al host interceptado exclusivamente para simular un error: restaura texto y todas las referencias. Esta prueba de fallo es separada del ensayo real anterior, que no tuvo interceptor.
- Tres regresiones de modelo de datos: snapshot independiente de cambios posteriores, identificación de selección/tiempo, rutas y archivos del motion conservados sin confundir documentos comunes.

Resultados principales: `.runtime/reference-ux-results/qa-results.json` y `manifest-readback.json`. Scripts reproducibles: `.runtime/reference-ux-session.mjs`, `reference-ux-qa.mjs`, `reference-ux-real-agent.mjs`, `reference-ux-final-qa.mjs`.

El cierre de QA pasó también `keyboard-theme-results.json`: foco y cierre del menú con teclado, entrada de 250 ms y salida de 150 ms, conservación del borrador y las referencias al desmontar/remontar la vista, y movimiento reducido configurado en la app. El chequeo de tipos de web y el de desktop terminaron con código 0; las tres regresiones de `reference-attachments.test.ts` pasaron.

Las pruebas de teclado esperan que Kobalte establezca el foco en la acción, además de que aparezca el menú. En una ventana Electron ocluida, enviar Enter inmediatamente después de comprobar sólo visibilidad puede adelantarse a ese foco diferido; los primeros ensayos de ese atajo de QA fallaron y se conservan como diagnóstico. El turno real utilizó el menú con teclado y envío normal.

## Capturas

- `01-context-menu.png`: menú contextual de biblioteca.
- `02-reference-compact.png`: miniatura sin prompt/JSON en el composer.
- `03-reference-detail.png`: indicación y contexto al abrirla.
- `04-mixed-six-attachments.png`: seis fotos/documentos/referencias.
- `05-pdf-detail.png`: detalle de documento.
- `06-remove-button.png`: X centrada y eliminación individual.
- `07-native-motion-reference.png`: recurso editable con `componentFiles`.
- `10-real-agent-confirmation.png`: respuesta real de Codex.
- `11-light-reference-detail.png`: detalle de referencia con tema claro.

## Alcance y límites

- Los documentos PDF/MD usan una portada de archivo; no se agregó un render de páginas PDF ni un lector Markdown dentro del modal.
- Se preserva el borrador al cambiar de vista y al fallar un envío. No se agregó persistencia nueva del borrador completo al reiniciar la app; la persistencia de notas visuales es un circuito separado que no se modificó.
- No se modificaron proyectos 12–15 ni se reinició la instancia principal 5188.
- No se hicieron cambios al tour, al botón Exportar ni al onboarding.
