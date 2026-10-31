---
name: syka-product-launch
description: Producir anuncios y demos de lanzamiento en Diffusion con producto real, doce criterios editoriales, voz sincronizada por palabras, sonido de microacciones, componentes editables y variantes elegidas desde el brief.
---

# Lanzamiento con una demostración real

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Demostrá funciones y UI reales, con trigger/reaction/result/evidence; no inventes resultados, clientes ni métricas. Una corrección conserva marca, consulta y sonido resueltos. Sólo se preparan las variantes elegidas.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Usá esta receta para presentar una app/producto o una función. Entrá por
`syka-motion-brief` y reutilizá respuestas, marca y decisiones aprobadas. Una
corrección no reinicia la entrevista. El anuncio principal comunica una promesa;
el recorrido largo y los clips por función desarrollan lo demás.

### Dirección y estructura

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

## Build

### Sonido y palabras

**Música, en este orden:** la pista que dio el usuario; si no hay, Mixkit con
`syka_mixkit action:search` (2–3 categorías por género y ánimo, compará al menos
tres temas por carácter, largo y cierre) y `action:download` del elegido; recién
si ningún tema encaja o el usuario pidió música original, `syka_music_create`,
diciendo qué categorías probaste. Medí los beats del tema con
`syka_audio_analyze` antes de animar y colgá cortes, clics y el logo de esos beats.

Para lanzamientos con música, leé
`syka-local-audio/references/earshot-launch.md` y prepará el kit con
`syka_launch_audio` desde los eventos reales. Insertá el componente devuelto
en la escena: sus efectos y música opcional son pistas nativas editables.
Conservá la música aprobada; el kit no busca ni compone una canción.
El análisis con modelos es opcional y no forma parte del flujo habitual.

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

### Componentes y variedad

Para un lanzamiento guiado por referencias o una mascota que acompañe la demo,
leé [lanzamiento guiado y personaje de marca](references/guided-launch-and-mascot.md).
Elegí ejemplos por función narrativa (hook, proof, turn, CTA) y vinculá cada gesto
al objeto, palabra o evento real que explica. Una mascota no obliga a usar cuatro
escenas ni reemplaza una demostración del producto.

Leé [recetas de demostración](references/demo-recipes.md). Incluye:
- estados antes/después: búsqueda→resultados, acción→preview, tarjeta→editor;
- foco y cursor unidos a un control real;
- portada/cierre legible con actividad ambiental opcional.

**Cámara y encuadre:** leé [cámara y encuadre](references/camera-and-framing.md)
antes de animar la UI. Lo mínimo: la captura ocupa 55–90 % del ancho y nunca
queda chica en un fondo vacío; el texto de la UI que importa se lee en un
teléfono (≥ 2,5 % del alto); alterná ventana, panel y primer plano del control;
cada movimiento dura 0,4–0,7 s y llega a un control o resultado; nada de zoom
lento continuo, y el texto que aterrizó queda quieto.

Copiá los TSX y `launch-time.ts` desde `examples/` al proyecto. Usan el reloj
absoluto de Diffusion, no CSS loops ni otro renderer. Pasá capturas/assets locales
copiados al proyecto, textos verdaderos y bounds medidos. Cambiá encuadre y receta
según la idea; no construir todas las escenas con la misma tarjeta. Dentro de un
html los textos se editan por props/fuente; si se necesitan Sources independientes
de texto, mantenelos como capas nativas afuera del componente.

## Review

### Revisión y entrega

Antes de responder, corré `gate` sobre la escena terminada. Falla si hay
tramos casi vacíos, el cuadro entero quieto más de 1,5 s (salvo el cierre),
texto que se sale del cuadro, texto tapado por otro elemento o dos textos
encimados; avisa (`small-subject`) si la captura queda chica en un cuadro casi
vacío. Corregí cada error y volvé a correrlo hasta que pase; después mirá
con `capture` los segundos que marcó. No declares terminado un film que no
pasó el gate.

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
