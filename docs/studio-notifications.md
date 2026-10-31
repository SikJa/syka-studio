# Avisos de escritorio de Syka Studio

Integración del diseño aprobado de `preview-v3.html`: orbe real transparente, mensaje negro compacto, borde transparente, acento solo en el punto y el contador. El panel crece al acercar el puntero y permite responder preguntas con el composer, el botón liquid metal y el dictado nativos de Syka.

## Eventos conectados

| Aviso | Señal de origen | Acción |
| --- | --- | --- |
| Pregunta | `request.opened` del host, incluido un chat que no esté visible | Respuesta directa al request y chat originales, por texto o dictado; varias preguntas se responden por pasos |
| Proyecto listo | `syka_delivery`, `status: ready` | Abrir proyecto y chat originales |
| Nueva versión | `syka_delivery`, `status: review` | Abrir proyecto y chat para revisar |
| Exportación lista | Resultado exitoso del render unificado de interfaz/DAPI, archivo existente | Mostrar el archivo guardado en el Explorador |
| Bloqueo / archivo faltante | Turno fallido, error estable de compilación/carga, exportación o descarga fallida, `syka_delivery blocked` | Abrir el proyecto que necesita atención |
| Sesión vencida | Error de autenticación de un agente o rechazo de la clave de Groq durante transcripción | Abrir la configuración del proveedor |
| Transcripción terminada | Audio completo, todos los chunks unidos y correcciones del glosario aplicadas | Abrir el proyecto; el dictado corto del composer no genera otro aviso |
| Descarga terminada | Importación del video con archivo, procedencia y biblioteca ya confirmados | Abrir el proyecto que recibió el video |
| Análisis largo terminado | Herramientas de análisis de audio, revisión de motion/audio, referencias de video o grafo que tardaron al menos diez segundos | Abrir el proyecto y chat del análisis |

Un final de turno común no anuncia que el proyecto está terminado. La entrega `ready` requiere un artefacto no vacío dentro del proyecto y archivos de evidencia de revisión. Esto verifica existencia y pertenencia de archivos: la calidad visual/auditiva sigue siendo responsabilidad de las revisiones del arnés. `review` permite anunciar una versión que todavía debe revisarse.

## Uso del arnés

`syka_delivery` está disponible a través de las herramientas compartidas por los adaptadores de agentes. Ejemplo:

```json
{
  "status": "ready",
  "message": "El motion está listo y la revisión de audio y video está guardada.",
  "artifact": "src/main.tsx",
  "evidence": ["qa/review.json"]
}
```

La llamada no exporta el proyecto. `review` requiere `artifact` pero no evidencia. `blocked` solo requiere `message`, que debe explicar qué falta para continuar.

## Comportamiento

- Los avisos se acumulan por identidad de operación/proyecto. Repetir un evento no duplica el aviso ni el sonido.
- La ventana es transparente, sin entrada en la barra de tareas, se muestra sin tomar foco y usa el nivel Always on Top `screen-saver`, reforzado al mostrarla o cambiar el foco de una ventana de Syka. La pila tiene scroll cuando supera el área disponible del monitor.
- En Windows, `setShape` delimita el mensaje, orbe, contador y scrollbar: los huecos transparentes quedan fuera de la región nativa de entrada. El viewport es estable durante la animación para evitar mover el punto bajo el mouse. Las regiones se actualizan durante entrada, expansión, scroll y resize; no hay polling en reposo. Otras plataformas conservan el mecanismo de eventos de mouse reenviados.
- Pasar por el orbe o el mensaje despliega el mismo panel. En Windows recibe el mouse sobre las regiones nativas; otras plataformas contemplan además los mensajes `mousemove` reenviados por Electron. No depende exclusivamente de `pointerenter`. El espacio transparente debajo del orbe no captura clics. Al salir, se contrae tras 280 ms si no hay borrador, fotos, preparación de adjuntos, foco ni dictado activo.
- El orbe conserva el proyecto, carpeta y chat. Antes de navegar, el editor verifica la identidad del proyecto y registra su carpeta existente si el host lo inició desde la CLI. No recrea carpetas borradas.
- Ocultar una pregunta no responde ni cancela. Resolverla desde otro chat/ventana limpia el aviso. Las preguntas no secretas pendientes se restauran al reiniciar el host.
- Las preguntas privadas se responden solo dentro del editor; su contenido no se previsualiza en el escritorio.
- El WAV de aviso se incluye en el build, dura 0,23 s y usa la versión más fuerte aprobada. Respeta la preferencia de sonido desactivado y sustituye el aviso duplicado del chat en Electron.
- El canvas del orbe comparte un reloj de 24 fps y mantiene la animación mientras hay avisos visibles. Respeta movimiento reducido y libera el reloj cuando no hay canvas. `backgroundThrottling: false` evita que Electron frene las animaciones al cambiar a otra aplicación; se eliminó la pausa de diez segundos. El composer y sus efectos solo se montan mientras el panel está abierto.
- El renderer de avisos se prepara oculto al iniciar Syka, antes de la primera pregunta. La ventana se muestra cuando su contenido y región nativa están preparados. `NoticeSnapshot.desktop` permite comprobar visibilidad, Always on Top, throttling y cantidad de rectángulos de entrada sin inspeccionar mensajes privados.
- Las respuestas rápidas aceptan fotos, videos MP4/MOV/WebM/MKV y archivos TXT desde el botón +, pegado de archivos del portapapeles y arrastre sobre el mensaje/orbe o composer. Conservan el composer negro compacto, controles cuadrados de 28 px, dictado y envío con liquid metal. Las miniaturas de fotos/video y el icono TXT son de 32 px con radio de 8 px, tienen una × para quitar y muestran el nombre al pasar el mouse. El video usa un fotograma fijo; no reproduce ni ocupa un visor grande. La presentación normal del composer sigue siendo el carrusel y su selector también admite video/TXT.
- Los adjuntos y el borrador permanecen al cambiar entre preguntas y al contraer/reabrir el panel. Se puede enviar texto, archivos o ambos. Una respuesta sin texto indica que se usen los archivos como referencia. Durante la preparación se bloquea el envío; un error conserva los adjuntos y el texto anteriores.
- Las opciones de cada pregunta son botones compactos. Una pregunta simple permite una selección; una pregunta con `multiSelect` permite varias. Otro clic desmarca la opción. La selección habilita el envío sin exigir texto, se puede acompañar con comentarios y fotos, y se conserva al volver a la pregunta anterior. Seleccionar no envía automáticamente.
- Se permiten cuatro archivos y 150 MB por respuesta: 25 MB por foto, 100 MB por video y 5 MB por TXT. El proceso principal verifica firma y decodificación de PNG/JPEG/WebP/GIF y limita dimensiones. FFprobe verifica que el video tenga un stream de video real y un contenedor compatible, y FFmpeg genera la miniatura con acceso limitado a archivos locales. El TXT admite UTF-8, UTF-16 con BOM y Windows-1252; se rechazan controles binarios y su contenido no se monta como HTML. Guarda una copia completa en `03 Assets reutilizables/Adjuntos` del proyecto original, incluso si el archivo viene de otra carpeta o del portapapeles; las referencias no dependen de la carpeta temporal del sistema.
- Si Electron no decodifica WebP o GIF, FFmpeg genera únicamente la miniatura PNG; el original conserva todos sus bytes. Usa el resolvedor de dependencias portable existente, sin descargas ni rutas de máquina fijas. El proceso de miniatura tiene límites de memoria/salida y un timeout de ocho segundos.
- El overlay sólo intercambia IDs opacos de fotos propios de esa pregunta. No recibe acceso a escritura arbitraria de archivos. Se verifica pertenencia al proyecto, límites y disponibilidad antes de responder; las preguntas privadas no admiten adjuntos desde el escritorio. Quitar una foto elimina únicamente la copia preparada por este flujo. Las copias enviadas permanecen como referencias del chat.
- Las fotos viajan con la respuesta al chat/request originales, también al continuar una pregunta cuyo turno ya terminó. Se registran en la conversación y se entregan como referencias de archivos locales usando el contrato existente de los agentes; los adaptadores conservan las opciones seleccionadas y agregan el contexto de archivos. Esto no certifica que todos los modelos tengan visión: el agente debe inspeccionar los archivos con las herramientas que tenga disponibles.
- Los avisos funcionan mientras Syka está abierto, también minimizado. Cerrar la aplicación mantiene el comportamiento actual de salida; esta integración no introduce modo de bandeja. El historial de avisos de operaciones vive en memoria, no se restaura después de salir.

## Verificación

- Typecheck y build de web, escritorio y host.
- Tests de deduplicación, restauración de preguntas, respuesta al host original, filtrado de razonamiento, clasificación de autenticación y entrega desde archivos reales.
- Tests existentes del puente de herramientas y de llamadas/cola de preview.
- `node scripts/qa-studio-notifications.mjs`: 12 comprobaciones pasaron en Electron aislado con main, preload, HTML y assets de producción. El proveedor y la respuesta Groq están simulados en el bundle de prueba; el compilador resuelve las dependencias locales del repositorio, ya que la fixture no es un instalador con recursos staged. Comprueba geometría, foco de ventana, dictado con micrófono virtual, respuestas al request original, categorías, acento, dos proyectos/chat, borrador al contraer, navegación, sonido incluido y cierre del overlay. No modifica proyectos del usuario ni llama proveedores pagos.
- Pasaron 22 tests del arnés y 8 de la cola/llamadas del renderer. Se reinició la instancia normal de Syka conservando perfil y carpetas; se verificó el título, la carga del editor, el handler de avisos, el acento real y el host operativo.

Evidencia local: `output/question-notification-20261010/native-evidence/qa.json` y capturas junto al archivo. Las pruebas de fixtures no equivalen a una exportación, una descarga o una transcripción pagas hechas por un proveedor real.

### Corrección del hover de escritorio (2026-10-10)

La corrida nativa anterior usaba hover de CDP: no verificaba el recorrido del mouse de Windows sobre una ventana sin foco. El video del usuario mostró que faltaba ese caso y el orbe no abría el panel.

- `node scripts/qa-notification-hover.mjs`: seis comprobaciones pasaron en Chromium headless con el componente React real y el puente nativo simulado: `mousemove` sin `pointerenter`, apertura desde el orbe, cruce hacia el mensaje, salida y recuperación del modo click-through, preservación del borrador y geometría aprobada.
- Se volvió a compilar web para escritorio y la instancia normal recibió el módulo actualizado por Vite. No hizo falta reiniciar Syka.
- Se registraron eventos reales de mouse en la instancia Electron aislada. El control del escritorio se interrumpió con Esc; el recorrido automatizado completo sobre una ventana sin foco queda pendiente. La prueba aislada se cerró. Evidencia parcial: `output/notification-hover-20261010/after/qa.json`; regresión completa del renderer: `output/notification-hover-20261010/headless-regression.json`.

### Regiones nativas, Always on Top y animación en segundo plano

- Tres tests de `notification-shape.test.ts` verifican huecos transparentes, bordes redondeados, clipping al viewport, coordenadas fraccionales y límites de entradas.
- Typecheck de escritorio y build web para escritorio pasaron.
- La nueva corrida `qa-studio-notifications.mjs` pasó 16 comprobaciones en Electron con proveedor/micrófono/Groq de prueba: Always on Top real, regiones de entrada activas, throttling desactivado y dos muestras distintas del canvas después de doce segundos sin foco ni entrada del mouse, además de composer, dictado, respuesta al host, navegación, eventos y cierre. El aviso estuvo disponible 345 ms después de su creación en esta fixture; no es una medición del tiempo de respuesta de un proveedor real.
- El gesto de Windows y el cambio entre aplicaciones mediante Computer Use se interrumpieron con Esc. Los hovers de CDP y los flags nativos no constituyen por sí solos una validación de ese recorrido físico.

### Fotos y opciones en la respuesta rápida

- `qa-notification-photos.mjs` pasó seis comprobaciones del componente real con puente de carga simulado: selección simple y múltiple, envío sin texto, dimensiones/alineación, errores sin perder borrador, conservación entre preguntas y envío conjunto de respuestas/IDs.
- `qa-studio-notifications.mjs` pasó 24 comprobaciones con main/preload/renderer/host reales y proveedor FakeHarness: selector, pegado y arrastre; PNG/JPEG/WebP/GIF; rechazo de contenido inválido e IDs desconocidos; eliminación; respuesta sólo con fotos; copia completa duradera y entrega al contexto original; botones seleccionables, además de las regresiones anteriores de avisos. La ventana de esta fixture se coloca fuera de pantalla para evitar carreras entre el mouse físico del usuario y CDP. No certifica el recorrido físico entre aplicaciones ni una respuesta multimodal de un proveedor pago.
- Pasaron 17 tests de notificaciones/arnés, cinco tests de límites de imagen/regiones nativas y los typechecks/builds de web, escritorio y host. Las evidencias nuevas están en `output/notification-photos-20261010/renderer-qa.json` y `output/question-notification-20261010/native-evidence/qa.json`.

### Video y TXT

- La corrida ampliada de `qa-studio-notifications.mjs` pasó 28 comprobaciones. Genera videos reales MP4/MOV/WebM/MKV con FFmpeg, carga cada formato por IPC nativo, verifica sus miniaturas y eliminación, y envía video+TXT sin texto. Comprueba los bytes originales guardados y las rutas que recibe FakeHarness. También rechaza un falso MP4 y datos binarios renombrados a TXT conservando los adjuntos anteriores.
- Pasaron siete tests de regiones/dimensiones/contenedores/texto, 17 tests del host, seis comprobaciones del renderer y typecheck/build de escritorio/web. La captura `native-question-files.png` muestra las dos referencias de 32 px con el mismo composer. Estas comprobaciones usan el proveedor de prueba; no certifican el análisis del video por cada modelo.
