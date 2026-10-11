---
name: syka-slideshow
description: Diseñar una presentación por diapositivas o convertirla en video editable dentro de Syka, conservando marca, ritmo de lectura y revelados por idea.
---

# Presentación y video son entregables distintos

Confirmá desde el pedido si se busca un video de diapositivas o un deck navegable. No prometas un presenter mode integrado a Syka: no existe ese contrato nativo. Si está claro que quiere video, avanzá sin preguntar de nuevo. Una presentación interactiva puede entregarse como HTML local separado si fue solicitada; no se convierte en función del editor por crear ese archivo.

Leé la receta y `syka-visual-direction`. Construí un argumento con títulos concretos, una idea principal por estado y evidencia legible. Conservá texto exacto, fuentes de datos y marca. Usá un layout por tipo de información: comparación, proceso, dato, imagen o resumen. No fuerces toda la presentación al mismo rectángulo.

Para video, traducí cada diapositiva a un grupo/secuencia nombrado dentro de la composición actual. El fondo y elementos persistentes conservan identidad; los revelados siguen la lectura o la voz. Leé JSX/sequence/timing y `syka-motion-transitions` para su implementación real. Mantené todos los elementos editables y no importes un MP4 generado en otro motor.

Para deck HTML separado, usá navegación de teclado accesible, índice y notas sólo si hacen falta; deshabilitá animación automática para movimiento reducido. Indicá el archivo y el modo de abrirlo, diferenciándolo del video. No afirmes exportar ramas/hotspots a MP4 ni que la timeline maneja interactividad.

Comprobá texto, contraste, avance y tiempo de lectura. Para una variante video, comprobá además duración y transiciones en preview/export.

Adaptación original de `slideshow` de HyperFrames; la presentación navegable upstream no está portada al runtime Diffusion.
