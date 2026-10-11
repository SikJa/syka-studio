---
name: syka-design-import
description: Traducir un diseño, export de Figma, SVG o styleframe aportado por el usuario a capas y motion editables de Diffusion. Usar cuando la referencia tiene diseño resuelto; no implica una conexión autenticada con Figma.
---

# Diseño resuelto → composición nativa

Inventariá lo recibido: frames exportados, SVG, imágenes, fuentes, tokens y medidas. Un enlace a un archivo privado de Figma no da acceso; usá un conector realmente disponible o solicitá el export necesario. No prometas leer el archivo solo por instalar esta skill.

Separá tres niveles:

- **Diseño observado:** tamaño, tipografía, pesos, interlineado, columnas, alineaciones, radios, color, sombra, jerarquía.
- **Assets reales:** logo/SVG/fotografía/ícono, copiados al proyecto y con variante adecuada.
- **Movimiento por decidir:** estados de entrada/lectura/salida, orden, duración, continuidad. Una captura estática no contiene easing ni sonido.

Leé `reference/jsx/text.md`, `styles.md`, `elements.md` y la referencia de SVG/media. Representá textos y formas con nodos nativos; HTML para layout complejo gobernado por ticker y surface solo cuando se necesite canvas/3D. No aplanes un frame entero a una imagen si el pedido requiere edición de sus elementos. Usar un bitmap es válido para una fotografía o un fondo que así fue acordado.

Primero reproducí un frame estático y compará a escala real. Después animá con `syka-motion-transitions`; mantené su geometría, márgenes y roles. Exponé parámetros útiles con `@inspect` sin prometer inspector por cada hijo HTML. Conservar el diseño aprobado no significa copiar la marca de otra persona.

Guardar diseño/tokens, componente, assets y capturas en el proyecto; enlazarlos en `syka_editing_recipe`. Revisá overflow, fuentes sustituidas y captura/export del mismo tiempo.

Adaptación conceptual del workflow `figma` y design-spec de [HyperFrames](https://github.com/heygen-com/hyperframes). No incluye el importador autenticado de Figma ni un conversor universal.
