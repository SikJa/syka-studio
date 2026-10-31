---
name: syka-motion-storyboard
description: Organizar historia, composición, continuidad y plan sonoro en un storyboard de Syka antes de construir motion nativo.
---

# Storyboard que se puede construir

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Si se pidió sólo storyboard, entregá cuadros y plan; no produzcas un video por inferencia. Para un pedido de edición, el storyboard acompaña la composición editable y no la sustituye.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Usá `syka-motion-brief` para propósito, destino, copy y sonido. Si el pedido es
solo storyboard, entregá cuadros y plan: planificar música no equivale a producirla
y no convierte el pedido automáticamente en video.

Buscá `useCase:"storyboard"`. Separá historia (qué cambia y por qué), gramática de
movimiento (cómo se revela) y acabado (type/paleta/assets). Usá referencias distintas
para problemas distintos, sin imponer una plantilla a cualquier tema.

## Build

Cada beat declara propósito, copy literal, protagonista, composición inicial/final,
entrada, hold legible, salida y puente. Precisá qué objeto persiste y su estado a
ambos lados de la costura. Un corte directo o hold puede ser intencional. Vinculá
cues y riesgos a IDs comunes, con recursos reales y faltantes identificados.

## Review

Capturá styleframes con texto/proporción finales y comprobá jerarquía quieta. Compilá
`syka_motion_plan` y guardá JSON/documento. No afirmes reproducción, audio o export
solo porque el storyboard esté completo.
