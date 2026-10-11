---
name: syka-editing-basics
description: Editar videos en Syka con montaje, recursos y comprobaciones proporcionales al pedido. Usar para una edición general o para coordinar captions, audio y motion.
---

# Edición con Syka

La fuente JSX es el documento compartido con timeline e inspector. Leé skills/editor.md y la referencia del motor mediante syka_read_reference cuando necesites sintaxis. No uses APIs Remotion en esta composición.

## Criterio de trabajo

- Empezá por contexto, fuente, selección y material real. Respetá el alcance del pedido y la composición visible.
- Leé la receta persistente mediante `syka_editing_recipe read`. Reutilizá decisiones acordadas; para una edición amplia consultá `syka-editing-recipe` y conservá referencias/criterios reales. El pedido actual tiene prioridad y una receta vacía no bloquea editar.
- Para una edición amplia, guardá un brief corto con objetivo, formato, material, estilo y decisiones. Para un ajuste pequeño, resolvelo directamente.
- Organizá primero el montaje; luego sumá los textos, recursos y audio que ayuden a entenderlo. Separá capas con nombres útiles y sequences cuando faciliten editar.
- No deduzcas un corte solo de un silencio: puede ser una pausa, demostración o reacción. Cuando haya ambigüedad importante, proponé alternativas; el pedido de ejecutar una edición autoriza los cambios reversibles que necesita.
- Usá syka_resources para encontrar logos SVG, audio y referencias en las carpetas conectadas. Importá los archivos elegidos mediante assets. Un video de referencia no es una plantilla editable.
- Conservá originales. Para fuente existente, usá lectura con hash, edición y Deshacer compartido. Crear scripts/componentes con shell es válido; esos archivos no entran automáticamente en el historial de fuente.

## Especialidades

Cargá solo lo necesario, descubriendo su carpeta con syka_skills list:

- syka-captions: transcripción, agrupación legible y sincronía.
- syka-local-audio: sonido local, síntesis y mezcla.
- syka-motion-reference: reconstruir movimiento desde referencias.
- syka-edit-review: verificar una edición o salida.
- syka-explainer-edit: coordinar montaje, voz y gráficos en una explicación grabada o demo de pantalla.
- syka-editorial-motion: tarjetas, callouts y comparaciones con jerarquía y continuidad; ejemplos ejecutables para Diffusion, inspirados en HyperFrames y referencias editoriales.
- syka-faceless-explainer: explicaciones visuales sin footage del hablante.
- syka-media-use: planificación y resolución de recursos visuales y sonoros.
- syka-design-import: diseño/export de Figma o styleframe a capas editables.
- syka-motion-transitions: fluidez de transitions-dev adaptada al reloj nativo.

## Resultado

Comprobá el mayor riesgo del cambio: límites si cortaste, lectura si agregaste texto, duración y mezcla si agregaste audio. Usá check y capturas pertinentes; una captura no demuestra calidad sonora. No exportes todo para cada ajuste. Explicá brevemente lo aplicado, la evidencia y cualquier pendiente real.

El estilo del proyecto y del usuario manda sobre esta base. No conviertas preferencias de una persona en reglas universales.
