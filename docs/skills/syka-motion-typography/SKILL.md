---
name: syka-motion-typography
description: Diseñar texto y captions legibles en Syka con fuentes reales, jerarquía, composición, holds y entradas/salidas editables.
---

# Tipografía que conduce la animación

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Usá copy, idioma, fuentes disponibles y tiempos reales. Preservá lectura y editabilidad; la perspectiva o el efecto nunca sustituyen jerarquía/contraste.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Resolvé brief y sonido con `syka-motion-brief`; recuperá `useCase:"typography"`.
Consultá copy/idioma/destino/marca. Elegí fuentes disponibles y alternativas reales.

Familia, peso, escala título/apoyo, interlínea, tracking, contraste y márgenes forman
un sistema. Probá la frase más larga y los caracteres del idioma. No achiques todo
para un párrafo: reorganizá o consultá recortar copy.

## Build

Entrada establece foco, hold permite leer y salida prepara la siguiente idea.
Desplazamiento/opacidad/máscara tienen distancia y timing propios del tamaño.
Evitá salidas/entradas que compitan por lectura. La voz puede marcar palabras pero
no justifica retirar la frase antes de entenderla.

Preferí `<text>`/captions nativos para edición en Propiedades. HTML sirve para
layouts complejos: el selector puede señalar hijos al agente con Source/selector,
pero no los convierte en clips independientes. Para profundidad editable cargá
`syka-camera-3d-captions`.

## Review

Comprobá clipping, fuente, lectura al destino y seek
fuera de orden; revisá cambios críticos por ID ±1 cuadro y también sin música.
