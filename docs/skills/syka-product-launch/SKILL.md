---
name: syka-product-launch
description: Producir anuncios y demos de lanzamiento en Diffusion con producto real, doce criterios editoriales, voz sincronizada por palabras, sonido de microacciones, componentes editables y variantes elegidas desde el brief.
---

# Lanzamiento con una demostración real

Usá esta receta para presentar una app/producto o una función. Entrá por
`syka-motion-brief` y reutilizá respuestas, marca y decisiones aprobadas. Una
corrección no reinicia la entrevista. El anuncio principal comunica una promesa;
el recorrido largo y los clips por función desarrollan lo demás.

## Dirección y estructura

Elegí la profundidad según el pedido. Revisá las [doce reglas](references/twelve-rules.md)
en el plan y en la pieza real. Conservá los colores, radios y jerarquía del producto;
una superficie oscura es una dirección válida. Durante lectura puede seguir viva
la luz, textura u objeto secundario, sin mover el texto ni el control señalado.
No hace falta cortar cada segundo para mantener interés.

Cada demo registra `beat.demo`: `trigger`, `reaction`, `result`, `evidence`.
Usá funciones realmente disponibles y UI verificable. Los datos preparados son
de demostración; no inventes resultados, clientes, métricas o disponibilidad.
El campo evidence declara una fuente a comprobar, no certifica la función.

Compilá `syka_motion_plan` con `useCase:product-launch`. Devuelve el documento
extenso, prompts de ocho partes por escena, checklist de doce criterios pendientes
y vistas del mismo plan. Guardá todas las entradas de `documents` y el JSON;
reconciliá/versioná archivos aceptados. Para piezas breves usá `shortPrompts`;
para la pieza completa conservá `productionPrompt`. No escribas una segunda marca.

## Sonido y palabras

Preguntá música/efectos/voz/silencio si no está resuelto para esa pieza. El perfil
`brief.audio.microActions:detailed` añade acentos pequeños a clics, selección,
revelado y respuesta, con peso support; selective reserva acciones principales;
none omite esa capa. Agrupá ráfagas, variá timbre y dejá espacio a la voz. El
movimiento ambiental no necesita un click por pulso. No imponer sonido a un brief
silencioso. El agente puede elegir detailed cuando esa preferencia esté indicada
o delegada; debe registrarlo en el plan.

Si hay una toma elegida con timestamps de palabras, usá `narration` y `wordCue`:
leé [sincronización con voz](references/narration-sync.md). No estimar tiempos
desde el guion. Usá `syka-local-audio` para sonidos reales, ataques, mezcla y
escucha; la sincronización de palabras no genera voz ni prueba que se oyó.

## Componentes y variedad

Para un lanzamiento guiado por referencias o una mascota que acompañe la demo,
leé [lanzamiento guiado y personaje de marca](references/guided-launch-and-mascot.md).
Elegí ejemplos por función narrativa (hook, proof, turn, CTA) y vinculá cada gesto
al objeto, palabra o evento real que explica. Una mascota no obliga a usar cuatro
escenas ni reemplaza una demostración del producto.

Leé [recetas de demostración](references/demo-recipes.md). Incluye:
- estados antes/después: búsqueda→resultados, acción→preview, tarjeta→editor;
- foco y cursor unidos a un control real;
- portada/cierre legible con actividad ambiental opcional.

Copiá los TSX y `launch-time.ts` desde `examples/` al proyecto. Usan el reloj
absoluto de Diffusion, no CSS loops ni otro renderer. Pasá capturas/assets locales
copiados al proyecto, textos verdaderos y bounds medidos. Cambiá encuadre y receta
según la idea; no construir todas las escenas con la misma tarjeta. Dentro de un
html los textos se editan por props/fuente; si se necesitan Sources independientes
de texto, mantenelos como capas nativas afuera del componente.

## Revisión y entrega

Comprobá styleframes, transición de mayor riesgo, seeks ida/vuelta, lectura con
mute y audio real. Reutilizá `syka_motion_review` sobre un export solicitado y
disponible; las doce reglas siguen pendientes hasta tener evidencia observable.
Registrá timecodes/IDs, defecto y corrección, sin aprobar por metadatos.

`brief.deliverables` registra variantes elegidas (`kind`, `purpose`, resolución
opcional): master, vertical, poster, subtitles, silent-cut, feature-clip o loop.
Recomponé vertical; silent-cut es una variante intencional y conserva el audio
del master. No crear entregables no pedidos por cumplir una lista.

Procedencia y decisiones de adaptación: [sources.md](references/sources.md).
Esta receta se distribuye con Syka, usa Diffusion y no descarga films externos.
