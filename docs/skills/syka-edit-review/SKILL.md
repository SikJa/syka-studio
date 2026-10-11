---
name: syka-edit-review
description: "Comprobar calidad de una edición o export de Syka con revisión proporcional: cortes, captions, composición, audio y correspondencia con el pedido."
---

# Revisión proporcional

Usá la verificación que resuelva el riesgo del cambio. No conviertas un ajuste reversible en una ceremonia de aprobación.

- Cambio de texto: captura durante su aparición; lectura, contraste y encuadre.
- Cortes: límites antes/después, palabra completa, pausas y continuidad; revisar captions/sonido asociados.
- Motion: momentos de entrada, máxima superposición, lectura y salida.
- Audio: pista real, niveles y tiempos; una captura visual no prueba calidad audible.
- Mix exportado existente: leer `syka-local-audio/references/sound-layer.md`; usar `syka_audio_review` para LUFS/true peak reales y fingerprints de los cues principales contra sus assets procesados. Convertir eventos al reloj del export y escuchar timecodes. Un match es candidato, no aprobación; no exportar sin pedido para correr QA.
- Edición amplia: contrastá con el brief y distribuí muestras; reproducí un draft cuando haga falta evaluar ritmo/mezcla completa.
- Export solicitado: comprobá archivo no vacío, streams, dimensiones/duración y muestras del mismo source revision usado para la preview.

## Crítica creativa de una pieza completa

Para motion de varios beats o una mejora amplia, leé [references/motion-evidence.md](references/motion-evidence.md). Usá `syka_motion_review` sobre el export nativo del proyecto para generar contact sheets, cuadros consecutivos y lectura a 360 px; abrí sus imágenes y corregí defectos con tiempo/evidencia. No confundas generar evidencia con haberla revisado.

Para un lanzamiento o motion exigente, usá dos o tres rondas cuando el presupuesto lo permita. Un ajuste menor necesita menos. Guardá observación concreta → corrección → nueva evidencia; una nota alta o un build verde no sustituyen mirar el resultado.

1. **Concepto y lectura:** ¿se entiende el beneficio sin leer un párrafo? ¿Hay evidencia visual del producto? Mirá cuadros al tamaño de entrega y una preview reducida representativa de su canal. Corregí copy, jerarquía, contraste, márgenes, objetos pequeños y composiciones repetidas antes de decorar.
2. **Movimiento y sonido:** inspeccioná costuras, entradas, máximo solapamiento, holds y salidas. ¿La mirada tiene un destino? ¿El objeto llega con el peso esperado? ¿El sonido coincide con la acción y deja espacio a voz/música? Detectá desaceleraciones dobles, cortes sin relación, captions apurados y SFX repetitivos. Un hold, un fade o un corte limpio puede resolver mejor la escena.
3. **Reproducción y entrega:** revisá el conjunto para juzgar ritmo, comprobá saltos hacia atrás/adelante y muestras del export. Confirmá duración final, fuentes/assets resueltos, nodos que no desaparecen a 16 s y edición accesible de texto/logo/audio. Usá el mismo source revision para comparar.

Elegí dos o tres problemas de mayor impacto por ronda y resolvelos; evitá cambios laterales infinitos. Si la evaluación es de skills/modelos, conservá primera versión y versión corregida con el mismo brief y material. Una diferencia de presupuesto o número de intentos debe quedar explícita.

Conservá un checkpoint antes de reemplazos estructurales y el resultado aprobado anterior hasta revisar el nuevo. Usá el historial existente; no dupliques infraestructura de Remotion/El Mago. Diferenciá lo aplicado, capturado, escuchado por una persona y exportado. Informá limitaciones concretas sin afirmar que compilar equivale a editar bien.
