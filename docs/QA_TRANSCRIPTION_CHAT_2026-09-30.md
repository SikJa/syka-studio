# Transcripción disponible para el chat

## Causa y corrección

El endpoint y el proveedor Groq funcionaban, pero `appServerArgs` exponía al Codex integrado únicamente un conjunto de herramientas de inspección. `media_transcribe` quedaba fuera de esa lista, de modo que el agente no podía invocarlo.

La herramienta ahora está incluida en la configuración del MCP de Syka para nuevas sesiones. Las instrucciones del agente explican cómo transcribir con la clave Groq propia, guardar un JSON nuevo y leerlo con `syka_read_transcript`. Ese lector es sólo lectura, paginado y acotado a `03 Assets reutilizables/Transcripciones` dentro del proyecto abierto. Conserva los tiempos devueltos por Groq, sin generar tiempos estimados. La escritura del JSON rechaza un destino que ya exista.

Reiniciar la app vuelve a crear la conexión Codex con estas herramientas; se conserva el historial local. No se habilitaron proveedores Diffusion ni escucha semántica directa de audio.

## Validación real

- Transcripción desde el CLI de la aplicación del archivo local de 11 segundos `2026-09-29 17-40-54.mp4`: 3 segmentos, 26 palabras, primer tiempo 1.20 s y último 11.14 s. La clave permaneció en Electron main. El resultado quedó en el proyecto del usuario, bajo `03 Assets reutilizables/Transcripciones`.
- Prueba con el mismo adaptador Codex y la suscripción del usuario, usando el modelo que la cuenta devolvió como predeterminado (`gpt-6.1-sol`). Proyecto QA separado, sin editar la composición del usuario. El agente llamó `mcp__syka__media_transcribe` y luego `syka_read_transcript`, ambas completadas, y respondió con el texto y los tiempos reales.
- La fuente del proyecto QA se conservó byte por byte. Se cerró la sesión auxiliar Codex al terminar.
- 25 tests focales de política, transporte, lectura de transcripciones y presentación aprobados. TypeScript de agent-chat y desktop aprobados. La protección de no sobrescribir también se verificó conservando un JSON anterior.

Evidencia: `output/playwright/transcription-chat/report.json`. Repetición opcional: `node output/playwright/transcription-chat/run.mjs`, desde la raíz del repo. Requiere la app real abierta, la suscripción Codex autenticada y una clave Groq ya configurada; puede consumir uso de esos proveedores. No ejecutarlo como test rutinario sin una tarea que autorice transcripción.

Los captions no fueron agregados automáticamente al proyecto del usuario durante esta corrección. Un próximo pedido en el chat puede reutilizar la transcripción al editar.
