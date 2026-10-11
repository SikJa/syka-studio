---
name: syka-faceless-explainer
description: Crear una explicación sin hablante en pantalla con texto, diagramas y recursos reales en Diffusion. Usar para piezas explicativas narradas o sin voz; una demo grabada usa syka-explainer-edit.
---

# Explicar mediante imágenes

Leé la receta y el material real. Una explicación puede ser narrada o solo visual: no agregues voz porque el nombre del workflow upstream la presupone.

Leé `syka-visual-direction` para convertir la marca/referencia en `frame.md`, beats y decisiones reutilizables. La dirección especifica cómo se demuestra cada idea; no es un listado de efectos. Si el usuario sólo quiere ajustar una escena, conservá la estructura y las decisiones del resto.

- Identificá una pregunta y su respuesta. Organizá beats por ideas, no por una cuota fija de escenas o tarjetas.
- Elegí cómo demostrar cada idea: relación mediante diagrama, dato mediante gráfico, cambio mediante antes/después, procedimiento mediante una pantalla. Asegurá contenido correcto y fuentes para cifras.
- Diseñá un frame resuelto: foco, contraste, espaciado, jerarquía, identidad de los objetos y estado siguiente. Leé `syka-editorial-motion` y adaptá sus componentes. No repitas el mismo rectángulo con otro título.
- Construí segmentos/capas dentro de la composición activa. Los beats del storyboard no requieren nuevas composiciones independientes.
- Movimiento causal: una entrada explica origen; un enlace muestra relación; una transformación conserva el objeto. Usá `syka-motion-transitions`; pausas, cortes y movimiento lineal también sirven.
- Si hay voz existente, los beats siguen su tiempo y respiración. Para voz nueva, elegí un proveedor realmente disponible y autorizado; no inventes audio a partir del transcript. Sin voz, calculá la lectura con el contenido real.
- Usá `syka-media-use` para assets y `syka-captions` si corresponden subtítulos. Leé los contratos de HTML, surface y reloj de Diffusion cuando el gráfico los necesite.

Probá un segmento representativo, luego ampliá. Revisá un hold y la transición más cargada al tamaño de entrega. Compará el mismo tiempo después de retroceder y en una muestra exportada; audio y duración se comprueban aparte.

Inspirado en `faceless-explainer`, storyboard y diseño de [HyperFrames](https://github.com/heygen-com/hyperframes). Renderiza con Diffusion; no importa videos prerenderizados por HyperFrames.
