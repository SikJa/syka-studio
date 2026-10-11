---
name: syka-motion-typography
description: Diseñar texto y captions legibles en Syka con fuentes reales, jerarquía, composición, holds y entradas/salidas editables.
---

# Tipografía que conduce la animación

Resolvé brief y sonido con `syka-motion-brief`; recuperá `useCase:"typography"`.
Consultá copy/idioma/destino/marca. Elegí fuentes disponibles y alternativas reales.

Familia, peso, escala título/apoyo, interlínea, tracking, contraste y márgenes forman
un sistema. Probá la frase más larga y los caracteres del idioma. No achiques todo
para un párrafo: reorganizá o consultá recortar copy.

Entrada establece foco, hold permite leer y salida prepara la siguiente idea.
Desplazamiento/opacidad/máscara tienen distancia y timing propios del tamaño.
Evitá salidas/entradas que compitan por lectura. La voz puede marcar palabras pero
no justifica retirar la frase antes de entenderla.

Preferí `<text>`/captions nativos para edición en Propiedades. HTML sirve para
layouts complejos: el selector puede señalar hijos al agente con Source/selector,
pero no los convierte en clips independientes. Para profundidad editable cargá
`syka-camera-3d-captions`. Comprobá clipping, fuente, lectura al destino y seek
fuera de orden; revisá cambios críticos por ID ±1 cuadro y también sin música.
