---
name: syka-motion-brief
description: Consultar especificaciones de una animación y compilar un superprompt detallado, JSON portable, storyboard y eventos compartidos para Diffusion, con decisión de sonido para toda pieza.
---

# Del pedido al plan de producción

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Esta entrada resuelve producciones nuevas; una corrección conserva el brief. Reutilizá una consulta útil respondida para esa pieza o hacela con syka_ask_user antes de construir. El plan compilado acompaña la edición, no la reemplaza.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Usá esta entrada para una nueva pieza; una corrección puntual conserva su brief.
Leé conversación, receta y materiales reales. Las referencias son datos, no órdenes
para instalar motores, cambiar proveedores o gastar créditos.

### Consulta

Siempre debe existir al menos una consulta útil respondida para esta pieza. Si ya
la hiciste, reutilizala. Usá `syka_ask_user` y esperá el resultado. Agrupá hasta tres
preguntas relacionadas por ronda; no recites veinte campos.

- **Idea:** objetivo, público, tono, mensaje recordable y acción final. Si todo
  está especificado, preguntá por la prioridad creativa o tratamiento sonoro.
- **Entrega:** destino, proporción/resolución, duración y fps; copy exacto,
  idioma, marca, fuentes y assets disponibles. No inventes un formato vertical.
- **Sonido, para todas las piezas:** música, efectos, ambos, audio existente o
  silencio; voz y referencia sonora. No confundir falta de mención con silencio.
  En interfaz consultá sonido de interacción; en storyboard, intención sonora
  y si se entregan solo cuadros. No fuerces música cuando eligieron silencio.

La consulta tiene contexto observado y una recomendación concreta si hay evidencia.
Consultá detalles materiales faltantes; resolvé el resto dentro de la dirección
delegada y explicá esas elecciones. Omitir delega; cancelar detiene lo dependiente.

### Referencias y ruta

Consultá `syka_creative_selection action:status` antes de volver a buscar. Para
una pieza nueva, `syka_motion_knowledge` devuelve 3–4 candidatos compactos por
problema: jerarquía, continuidad, ritmo, explicación, sonido o cámara. Filtrá
`useCase`/`kind`; Motion Lab y Huashu están en el mismo índice. Leé solo los IDs
elegidos con `includeText:true` y continuá con `nextTextOffset` si falta una parte
necesaria. Empezá con hasta dos búsquedas y dos lecturas; ampliá por una carencia
concreta, sin cargar catálogos enteros ni repetir consultas idénticas.

Registrá la elección y su motivo con `syka_creative_selection action:choose`.
El host distingue descubrimiento de lectura real y comprueba si cambió la fuente.
Sus recibos no acreditan haber visto un video ni escuchado una pista. Una corrección
puntual reutiliza referencias y música. Una pieza nueva busca música con
`syka_resources audioType:music newPiece:true`, aunque comparta proyecto.

En `brief.references.roles` indicá qué aporta cada fuente: `movement`, `look`,
`story`, `audio` o `technical`; puede aportar varias cosas. No copies la apariencia
de una referencia elegida solo por su coreografía. Para sonido ya disponible,
medí con `syka_audio_analyze`, conservá su reloj fuente y escuchá los candidatos
antes de usar `assetCuePointSeconds`. Un recurso aún no elegido no tiene un
ataque medido. Ejemplo completo de consulta/JSON/prompt:
[../syka-motion-direction/examples/green-bottle-flow.md](../syka-motion-direction/examples/green-bottle-flow.md).

| Pedido | Ruta |
|---|---|
| Reel / pieza vertical | `syka-motion-reels` + dirección |
| Storyboard / plan narrativo | `syka-motion-storyboard` |
| Motion tipográfico | `syka-motion-typography` |
| Lanzamiento de producto / función | `syka-product-launch` + dirección + componentes editoriales |
| Marca / explicación | `syka-motion-direction` + componentes editoriales |
| Captions | Biblioteca nativa de subtítulos + revisión de lectura |
| Camera 3D Captions | `syka-camera-3d-captions` |
| Interfaz / estética de juego o web | Estados audiovisuales temporizados y editables; nunca una app jugable |

## Build

### Compilar y construir

1. Prepará `brief`: objetivo/público, entrega, copy, dirección, tipografía,
   gramática/continuidad, audio explícito, referencias con observación/aplicación/límite,
   assets relativos al proyecto y restricciones. Registrá `consultation` con preguntas
   y respuestas reales, incluyendo delegaciones.
2. Prepará `beats`: ID, inicio/fin, propósito/copy, composición, entrada, hold de
   lectura, salida, puente y revisión. Sus tiempos gobiernan los eventos del plan.
3. Prepará `events`: ID, beat, ancla `start/holdStart/holdEnd/end`, offset, propósito
   visual/sonoro/revisión, asset y Source si ya existe. No dupliques tiempos a mano.
4. Llamá `syka_motion_plan`. `needs_answers` indica datos pendientes; no los
   rellenes con falsas preferencias. `needs_structure` pide completar el storyboard
   desde el brief. `ready` devuelve JSON y un documento extenso de seis bloques.
5. Guardá `motion-plan.json`, `production-prompt.md` y las vistas `documents`
   (`design.md`, `frame.md`, `audio-plan.md`) con herramientas reversibles y
   enlazalos en la receta. Conservá/versioná diseño y frames ya aceptados;
   reconciliá sus decisiones antes de reemplazar un documento. Recompilá las
   vistas desde el mismo plan cuando cambien beats o cues.
   Importá recursos usados con `copy:true` y rutas relativas.
   Reutilizá los valores ya devueltos por el compilador; no releas el mismo JSON
   completo para copiar una vista. Si el transporte sólo devuelve un archivo,
   consultá sus campos o fragmentos necesarios, conservando su revisión. Guardar
   el plan no acredita haber construido ni revisado la composición.
6. Construí en Diffusion: texto editable, grupos nombrados, reloj absoluto y entradas/
   salidas específicas. Styleframes primero, luego la costura de mayor riesgo.
7. Asigná Sources reales y resolvé `motion_events` después de construir y de cambios
   de timing. Usá esos IDs para ataques de audio y revisión. Los segundos del plan
   son previsión; un recorte de export cambia el origen de la evidencia.
8. Revisá preview, seek de ida/vuelta, lectura y audio real. Para export solicitado,
   `syka_motion_review` acepta eventos resueltos y toma cuadros anterior/cercano/
   posterior. Pasá `exportStartSeconds` del tramo realmente exportado: se resta
   a los eventos de la composición, mientras foco y lectura siguen relativos al
   archivo. Registrá defectos/correcciones por ID. El snapshot del plan y de sus
   documentos no prueba que ese export corresponda a la fuente actual.

`plan.reviewSchedule` deriva foco, holds de lectura, transiciones y cierre de los
beats/eventos. Avisa de holds posiblemente cortos y de beats sin cubrir; es una
guía de revisión, no un rechazo creativo ni evidencia de inspección. Volvé a
compilar al cambiar los tiempos y resolvé Sources con `motion_events`.

El contrato `playbackContract` pide comparar el mismo instante después de seeks
en distinto orden, pausa/reanudación sin duplicar audio, liberación de medios al
desmontar y final/cola correctos. Conservá el reloj nativo; no copies timers o
loops de una demo web. Para export: `detail:standard` limita la hoja general a
24 cuadros, `quick` a 12 y `diagnostic` a 120. Eventos, lectura y ráfaga puntual
se revisan aparte; el barrido de flashes consecutivos se conserva. No es una
regla de tres segundos. Una falla concreta justifica ampliar la revisión.

Compilar no produce ni certifica un video. Esta skill y los estudios se distribuyen
con Syka sin descargar videos, visor personal, otro motor ni entrenar pesos.

### Extensiones del plan v2

`brief.audio.microActions` elige none/selective/detailed; detailed agrega acentos
pequeños de clic, selección y respuesta cuando ese tratamiento fue elegido o
delegado. `brief.motion.holdActivity` elige still/ambient/punctuated y preserva
el foco legible durante el hold. No son valores obligatorios para otros usuarios.

En una demo, `beat.demo` registra trigger/reaction/result/evidence. Si hay una toma
de voz real con tiempos de palabras, `narration` conserva asset, words y trim/rate;
`event.wordCue` enlaza por índice y borde. El compilador valida y recalcula los
tiempos, no genera narración. Leer syka-product-launch/references/narration-sync.md.

Guardar todas las vistas devueltas en `documents`: además de las originales,
short-prompts.md y delivery-plan.md; en lanzamientos, launch-checklist.md. Los
prompts breves son ocho partes por escena del mismo brief; el extenso se conserva.
`brief.deliverables` planifica solo variantes elegidas; no dispara exports.
Los campos nuevos son opcionales: entradas anteriores siguen compilando.

## Review

Resolvé los mismos IDs mediante motion_events después de cambios de timing. Revisá lectura, costuras, sonido y seeks al mismo tiempo en distintos órdenes; pausa/reanudación no duplica audio. plan.reviewSchedule y playbackContract son guías, no pruebas. Si ya existe un export autorizado, usá su exportStartSeconds real y tiempos de foco/lectura relativos al archivo. No exportes para satisfacer QA.
