# Previsualización de un motion → componente editable

Una carpeta conectada como `motions` puede contener un `.mp4` de muestra junto
a un `.tsx` del mismo nombre y un README con su contrato. Primero listá los
recursos y leé los archivos que acompañan a la muestra. Copiá el componente y
sus assets al proyecto, importalo y adaptá contenido, comienzo/fin e identidad
de cada instancia. No importes el MP4 de muestra como sustituto de las capas
editables salvo que el usuario lo pida expresamente.

El ensayo «Pruebas Syka · 02 · Ocho motions» ofrece comparación, pasos,
diagrama, cita, estadística, logo, tarjeta explicativa y antes/después. Sus
componentes usan la escena 1280×720, `start`, `end`, `idPrefix` y, para logos,
`logoSrc`. No son overlays verticales listos para pegar: recomponé posición,
tipografía y márgenes al usarlos sobre un reel. Conservá el logo original.

La muestra animada permite elegir dirección; el source sigue siendo la
autoridad para las correcciones. Después de integrar, verificá captura,
adelantar/retroceder, exportación y edición del texto y del logo.

## Catálogo incluido

`syka_resources kind: motions` incluye Órbita y Carrusel circular aunque la persona
no haya conectado carpetas. Cada resultado identifica `componentPath`,
`componentFiles` (incluye helper y README) y `usage`. Esos son los archivos que
se copian al proyecto. El video y los estudios gráficos son muestras de la técnica;
no son el contenido final. La misma metadata viaja al chat al arrastrar la muestra
o elegir «Usar con el agente».

Son adaptaciones originales para Diffusion de referencias HyperFrames. Órbita
usa perspectiva 2.5D y esfera analítica, no el rig Blender upstream. Los niños
HTML no aparecen como entidades separadas en el inspector: para una corrección
apuntá al componente y cambiá sus props o fuente con historial.

## Muestras de texto y fuentes

Biblioteca → Texto muestra Título simple (Inter Semibold), Frase destacada
(Figtree Medium), Editorial (Instrument Serif Italic) e Impacto (Archivo Black).
La muestra usa la misma familia, peso, estilo, color y copy del preset aplicado;
sus entradas y salidas independientes se adjuntan como `textStyle` al chat. Los
saltos son semánticos y el tamaño aplicado escala con el ancho de la escena.
Adaptá jerarquía, ubicación y hold al contenido; no copies la miniatura como una
imagen ni impongas su tamaño a otro formato.

Las tarjetas de fuentes muestran un espécimen grande y un peso/estilo realmente
disponible. Las muestras nativas tienen doble resolución de rasterización,
poster legible y reproducción completa de entrada → lectura → salida al pasar
el puntero. Con movimiento reducido quedan en el estado de lectura. Las fuentes
incluidas funcionan sin red; una importada sigue siendo privada de ese perfil.
