# Separar audio — 11 de octubre de 2026

Al separar, el video original conserva su imagen y queda arriba, azul. Se crea
una pista de audio verde inmediatamente debajo, alineada con el mismo recorte y
velocidad. El original queda silenciado para evitar duplicar el sonido. Deshacer
revierte la inserción y el silencio en un solo paso.

La pista de audio lee el flujo de sonido del MP4 original: no se necesita copiar
ni convertir el archivo. La timeline ahora reconoce el elemento de audio aunque
el contenedor sea un video; muestra su onda, sin miniaturas de video. Las filas
de video de altura normal también muestran imágenes, y un video silenciado ya
no duplica visualmente la onda que tiene la pista separada.

La inserción se realiza antes del video en el documento porque la timeline
muestra las capas en orden inverso. En una secuencia, el audio se inserta debajo
de su contenedor y conserva la posición resuelta del clip.

## Comprobaciones realizadas

- 18 pruebas automatizadas: planificación, comando, orden, colores, render de
  audio desde MP4, miniaturas del video e historial.
- Chequeo de TypeScript y compilación del frontend de escritorio correctos.
- Cuatro pruebas de integración en Electron, usando el motor y escritor reales:
  video con recorte y velocidad 1.5; Rect con VideoPaint; video dentro de una
  secuencia desde el segundo 1; y la referencia real Hazene Edit del proyecto.
- Comparación de píxeles antes/después, onda no vacía, cero imágenes dibujadas
  en la pista de audio, video azul, audio verde, alineación y Deshacer/Rehacer.
- Guardado de cada proyecto y recompilación posterior.

La evidencia y los proyectos de prueba están en
`.runtime/audio-detach-review/verification.json` y en las carpetas que ese
reporte enumera. Los tests se ejecutaron en una instancia aislada; los proyectos
del usuario se consultaron sin modificarlos ni reiniciar Syka.

El MP4 de Hazene Edit empieza con un fotograma blanco. Se verificó el contenido
del archivo directamente y su separación en Electron: esa imagen inicial no
significa que el editor haya eliminado el video.

## Prueba manual

1. Seleccionar un clip de video nuevo que tenga sonido.
2. Pulsar **Separar audio**. El video queda arriba, azul y con miniaturas;
   el audio aparece abajo, verde y con su onda.
3. Reproducir, cambiar el volumen del audio y comprobar que la imagen continúa.
4. Pulsar **Deshacer** una vez y luego **Rehacer**.
5. Reabrir el proyecto y comprobar orden, recorte y velocidad.

Las separaciones realizadas antes de este arreglo conservan el orden que ya
tenían guardado. Sus colores y su contenido visual sí usan el nuevo render;
puede arrastrarse su pista de audio debajo del video sin volver a extraerlo.
