# Exportación, portada y textos — 6 de octubre de 2026

## Implementación

- `context/render.ts` registra sólo videos locales codificados con éxito. UI y DAPI comparten ese punto. Cancelación, error y salida sin video no registran una oferta.
- `desktop/post-export.ts` verifica archivo regular, tamaño/fecha estables y SHA-256 mediante streaming. Lee el helper real de `syka-content-package`; no crea una segunda memoria editorial.
- `projects/post-export.ts` conserva por proyecto el contexto del archivo y estado de presentación. **Ahora no** y la deduplicación por hash sobreviven a recargas. La acción manual queda disponible desde Propiedades aun sin escena seleccionada.
- La oferta espera a que cierre el recorrido inicial. Usa tokens de tema y respeta movimiento reducido.
- El botón explícito manda un texto breve y un JSON local nuevo en `.syka/chat-context/export-<uuid>.json`. Ese adjunto contiene skill, alcance, datos y procedencia como contexto del pedido del usuario, no como instrucción de sistema.
- Conserva modelo/chat existentes y no consume el borrador ni sus archivos. Un turno activo recibe el pedido en cola; una pregunta pendiente impide otro envío. Sin chat/modelo compatible, agrega frase y referencia al borrador sin crear una conversación. Reabrir un pedido todavía no enviado no duplica archivo ni texto.
- `observedSourceRevision` es la revisión vista después del export, no una certificación de qué fuentes se renderizaron. El hash identifica el entregable concreto. El contexto indica `humanReview: not-recorded`.
- No se publica, programa, sube ni genera una imagen paga al mostrar o aceptar la oferta. La preparación sigue la skill en el mismo chat; el criterio editorial y la aprobación humana son pasos separados.

## QA real de la interfaz y contrato del chat

Runner: `.runtime/ui-audit-runner.mjs`, con `SYKA_AUDIT_TARGET=post-export`. Electron y perfil aislados; Vite 5227; servidor principal 5188 intacto. Cada corrida crea un proyecto QA propio reabrible.

Tanda completa: **16 casos, cero errores de página**. Evidencia en `Pruebas Syka/resultados/post-export/results.json`.

| Caso | Evidencia |
| --- | --- |
| Export local exitoso | MP4 real 640×360, 2 s, audio AAC; hash y tamaño cotejados con disco |
| Oferta y recorrido | Espera mientras la invitación real está abierta; aparece al cerrarla |
| Tema y movimiento | Capturas claro/oscuro, superficie blanca correcta y transition-duration 0 s con preferencia reducida |
| Ahora no | Estado dismissed persiste tras recargar y no reaparece solo |
| Reapertura | Botón real de Propiedades abre la oferta sin seleccionar una escena |
| Sin chat | Conserva texto y archivo previo, suma frase corta y JSON; número de chats sin cambios |
| Repetir sin enviar | Borrador idéntico y un único archivo de contexto |
| Chat existente | Mismo chat y modelo, frase corta y ruta JSON; borrador y adjuntos previos intactos |
| Chat ejecutando | `queue.add` en vez de iniciar otro turno |
| Pregunta pendiente | Rechaza el nuevo pedido y conserva pregunta y borrador |
| Sólo audio | OGG real no genera una nueva oferta |
| Cancelación | Cancelar durante encode real devuelve canceled y no ofrece paquete |
| Fallo | Ruta de salida que es un directorio provoca error real y no ofrece paquete |
| Archivo cambiado | Modificar bytes después de exportar rechaza por SHA-256 diferente |
| Preferencia editorial existente | Helper real con offerMode manual suprime oferta; revisión de memoria no cambia |

Las peticiones de modelo/cola de esta tanda se interceptan sólo en el renderer descartable para comprobar el contrato sin gastar turnos. No se presenta esta prueba como una portada terminada por el modelo. El proyecto16 y la prueba editorial real pertenecen a una validación separada del agente principal.

## Dos errores encontrados al validar

### Promesas de assets después de cerrar el world

`Entity.isAlive()` consulta el registro global de Koota. Si una carga termina después de destruir su world, ese registro es null o puede reutilizarse. El chequeo ahora utiliza el world dueño de la petición (`isInitialized` y `world.has`) antes de inspeccionar la entidad o el token. Se aplica a resolución, imágenes DOM y sincronización de audio, sin tragarse fallos de assets de un proyecto vivo.

Regresión ejecutada contra el runtime real: resolución después de destruir, rechazo después de destruir y rechazo mientras sigue vivo. Los dos primeros se descartan sin error no controlado; el tercero conserva `SourceError: QA source failure`.

### Canvas negro después de taparlo

Se reprodujo después de Configuración: el loop seguía avanzando, los nodos eran visibles y el buffer conservaba aproximadamente 57 mil píxeles verdes, pero la captura de pantalla mostraba el canvas negro. Un readback lo hacía reaparecer, por lo que el fallo estaba en la composición de la capa de Chromium, no en la escena ni en el archivo exportado.

El canvas visible queda en una capa compuesta estable con `translateZ(0)` y `backface-visibility: hidden`. Además, `Engine.start()` reinicializa una vez su backing store al reanudar después de un stop; el siguiente RAF lo repinta con las mismas dimensiones, cámara y playhead. La guardia de `running()` sucede antes: llamar start sobre un motor activo no reinicializa nada. No se fuerza un readback por frame, no se cambia la duración o el contenido del proyecto y no se modifica el canvas offline.

El segundo caso se aisló en el primer export de un proyecto recién creado: antes había imagen y después la pantalla quedaba negra, pero `localTime` seguía en 0 (no en el final exclusivo), la cámara no cambiaba, el contexto no estaba perdido y el buffer todavía contenía la tarjeta. Reinicializar esa superficie recuperó la presentación. La regresión final agregó una imagen PNG real y texto sobre la tarjeta; los recortes completos de la pantalla antes y después son idénticos píxel por píxel, comparados **antes** de cualquier lectura del canvas. Se volvió a ejecutar la tanda post-export completa: 16 casos, cero errores. `results.json` conserva `previewScreenshot.samePixels: true`; `fresh-before-export.png` y `offer-dark.png` son la evidencia visual.

QA específico: **14 capturas**, incluyendo ocho cierres reales de Configuración alternando Claro/Oscuro, export real, cambio de tema y redimensionado. Antes de cualquier lectura de píxeles del canvas, se analizaron los PNG de la pantalla. La primera tanda sin foto conservó 56.918 píxeles verdes; la repetición con PNG verifica también imagen y texto. Fuente idéntica y cero errores de página. Evidencia: `resultados/post-export/preview-repaint-results.json` y `preview-*.png`. Runner: `SYKA_AUDIT_TARGET=preview`.

## Verificaciones y límites

Typecheck de web, runtime y desktop pasado. El canal desktop ya está compilado; la activación en el editor principal requiere el reinicio coordinado por el agente principal. No se hizo otro build de backend durante sus turnos reales.

Pruebas locales en Windows. No se certifica comportamiento gráfico en todas las GPU ni se sustituye la validación en Mac. Un MP4 codificado no demuestra corrección estética o auditiva. El estado de presentación depende del almacenamiento local del perfil; las decisiones editoriales permanecen en la memoria versionada del proyecto.
