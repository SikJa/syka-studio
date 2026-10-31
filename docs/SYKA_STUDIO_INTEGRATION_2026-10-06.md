# Estado integrado de Syka Studio — 6 de octubre de 2026

Se recompiló el código actual del editor web, la aplicación de escritorio, el host de agentes y el CLI. Se reinició únicamente el launcher verificado de Syka Studio, conservando el runtime principal y los proyectos existentes. No se actualizaron dependencias a ciegas ni se crearon nuevas ediciones del video comparativo.

## Adjuntos en el chat

El panel completo acepta archivos además de las referencias de biblioteca. Los archivos se preparan por la ruta de adjuntos existente, con imagen de previsualización y ruta accesible al agente; las carpetas conservan su semántica. El destino se captura antes de preparar el archivo para que cambiar de conversación no coloque el adjunto en otro borrador. La mezcla mantiene el texto existente y deduplica por la clave de adjunto.

Validación real en Electron, sobre el proyecto aislado de comparación: dragover/drop aceptados sobre el panel del chat, una imagen adjunta con previsualización y ruta, borrador conservado, sin enviar mensajes y sin errores de JavaScript. Evidencia: `output/playwright/chat-drop.json`. Esta prueba usa un evento de arrastre programático; la interacción física desde Explorer queda disponible para probar en el editor principal.

## Zernio

Las dos conexiones OAuth estaban en el runtime del worktree `publicacion-zernio`; el runtime principal tenía una lista vacía. Se recuperaron las credenciales mediante descifrado y cifrado con las claves propias de cada perfil. El traspaso de la credencial en claro fue únicamente entre procesos locales en memoria; no se registró en logs ni en archivos. Se conservó una copia del estado anterior y no se reemplazó el perfil ni sus cookies.

Ambas conexiones fueron verificadas mediante el servicio de publicación de Syka: identidad vigente y dos cuentas por conexión. El editor principal reiniciado confirmó las dos conexiones configuradas, sin error y con almacenamiento seguro habilitado. Evidencia: `output/playwright/updated-studio.json`. No se publicaron videos.

## Validación y límites

- TypeScript web y escritorio: aprobados.
- Compilaciones web, escritorio/host y CLI: aprobadas.
- Pruebas de publicación: 22 aprobadas.
- Las advertencias del bundle sobre directivas `use client` y tamaño de los chunks siguen presentes; no bloquean la compilación.
- La comparación Diffusion/HyperFrames utilizó deliberadamente la misma dirección visual: demuestra reproducción del diseño, no una mejora creativa ni el techo de calidad de ninguno de los motores. Sigue pendiente mejorar el criterio de edición, la precisión del recorrido del logo y algunos subtítulos.
