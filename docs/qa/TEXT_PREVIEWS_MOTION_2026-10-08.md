# Texto: muestras nativas y motion de 12 segundos

Mejora local: muestras de texto/fuentes a 480×288, preservando tamaño CSS;
familia, peso y estilo reales; espécimen grande de fuentes, cuatro textos con
entradas/salidas independientes y hold. El preset aplicado comparte `textStyle`
con la miniatura y con las tres rutas de referencia al agente. Movimiento
reducido muestra el poster legible, incluso al activarlo durante la reproducción.

Validación real en una app Electron aislada: imágenes `03-new-text-previews.png`,
`09-text-final-real-fonts.png` y `final-preview/11-font-specimen.png`. El ciclo
hover cambia los píxeles del texto y llega a la salida; con movimiento reducido
la muestra se mantuvo idéntica durante 700 ms. Agregar Editorial persistió
Instrument Serif, 400, italic, 112 px, copy con dos líneas y dos animaciones;
Deshacer eliminó el nodo de la fuente en una acción. No se tocó la app compartida.
El atajo Ctrl+Z no se validó: se usó el botón nativo Deshacer.

Motion original: [proyecto editable](../../../Pruebas%20Syka/El-silencio-tambien-habla-12s-2026-10-08/index.tsx).
Diffusion nativo; 8 textos, 4 formas y 3 pistas de audio. Intercambio de fuente
personal Nofex/Athelas/Switzer, sin redistribuir su software. Check nativo sin
issues. Reproducción en el player hasta 12 s y seek 8.5 → 1.2 → 8.5; después de
resolver las fuentes, el canvas de ambas visitas a 8.5 s tuvo hash idéntico.

Export: 1920×1080, 60 fps, 720 frames H264, AAC estéreo 48 kHz. El AAC nativo
tenía 512 muestras de padding; se corrigieron sólo sus duraciones MP4 conservando
todos los bytes de `mdat`. Ambos streams y el contenedor final declaran 12 s.
Mezcla original: -14.9 LUFS integrado, -5.0 dBFS true peak, sin clipping medido.
Se miraron holds y costuras del export en secuencias a 100 ms; los métricos no
sustituyen juicio musical ni aprobación estética.

Drive verificado: `1woMB5kzq7nuaNQFl7BsydmYreUf20XbG`, 5683903 bytes, video/mp4,
carpeta `1-00SZAYw4puj-SvuCOKMfof1GEb7uAd9`. Fuente editable, WAVs originales,
design.md/frame.md/audio-plan.md y evidencia quedan junto a la pieza.

Typecheck y build web pasaron. Warnings previos: directiva use client/sourcemap
del CRT y chunks grandes. Sin commit, deploy ni instalador publicado.
Los logs del primer entorno registraron un fallo del preload de un renderer
auxiliar Electron; no hubo pageerrors del editor ni fallo del export. Los errores
de selectores ambiguos/placeholder en la automatización se corrigieron usando la
UI observada; no se atribuyen a errores de la app.
