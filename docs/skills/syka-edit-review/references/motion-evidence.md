# Mirar el export y corregir el defecto

Para una pieza completa, usá un draft nativo ya exportado por el usuario o un
export autorizado explícitamente. Usá `syka_motion_review` con su ruta local,
un tiempo de riesgo elegido a partir de `frame.md` y los holds de lectura:

```json
{
  "source": "02 Finales/draft.mp4",
  "focusTime": 3.5,
  "readingTimes": [1.5, 4.5, 8.5],
  "loop": false,
  "declaredCuts": [3.0, 6.0]
}
```

Son tiempos de ejemplo: deben quedar dentro del archivo real. Usá la
herramienta sólo para el export del proyecto abierto, hasta 180 s. Para
piezas largas, exportá/revisá tramos y conservá su offset respecto al conjunto.
Si faltan FFmpeg/FFprobe, informá esa limitación y revisá capturas nativas;
no instales dependencias ni reemplaces el renderer automáticamente.

La herramienta devuelve rutas absolutas de PNGs, `manifest.json` y `review.md`
en una carpeta nueva `reviews/motion-...`. Abrí las imágenes con la capacidad
de visión del proveedor o en el editor; no dictamines por el texto del resultado.
`syka_files read` sirve para el manifest y reporte, no para ver píxeles.

`automaticChecks` examina **todos los cuadros codificados**, reducidos a gris
32×18: propone flashes de un cuadro con retorno al estado previo, informa el
mayor cambio global y, con `loop:true`, compara posición/variación del final e
inicio. Los cortes declarados son relativos al export y contextualizan la señal;
no descartan automáticamente un flash cercano. Revisá sus tiempos con un burst y
reproducción antes de corregir. Un destello intencional puede ser válido. Esta
medición no detecta todos los fallos de objetos, clipping, texto ni calidad estética.
El informe sigue pendiente aunque no encuentre candidatos. Si el archivo cambia
durante la revisión, su hash cambia y la evidencia se rechaza.

Cuando haya audio disponible, `syka_audio_analyze` mide ataques, energía y LUFS/
true peak del archivo real. Conservá métricas y rangos; escuchá la mezcla para
juzgar intención, balance y relación con el movimiento.

- **Contact:** muestras distribuidas alrededor de dos por segundo y último
  cuadro; en piezas largas se limita a 120 muestras. Mirá jerarquía, consistencia,
  densidad, focos, apertura/cierre. El manifest dice índice/tiempo de cada celda.
- **Burst:** 12 cuadros codificados consecutivos alrededor del tiempo elegido;
  ajustados al borde del archivo si hace falta. Revisá pops, solapes, radio,
  recorte y trayectoria. Si el video tiene menos de 12 cuadros, devuelve los
  disponibles. No significa que se encontró automáticamente el movimiento más rápido.
- **Reading:** imágenes cuyo contenido conserva aspecto a 360 px de ancho.
  Miralas a ese tamaño, sin ampliar para fingir legibilidad. Verificá palabras,
  jerarquía y apoyo; la etiqueta temporal está fuera del contenido. No es un
  export vertical ni una prueba de todas las pantallas posibles.

Los labels `n` son índices desde cero del archivo decodificado; `pts` es el
timestamp original. `seconds` del manifest es relativo al primer cuadro. No
uses 30 unidades del editor como si fueran 60 cuadros codificados. Para un
defecto en una celda, identificá índice, tiempo real y región antes de corregir.

Además mirá reproducción normal para ritmo y pausas; los stills no sustituyen
playback. Si hay audio, escuchá la mezcla real. Si es loop, reproducilo dos
veces y mirá la costura; no concatenes automáticamente cada export. Para
determinismo, volvé al mismo tiempo después de saltos en el player y compará
el estado. Repetir decode de un archivo estático no verifica el motor.

## Corrección acotada

Seleccioná hasta tres defectos de mayor impacto, no tres por obligación:

| Tiempo/cuadro | Región/Key | Qué se ve | Corrección local | Evidencia después |
| --- | --- | --- | --- | --- |
| 4.2 s / 252 | Título | Apoyo invade el título durante el cambio | Retrasar apoyo, conservar hold | Nuevo burst + lectura |

Separá incumplimientos del brief de preferencias. Una pausa útil no se arregla
poniendo partículas; un final deliberado no se declara frame perdido. Usá
source tools/historial para conservar reversibilidad y cambiá sólo el tramo
y parámetros relevantes. Si retocás un componente compartido, revisá también
sus otros usos. Reexportá desde Diffusion, llamá de nuevo a la herramienta y
compará los mismos holds/transición. Para un ajuste pequeño basta su evidencia
relevante; no agregues seis aprobaciones al flujo existente.

El SHA-256 identifica el video revisado. El snapshot de `index.tsx` y
`package.json` indica qué fuente estaba presente al llamar, **no prueba** qué
revisión produjo ese MP4 ni cubre todos los componentes/assets. Conservá los
hashes de fuente/export y tiempos de la exportación en la receta cuando haga
falta comparar; un archivo viejo no se vuelve actual por revisarlo.

El reporte generado comienza pendiente. Completá lo que realmente miraste,
corregiste, escuchaste y probaste, junto con dudas. Un autoscore es una ayuda
subjetiva, no un criterio automático de entrega. Limitá rondas al presupuesto
y a fallos concretos. Presentá el resultado con sus fuentes editables y evidencia;
la aprobación estética del usuario sigue siendo suya. En la entrega del chat,
mostrá el resultado y sus enlaces de antes/después; si ayuda, incluí un frame
representativo con ruta absoluta. El chat final puede ocultar la actividad de
herramientas: sus previews son evidencia para revisar, no una pared de logs
que el usuario tenga que descifrar.

Procedencia: adaptación propia de [seeco](https://x.com/i/article/2106091215502422016)
y [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase/blob/0ac8bf2b31942376cb6b8c4074715595d512acd2/ANIMATION_GUIDE.md).
Extracción realizada con [filtros oficiales de FFmpeg](https://ffmpeg.org/ffmpeg-filters.html#tile);
no se importó el renderer de los repos de referencia.
