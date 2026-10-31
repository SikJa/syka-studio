# Adjuntos del composer — revisión del video

Referencia: grabación Whispera del 6 de octubre de 2026, 16:29:31, 110,4 segundos. Se revisaron 14 fotogramas y se transcribió el audio con Groq usando la credencial existente. La primera petición con tiempos por palabra fue rechazada por sus tiempos inconsistentes; la petición de texto sin tiempos dio la transcripción utilizada. No se inventaron marcas temporales.

La indicación del video sustituye el agrandado anterior al pasar el mouse: las referencias mantienen el tamaño compacto, y con más de cuatro se distribuyen por el ancho disponible. Se conserva la profundidad, el difuminado y las transiciones de entrada/salida; el hover levanta la pila ligeramente sin cambiar su escala. Un clic sobre cualquier tarjeta visible abre la referencia elegida.

El composer ahora prepara los archivos soltados mediante la misma ruta usada al seleccionar/pegar archivos, conservando tipo MIME, tamaño y miniatura. Los documentos usan una portada compacta con extensión y nombre dentro de la misma pila. Esta portada identifica el archivo; no es un visor del contenido completo del documento. La ruta del archivo original sigue disponible para el agente.

Las previsualizaciones no se eliminan al desmontar el composer por cambiar de pestaña o de ubicación del chat.

Validación real en Electron: seis adjuntos, imágenes soltadas sobre el chat y el composer, documento Markdown, texto del borrador conservado, ausencia de las tarjetas viejas, seis referencias visibles, escala de hover igual a uno, clic físico sobre una tarjeta posterior abriendo la referencia correcta, cierre con Escape, cambio de pestaña y vuelta sin perder las imágenes. Sin mensajes enviados ni errores de JavaScript.

Evidencias: `output/playwright/chat-drop.json`, `output/playwright/attachment-stack-final.png`, `output/playwright/attachment-video-transcript.txt`.
