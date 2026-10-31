---
name: syka-design-import
description: Traducir un diseño, export de Figma, SVG o styleframe aportado por el usuario a capas y motion editables de Diffusion. Usar cuando la referencia tiene diseño resuelto; no implica una conexión autenticada con Figma.
---

# Diseño resuelto → composición nativa

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Un diseño observado no contiene easing ni sonido. Un enlace privado no da acceso; pedí un export o usá un conector autorizado. Conservá geometría y elementos editables.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Inventariá lo recibido: frames exportados, SVG, imágenes, fuentes, tokens y medidas. Un enlace a un archivo privado de Figma no da acceso; usá un conector realmente disponible o solicitá el export necesario. No prometas leer el archivo solo por instalar esta skill.

Separá tres niveles:

- **Diseño observado:** tamaño, tipografía, pesos, interlineado, columnas, alineaciones, radios, color, sombra, jerarquía.
- **Assets reales:** logo/SVG/fotografía/ícono, copiados al proyecto y con variante adecuada.
- **Movimiento por decidir:** estados de entrada/lectura/salida, orden, duración, continuidad. Una captura estática no contiene easing ni sonido.

## Build

Leé `reference/jsx/text.md`, `styles.md`, `elements.md` y la referencia de SVG/media. Representá textos y formas con nodos nativos; HTML para layout complejo gobernado por ticker y surface solo cuando se necesite canvas/3D. No aplanes un frame entero a una imagen si el pedido requiere edición de sus elementos. Usar un bitmap es válido para una fotografía o un fondo que así fue acordado.

Primero reproducí un frame estático y compará a escala real. Después animá con `syka-motion-transitions`; mantené su geometría, márgenes y roles. Exponé parámetros útiles con `@inspect` sin prometer inspector por cada hijo HTML. Conservar el diseño aprobado no significa copiar la marca de otra persona.

## Review

Guardar diseño/tokens, componente, assets y capturas en el proyecto; enlazarlos en `syka_editing_recipe`. Revisá overflow, fuentes sustituidas y captura/export del mismo tiempo.

Adaptación conceptual del workflow `figma` y design-spec de [HyperFrames](https://github.com/heygen-com/hyperframes). No incluye el importador autenticado de Figma ni un conversor universal.
