# Subtítulos y motores: estado del 1 de octubre

## Corrección comprobada

`media_transcribe` guarda `{ segments: [...] }`, mientras que el renderer leía ese JSON como si fuera un array nativo. El lector de captions ahora acepta ambos formatos, conserva los tiempos reales y rechaza segmentos/palabras malformados. SRT/VTT mantienen su parser.

Además, los siete decoders de captions iniciaban su lectura asincrónica sin entregar una promesa al render offline. La captura/export podía dibujar antes de tener texto. Ahora playback agrega esa espera a FramePromises y hace seek al tiempo solicitado después de cargar. Los errores de lectura se muestran como SourceError en vez de una promesa rechazada sin manejar.

El chat integrado carecía de una vía para leer las referencias que las instrucciones upstream pedían consultar: shell deshabilitado y lectura de fuente acotada al proyecto. Se agregó `syka_read_reference`: Markdown de los docs incluidos, sólo lectura, máximo 256 KiB, chequeo de ruta real y rechazo de escapes. Electron pasa su docsDir al host; Codex tiene la herramienta y las instrucciones para consultar captions.md antes de editar y verificar check/capture durante palabras reales.

## Validación real

- Proyecto del usuario: `silent-sunset-29-sep`. Se conservó video, efecto y animación. Se agregó una capa `syka-captions-real`, preset classic, debajo visualmente en la escena pero después del video en el orden de dibujo, usando `03 Assets reutilizables/Transcripciones/subtitulos-20261001-1790889666124.json`.
- Edición realizada por SourceTools y journal compartido, con backup y Deshacer; evidencia `output/playwright/captions-fix/edit.json`.
- Capturas reales de la escena a 2, 5 y 10 segundos, carpeta `90 Descartable/Previews/QA-subtitulos-20261001-v3`. Se inspeccionó visualmente texto "de" a 2 s y "un" a 10 s.
- Export real: `02 Finales/QA-subtitulos-20261001.mp4`, 1920x1080, 11.3667 segundos, H.264/AAC, 14,183,102 bytes. Se decodificó el MP4 a 2 s con media_grab y se verificó texto dentro del archivo final. Check sin issues.
- 23 tests de parser, fuente/referencia, transcripciones, política y transporte aprobados. TypeScript runtime, agent-chat y desktop aprobados; build desktop aprobado. App reiniciada con el nuevo host y abierta.
- No se volvió a pedir transcripción ni consumir Groq. La nueva herramienta de referencia está cubierta por test y incluida en el host construido; no se ejecutó un nuevo turno real de Codex para esta corrección.
- El playhead del usuario sigue en 0.93 s y la primera palabra comienza a 1.20 s: es correcto que no haya subtítulo antes de ese tiempo.

## Qué está habilitado en Codex

Inspección por MCP: context, check, capture, fonts, media_probe, media_grab, media_filmstrip, media_waveform, media_transcribe. Edición por herramientas dinámicas SourceTools con SHA/journal; búsqueda web y generación nativa de imágenes según cuenta, herramientas de navegador público aislado. No se habilitó todo el catálogo Diffusion: modelos cloud, generación/listen/watch con proveedores Diffusion no están conectados. Export MCP existe para CLI pero no está expuesto al chat. Modificar composición no está limitado a cortes: puede escribir nodos y efectos soportados por el reconciler, consultando su documentación.

## Recomendación de arquitectura, no implementada

Conservar el motor Diffusion para timeline/preview/edición interactiva. Agregar FFmpeg en Electron main como trabajos acotados de preparación: proxies de material pesado, conversión de formatos no soportados, filtros de audio y salidas específicas. No traducir toda la composición a filtros FFmpeg: requeriría mantener paridad de escenas, fuentes, shaders, HTML y animaciones entre dos renderers.

Remotion sirve para composiciones React por fotograma y permite un ecosistema distinto de motion graphics; no es intercambiable con los nodos Diffusion. Una integración futura puede renderizar una composición como asset o diseñar intercambio de proyecto, aclarando qué propiedades quedan editables. No hay integración nueva Remotion/FFmpeg ni benchmark de rendimiento en esta entrega.

Fuentes primarias: https://www.remotion.dev/docs/the-fundamentals, https://www.remotion.dev/docs/shapes, https://ffmpeg.org/ffmpeg-filters.html. Código local: packages/runtime, packages/encoder, packages/reconciler y packages/agent-chat.
