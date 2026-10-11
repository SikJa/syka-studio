---
name: syka-editorial-motion
description: Crear tarjetas, comparaciones y callouts de calidad editorial sobre video real en Syka, con jerarquía tipográfica, espacio seguro y continuidad animada. Adaptar referencias HyperFrames al motor Diffusion; usar cuando un overlay se vea básico o se pida motion explicativo.
---

# Motion editorial en Diffusion

La tarjeta tiene que explicar algo que el video necesita. Elegí su contenido, posición y duración a partir del footage, la voz y la referencia del usuario. El formato puede ser una frase, una comparación, una cifra, una anotación de pantalla o una demostración. Las referencias de Claudio Conde muestran intervenciones breves en espacio libre, cambios de escala y vueltas a footage limpio; no obligan a usar glass ni a cubrir cada frase.

## Diseñar el objeto y su recorrido

- Elegí una idea y un foco visual. Diseñá el cuadro de máxima información con el texto real, viendo el rostro/cursor y la zona de captions. Jerarquizá título, evidencia y apoyo por escala, ancho, contraste y espacio; un título más grande no compensa tres párrafos dentro de una caja.
- Diseñá dos o tres estados del mismo objeto: por ejemplo frase grande → frase que se convierte en encabezado → evidencia que se abre debajo. Conservá un ancla durante el cambio para que se lea como una transformación. Una comparación puede revelar origen y resultado de manera coordinada. También es válido entrar, sostener y salir sin morph cuando alcanza.
- La llegada concentra movimiento; el hold da tiempo para leer y la salida libera el plano. Cambiá ritmo y encuadre según la explicación. El gráfico responde a una idea hablada, no a un intervalo arbitrario repetido cada tres segundos.
- Capturá los estados y un punto intermedio antes de exportar. Si el gráfico quieto parece un placeholder, cambiá contenido/composición antes de sumar efectos. Compará al tamaño de reproducción previsto.

## Construir en el motor correcto

Usá `reference/jsx/html.md`, `keyframes.md` y `lifecycle.md` mediante `syka_read_reference`. Diffusion admite HTML real y animación en el reloj de la escena; no necesita el runtime HyperFrames para estas tarjetas.

- Texto/rect/keyframes nativos si se requieren controles individuales de tipografía y estilo en Propiedades.
- `<html>` para layouts, máscaras y comparaciones complejas. Su texto sigue editable en la fuente/props del componente; no prometas controles nativos de tipografía por cada nodo DOM interno.
- Los hijos de `<html>` son DOM: no insertes `<keyframeTrack>` ni otros nodos de composición adentro. Para keyframes nativos, envolvé el HTML en un `<group>` y animá ese grupo; los tiempos de los hijos son locales al grupo. Para detalle interno, usá el reloj de escena con estilos reactivos o una timeline pausada. Capturá el montaje antes de seguir agregando elementos.
- Timeline anime.js pausado y `seek` desde `useTicker`, o estado puro derivado del tiempo para un componente pequeño. Convertí reloj de escena a tiempo local restando `start`; conservá estados iniciales, salida y cleanup. No uses timers ni autoplay para el video.
- Un ejemplo HyperFrames con `data-start`, GSAP y `window.__timelines` necesita traducir temporización, lifecycle, medios y animación. Consultar su receta es válido; pegar su HTML como si Diffusion ejecutara ese contrato no lo es. Sus restricciones de width/height son propias de su pipeline, no límites universales del diseño.

## Ejemplos ejecutables

Leé [references/visual-profiles.md](references/visual-profiles.md) para elegir entre
producto protagonista, comparación/datos y explicación/anotación. Son rutas de
adaptación de los componentes existentes, no un catálogo nuevo de videos ni una
estética impuesta.

Para un motion elegido en Biblioteca, leé [references/native-library.md](references/native-library.md): conecta la muestra animada con su componente nativo y evita reemplazar capas editables por un MP4 de referencia.

Leé el soporte con `syka_skills read`, `path` igual a la carpeta de esta skill y `file` igual al archivo relativo. Copialo dentro del proyecto antes de importarlo:

- `examples/EditorialCallout.tsx`: la frase es el ancla; pasa a encabezado mientras aparece la evidencia. Props para texto, colores, posición, dimensiones, comienzo/fin y movimiento reducido.
- `examples/EditorialComparison.tsx`: dos jerarquías distintas y una revelación coordinada; útil para frase fragmentada → frase completa, o comparación con información real.
- `examples/motion-clock.ts`: fases finitas desde tiempo absoluto. No depende de GSAP, HyperFrames ni de un reloj de pared.

Son puntos de partida, no presets obligatorios. Cambiá composición, material y fases para el brief. Conservá fuente editable, IDs y nombres reconocibles.

## Capacidades y revisión

La terminal nativa está disponible para crear componentes/scripts, instalar dependencias de proyecto, preparar SVG/imágenes, sintetizar audio local y medir exports. Las herramientas `syka_files`/`syka_skills` tienen rutas acotadas; ese límite del helper no significa que la terminal esté deshabilitada. Para modificar la composición existente preferí SourceTools con hash e historial.

Probá seek hacia atrás y adelante al mismo instante, captura/export y el overlay sobre footage. Revisá recortes, costuras, colisiones y duración de lectura; un `check` exitoso no mide calidad de diseño. La pieza debe sostener la comparación con la referencia pedida, explicando lo que aún falta, sin declarar equivalencia artística automática.

## Procedencia

Adaptación original para Syka de los principios de HyperFrames `card-morph-anchor` y `control-target-sync`, dirección editorial de la referencia pública de Claudio Conde y la jerarquía temporal de transitions.dev. Los ejemplos usan APIs Diffusion y Solid; no copian el builder del autor ni incorporan el render HyperFrames. Fuentes: https://github.com/heygen-com/hyperframes y https://www.youtube.com/watch?v=6GFuMCWwYrw.
