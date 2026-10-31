# Biblioteca utilizable y estabilización — 04/10/2026

## Resultado y límites

Biblioteca → Sonidos permite preescuchar, arrastrar una variante a un instante de la timeline o usar «Agregar en el cabezal». El nombre visible se conserva en la pista; el archivo se copia a `assets/sounds` dentro del proyecto y la fuente JSX usa `sounds/<archivo>`. No hace falta pedirle al agente que inserte el recurso para usarlo manualmente. Logos y motions comparten el mismo protocolo de arrastre.

Esto mejora la función de la biblioteca; **no cambia el timbre de los efectos ni las bases musicales**. Sikora considera pobre su calidad. El siguiente frente debe escuchar, seleccionar y comparar recursos, con atribución/licencia portable, sin presentar una nueva síntesis procedural como calidad profesional automáticamente.

## Inserción nativa

- DataTransfer transporta un identificador opaco de una sesión local, nunca la ruta absoluta del recurso. Un identificador cancelado, ajeno o consumido no puede volver a importar.
- El cabezal, escena y proyecto se capturan antes de la copia asíncrona; si cambia el contexto, se cancela la inserción. La operación de historia no se mantiene abierta durante la copia.
- El drop usa la conversión existente de píxeles a frames con FPS, zoom y scroll. La guía «Soltar en … s» muestra el destino. Inserta una pista nativa en la escena activa; no introduce una semántica nueva para pistas Sequence anidadas.
- Sonidos comienzan en −12 dB; música y stems en −16 dB. Volumen y posición siguen editables. No se fuerza una duración ni se modifica el contenido del archivo.
- Cancelar el drag no copia ni cambia la fuente. Undo/redo corresponde a la inserción; una primera escena vacía puede deshacerse con una sola operación.

Implementación: `linked-resource-drag.ts`, `linked-resource-actions.ts`, tarjetas de Biblioteca, canvas/timeline, `insert-asset.tsx` y `new-scene.tsx`.

## Correcciones de estabilidad

1. **Export desde atajos y menú.** Usa la configuración persistida de la escena. Una configuración explícita enviada por el panel conserva prioridad; se evita reemplazar WebM por el MP4 predeterminado.
2. **Captions en límites.** Grupos/palabras usan intervalos `[inicio, fin)`. No conservan la palabra anterior justo en su final; se cubren gaps, seek, trim y rate con decoders reales a 24/30/60 FPS.
3. **Fuentes.** Cargas concurrentes comparten promesa por mundo/familia/source/estilo/peso. Sólo una carga exitosa entra en la lista, el fallo permite reintentar y no elimina otra fuente. Captura/export espera la promesa mediante el resolver existente. La regresión usa FontFace controlada, sin descarga real.
4. **Recetas.** El lock nuevo nace completo mediante hardlink atómico; recupera dueño confirmado muerto, nunca por antigüedad sola. Claims inmutables coordinan recuperadores y se comprueba ownership al reemplazar/liberar. Locks legacy vacíos/malformados se conservan con error explícito: no se borran a ciegas. Se probaron terminación de proceso real, concurrencia, CAS, backup y junctions.

5. **Apertura del chat.** El cliente antes descartaba eventos recibidos mientras esperaba el snapshot; podía perder un delta para siempre. Ahora entrega snapshot primero y drena eventos con secuencia posterior. Cada cola pertenece a una apertura/suscripción/socket concretos; se limpia al cerrar, reemplazar, desconectar, fallar o vencer el timeout. Se corrigió también el cierre que dejaba requests pendientes hasta timeout. Diez regresiones determinísticas cubren el fallo original, duplicados, callbacks reentrantes, reemplazo y reconexión; el caso principal se acreditó rojo→verde.

La prueba de interrupción del chat usa una barrera del harness fake para medir interrupt sin depender de sleeps. E2E emplea WebSocket real y un harness simulado; no consume un proveedor ni valida una edición del modelo.

## Evidencia actual

`../.runtime/library-drag-2026-10-04/verification.json` y `check.mjs`, desde la carpeta general Syka Clips:

- Aplicación Electron existente, renderer servido en 5188, control por Playwright/CDP. Proyectos nuevos aislados bajo `.runtime`; no se sobrescribió un proyecto del usuario.
- Gesto nativo de arrastre de **Barrido corto 3**: fuente persistida en **4,00 s**, volumen −12 dB, nombre visible y hash de copia iguales al original. Undo/redo verificados.
- Drop con zoom/scroll: **5,50 s**; este segundo gesto usa DataTransfer despachado por el test para controlar las coordenadas, no un arrastre manual nativo.
- Botón en cabezal y primer arrastre de **Base cálida** en proyecto vacío: correctos; −16 dB y una sola operación de undo para retirar la escena creada.
- Siete tests de protocolo/acción y 35 de export/fuentes/captions/transcript: **42/42**. No equivalen a un nuevo export audiovisual validado.

Suites completas finales: escritorio **183/183**, agent-chat **162/162**. TypeScript de web (incluido en build), escritorio, runtime y agent-chat pasó; builds de renderer desktop, main, preload, agent-host y native completaron. La build web conserva avisos conocidos de `use client`/sourcemaps y tamaño de chunks, sin errores de compilación. `git diff --check` pasó con avisos de normalización CRLF.

El renderer recibió los cambios por HMR. Se activó el nuevo bundle de agent-host reiniciando únicamente su utility process, identificado por el endpoint real y como hijo de la instancia Electron existente. Antes/después se leyeron **20 chats idle** mediante WebSocket y se comprobaron idénticos los hashes de sus metadata. No se reinició la aplicación ni se cambió el proyecto abierto. Evidencia: `.runtime/library-drag-2026-10-04/host-activation.json` desde la carpeta general. Esto acredita activación y preservación; no una nueva llamada al modelo.

La edición Liquid aprobada y sus medios/export no fueron modificados. No se realizó una publicación, programación ni llamada de generación de pago.

## Frentes de trabajo

El reparto canónico está en `../docs/PARALLEL_WORKSTREAMS_2026-10-04.md` (relativo a la carpeta general, no a este directorio).

- **Editor y estabilidad:** este checkout; conservar motor, UI, proyectos y cambios existentes.
- **Publicación y Zernio:** worktree propio. Su inventario está terminado; la conexión del Codex desktop fue leída, pero Syka aún no hereda ni implementa esa conexión. Faltan credencial/binding propios, borrador, export seleccionado, validación, upload, envío/programación, idempotencia y seguimiento. Ninguna publicación real fue realizada.
- **Recetas y calidad:** worktree independiente para bases públicas, planes por escena, ejemplos y evaluación de sonido. Mantener la skill privada de Claudio separada y no fijar una estética universal.

El onboarding y el instalador continúan postergados. La calidad requiere pruebas audiovisuales y decisión del usuario; la cantidad de recursos, tests o skills no la acredita.
