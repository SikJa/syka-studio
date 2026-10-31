# Memoria y preparación de contenido: conversación real

Prueba local en Windows, GPT-6.1 Sol xhigh dentro de Syka, con cuatro turnos reales y tres conversaciones. Instancia aislada Vite5248/MCP43282. Proyecto reabrible `Pruebas Syka/16-memoria-y-contenido`; los ejemplos se etiquetaron explícitamente como QA, no preferencias de la marca del usuario.

## Resultado

1. **Guardar.** El agente registró propósito, destino y referencia omitida mediante `syka_onboarding_memory`, y volvió a leerlos. Revisión3 en `.syka/editing-preferences.json`.
2. **Cerrar y reabrir.** Otra conversación recuperó propósito/destino y no repitió la pregunta sobre referencias. Leyó la skill `syka-content-package`, consultó su memoria y preguntó sólo por el estilo de portada/textos que todavía no estaba definido.
3. **Respuesta explícita.** En esa misma conversación se definió una marca de prueba, portada con fotograma real/título blanco y copy rioplatense sin emojis ni hashtags automáticos. Guardó y releyó el helper existente `.syka/content-memory/history/000001.json`; no escribió preferencias globales.
4. **Reabrir otra vez.** Una tercera conversación recuperó exactamente ese estilo y distinguió lo no acordado (título concreto, tipografía y encuadre). No volvió a preguntar por el estilo.

Todas las llamadas observadas terminaron correctamente. El montaje no fue modificado, no se generaron imágenes, no se llamó un proveedor de publicación y no se enviaron contenidos a una red. La prueba demuestra lectura/escritura/reanudación con este modelo y estos casos; no demuestra que cada proveedor vaya a elegir correctamente todas sus preguntas.

## Evidencia

En `Pruebas Syka/resultados/`:

- `memory-dialog-result.json`: revisión y decisiones guardadas.
- `content-memory-result.json`: conversaciones posteriores.
- `memory-dialog-guardar.json`, `memory-dialog-reabrir.json`, `memory-dialog-estilo.json`, `memory-dialog-recuperar-estilo.json`: prompts, tools y respuestas reales.
- `16-memory-*.png`: capturas de las conversaciones en Electron.

Runner reproducible del ensayo: `.runtime/verify-memory-dialog.mjs`, y segunda mitad con `--content`. Usa runtime propio y no modifica los chats de usuario. La posterior copia controlada de las conversaciones permite abrirlas en la aplicación principal; los cursores privados de QA se descartan y se conserva el historial visible.

## Cómo probarlo manualmente

Abrí proyecto16, elegí un chat de «Memoria real» y pedile: «Cambiemos sólo el destino a YouTube Shorts; mantené lo demás». Cerrá/reabrí el proyecto y preguntá qué recuerda. El propósito y la referencia omitida deben conservarse. Son decisiones del proyecto16: un proyecto distinto debe resolver su propio contexto.

Para contenido, pedí cambiar sólo un criterio de la portada. La memoria guarda ese cambio con evidencia y revisión, sin imponer nuevamente todos los temas. El vínculo automático desde export es otro frente y tiene su informe separado; esta prueba ejercita la conversación y la persistencia reales.

## Export real y entrega de derivados en el mismo chat

El proyecto16 se exportó con Diffusion a `02 Finales/prueba-contenido.mp4`: 6 s, 1080×1920, H264/AAC. Decodificación completa con FFmpeg pasó. La oferta post-export envió una frase corta y su contexto local al chat existente `64a0bb00-21e8-45a4-96d9-29b5a49f9be0`, usando GPT-6.1 Sol xhigh. El primer borrador creó SVG y PNG con fotograma real; el entorno privado no tenía clave de Groq y dejó el texto provisional. Ese ensayo se interrumpió antes de la entrega final.

La continuación recuperó una transcripción ya existente del mismo archivo original, comprobó su SHA-256 y el tramo 8,2–14,2 s, y preparó **v2** sin alterar los diez archivos de v1, el video ni el montaje. El título «Subtítulos y motions» y los textos se apoyan en las palabras existentes; la frase final incompleta no se reconstruyó. Entregó preview adjunta, SVG editable y dos descripciones en esa misma conversación. El evento real `turn.completed` registró `status: completed`; evidencia en `resultados/content-package-real-completion.json`, `content-package-real.json` y `16-content-result.png`.

Los artefactos quedan en `03 Assets reutilizables/Contenido/prueba-de-memoria/export-234a72f4-v2/`, con revisión técnica, procedencia y borradores. El estilo se reutilizó desde la memoria existente. No se aprobó el paquete como criterio estético, no se verificó una cuenta externa y no se publicó. El cierre manual de la instancia QA ocurrió después del evento completed; el aviso de cierre del runner no fue un fallo del turno del modelo.
