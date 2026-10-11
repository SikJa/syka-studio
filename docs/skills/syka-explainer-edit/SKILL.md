---
name: syka-explainer-edit
description: Editar una explicación grabada a cámara o en pantalla, coordinando montaje, voz, captions y gráficos que aclaren las ideas. Usar para talking-head, tutoriales y demos con footage real.
---

# Explicaciones con footage real

Leé `syka-editing-basics` para el motor y `syka-captions` si hay subtítulos. La grabación, la intención y el estilo de la persona determinan la edición; esta base no impone una estética.

## Del material al montaje

Este es el contrato nativo de **talking-head recut**. No prescribe cinco tarjetas ni un preset classic. Si el pedido es sumar gráficos sin recortar, preservá el footage completo; si pide recut, registrá cada tramo conservado y el motivo. Las escenas upstream se traducen a secuencias/capas de la composición actual.

- Conservá la grabación y el transcript crudo. Guardá las correcciones por separado, respetando sus intervalos. No uses una referencia ya editada como si fuera material crudo.
- Identificá la idea principal, las frases que la sostienen y los momentos donde una imagen ayuda. Un plan corto puede registrar `sourceIn`, `sourceOut`, `timelineStart`, recurso y evidencia verbal/visual.
- Separá montaje de decoración. Quitá una pausa o un arranque falso cuando mejore el sentido; mantené demostraciones, reacciones y respiraciones útiles. Revisá ambos lados del corte para no perder sílabas.
- Para pantalla y cámara, alineá por audio cuando exista, o por dos acciones visuales comprobables. Tratá cada toma con su propio encuadre.
- Antes de decorar, comprobá la tabla fuente→salida: intervalos reales, huecos retirados, velocidades y orden. Tras cada corte, remapeá captions y eventos sonoros; no uses el transcript cacheado del montaje anterior. `syka-captions/examples/recut-timing.ts` contiene una conversión ejecutable de intervalos por tramo.

## Dirección visual

Leé `syka-visual-direction` para construir una dirección de frame y beats a partir de marca y referencias. Conservá esa especificación junto a la receta; no repitas un cuestionario ya resuelto. Si se pidieron sólo overlays, el contrato de Talking Head Recut upstream conserva el metraje: no elimines silencios ni cambies frases por iniciativa propia.

- El hablante, el cursor o la demostración siguen siendo el foco. Ubicá gráficos donde haya espacio; reservá la zona de captions antes de componer tarjetas.
- Elegí el recurso según la información: una cifra verificable, una frase breve, un diagrama, un detalle de pantalla o una comparación. Evitá convertir cada frase en una tarjeta idéntica.
- Para mejorar tarjetas/callouts, cargá `syka-editorial-motion`: una frase puede conservar su ancla mientras se convierte en encabezado y abre evidencia. Sus ejemplos corren en Diffusion; adaptá formato y fases, no copies el mismo rectángulo en cada beat.
- Dejá tiempo para leer. Concentrá los cambios en puntos narrativos y alterná intervención con planos que respiren. Densidad y material visual se ajustan al formato y al estilo pedido.
- Diseñá llegada, permanencia y salida. La transición puede ser corta y suave; el objeto debe terminar quieto y legible. Para motion nativo consultá `syka-motion-transitions`.
- Los ejemplos de vidrio, acercamiento o acento de color son opciones de estilo, nunca defaults universales. Guardá decisiones aprobadas en el proyecto o en la skill personal.

## Audio y revisión

- La voz manda. Si sumás música, elegí volumen y ducking a partir de sus niveles reales; usá SFX en eventos puntuales y conservá la voz original. `syka-local-audio` cubre la síntesis local.
- Probá un fragmento corto representativo antes de ampliar una edición larga. Revisá entrada, lectura, salida y corte, además de `check`; una captura aislada no demuestra fluidez ni sincronía sonora.
- Revisá cuadros del MP4 exportado, límites de captions, duración y mezcla. Corregí problemas concretos y repetí la comprobación afectada. Un render exitoso no aprueba diseño.
- Entregá el proyecto editable y una muestra visible, explicando qué se verificó y qué requiere juicio del usuario. Con autorización para editar, completá la muestra sin crear una espera de aprobación artificial.

Una corrección señalada en el lienzo conserva instante, componente y captura. Usá Source/Key para releer el elemento y mantené el montaje aprobado; un pedido sobre una tarjeta no autoriza rehacer toda la pieza. Si varias notas se envían juntas, resolvelas por identidad y tiempo y reportá cada cambio o conflicto.
