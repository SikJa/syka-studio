# Vista previa tras seek: auditoría de la prueba 14

Se revisaron los scripts y las capturas existentes, sin modificar el proyecto 14, su posición de reproducción, el turno en curso ni el motor. No se ejecutó otra sesión sobre la instancia que estaba exportando.

## Resultado observado

`scripts/editor-live.mjs` envía un click/tecla o toma un screenshot de CDP, pero no tiene una condición de espera para la decodificación. Que termine `Input.dispatchMouseEvent` no implica que el video ya haya presentado el fotograma elegido.

El ensayo posterior `scripts/verify-seek.mjs` espera 2200 ms después de cada cambio de playhead. En las capturas `review/seek-settled/`:

- A 4,3 s y 8,4 s, forward/backward son idénticas, incluidos el video y los gráficos.
- A 3,2 s, forward/backward son idénticas. La tercera repetición difiere únicamente dentro de los subtítulos: rectángulo `(253, 258, 341, 273)` de la captura 594 × 323. El resto del fotograma, incluido el video, es idéntico.
- En el ensayo anterior `review/seek/`, el salto a 8,4 s sí produjo una diferencia grande dentro de todo el video: `(221, 28, 373, 295)`. Esa diferencia desaparece en el ensayo con espera.

Se inspeccionó también la captura nativa de 8,4 s: coincide visualmente con el video de la prueba posterior, considerando que la captura nativa tiene otra resolución y no incluye los márgenes del editor.

## Lo que explica el código

- `setPlayhead` actualiza el reloj, no espera a la decodificación.
- En modo realtime, `VideoBuffer.seekTo()` devuelve `undefined`, encola el trabajo y permite mantener el último canvas mientras llega un frame nuevo. `toBitmap()` acepta temporalmente un frame cercano, hasta cuatro frames de tolerancia. En arrastres rápidos se muestra un keyframe y se programa la resolución exacta tras 120 ms sin nuevos saltos.
- `FramePromises.list` puede ser `null` en la previsualización. Que no tenga promesas no prueba que el frame esté decodificado: el decoder realtime no devuelve esa promesa.
- Captura/export usa `VideoExporter.seekTo()` asíncrono y espera el fotograma. Por eso una captura nativa correcta no valida por sí sola cuándo se actualizó el canvas realtime.

La evidencia disponible es compatible con latencia de la cola y una captura de prueba tomada demasiado pronto. No demuestra un frame incorrecto permanente ni permite atribuir una carrera concreta al producto. Tampoco prueba ausencia de fallos bajo todos los patrones de scrubbing: sólo los puntos observados.

## Siguiente verificación precisa

Para evaluar calidad/export, conservar `capture`, que tiene sincronización propia. Para medir la experiencia de seek, usar una prueba aislada que espere una condición de decoder y presentación, con timeout y diagnóstico, en vez de un sleep fijo: target solicitado, target presente en caché, `displayFrame` del target, canvas ya actualizado y dos frames de presentación. Registrar latencia separada de exactitud, incluyendo saltos rápidos, hacia atrás y después de que el buffer quede idle.

Queda pendiente aclarar la pequeña diferencia de subtítulos a 3,2 s. No se cambió el renderer ni se declaró aprobada una igualdad total de PNG en ese punto. Si aparece un target que nunca llega a presentarse incluso después de que termine su cola, se necesita ese estado y su secuencia de seeks para una regresión reproducible antes de corregir el motor.
