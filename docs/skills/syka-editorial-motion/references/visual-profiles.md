# Elegir una familia antes de adaptar un componente

Estas familias organizan decisiones sobre los componentes nativos existentes;
no agregan otro motor ni convierten las referencias en cientos de plantillas.
Elegí por brief y variá paleta, contenido y densidad con la identidad real.

| Familia | Uso y composición | Base editable | Movimiento y sonido |
|---|---|---|---|
| Producto / objeto protagonista | Silueta primero, detalle útil después, cierre con copy breve; tipografía fuera de la zona del producto | Producto con nodos nativos o SVG propio; `EditorialCallout.tsx` solo cuando hace falta una anotación | El producto persiste; pocos acentos al revelar, confirmar o cerrar, no un whoosh por microacción |
| Comparación / datos | Dos estados con jerarquías distintas y evidencia verificable, cifra protagonista y apoyo breve | `EditorialComparison.tsx` y su helper `motion-clock.ts` | Revelación coordinada, hold de lectura, un acento en el cambio principal |
| Explicación / anotación | La frase se convierte en encabezado y deja aparecer prueba/detalle; aprovechar espacio libre del footage | `EditorialCallout.tsx` y `motion-clock.ts` | Mantener la frase como ancla, agrupar acciones y dar espacio a la voz |

El callout expone `id/start/end/x/y/width/height`, `label/title/evidence/detail`,
`accent/surface/ink` y `reducedMotion`. La comparación expone tiempo/posición/
tamaño, `label/title/before/after/note`, `accent` y `reducedMotion`. Copiá el source
al proyecto y modificá lo necesario; no prometas props inexistentes para fuentes
o easing. El helper usa tiempo absoluto y permite probar ida/vuelta. Texto DOM es
editable en source/props; para selección y estilo individual nativo usá `<text>`
documentado fuera del HTML.

Una referencia de movimiento puede informar las fases y otra de apariencia la
jerarquía. Registrá ambas funciones en el brief. Una familia no fija una duración,
un fondo oscuro, tarjetas redondeadas o música para todos los usuarios.

Probá con el copy final y la proporción real: estado inicial, hold más denso y
punto intermedio de mayor riesgo. Revisá lectura, solapes, entrada/salida y audio.
Los tiempos de los ejemplos se adaptan; no reutilices su coreografía sin comprobar
el nuevo contenido.
