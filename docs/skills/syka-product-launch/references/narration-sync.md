# De palabras medidas a eventos

Con una toma existente y elegida, leé su transcript con timestamps. Whisper usa
`word`, `start`, `end`; también se acepta `text` en lugar de word. Extraé las words
de sus segmentos y conservá segundos relativos al asset original. No inventes
tiempos a partir del número de letras. Si solo hay un guion, generar/transcribir
la voz queda pendiente mediante el proveedor realmente configurado y autorizado.

Fragmento de entrada de `syka_motion_plan` (ejemplo didáctico, tiempos no medidos
de una toma real; no reutilizarlos como evidencia):

```json
{
  "narration": {
    "asset": "Audio/voz.wav",
    "timelineStartSeconds": 2,
    "sourceInSeconds": 0.5,
    "playbackRate": 1,
    "words": [{"word":"Seleccioná","start":1.2,"end":1.7}]
  },
  "events": [{
    "id":"seleccion-titulo", "beat":"ajuste", "at":"start",
    "kind":"visual", "element":"demo-ajuste",
    "description":"Seleccionar el título",
    "wordCue":{"index":0,"edge":"start","offsetSeconds":0}
  }]
}
```

El brief, consulta y beats completos son necesarios. El evento debe quedar dentro
de su beat. `wordCue.index` es cero-based y resuelve palabras repetidas sin buscar
una frase ambigua. Para desplazarlo usá wordCue.offsetSeconds, no el offset del
beat a la vez. Un SFX puede compartir ese wordCue y aportar su propio asset y ataque.

`evento = timelineStart + (bordePalabra - sourceIn) / playbackRate + offset`

Los intervalos deben ser finitos, positivos y ordenados por inicio. Se permiten
solapamientos que provengan del ASR; no se reparan inventando otros tiempos.
Palabras recortadas o fuera de la pieza/beat requieren actualizar el plan.

El resultado conserva asset, palabra, borde, tiempo fuente, tiempo de composición
y `timingRevision`: hash de los datos de tiempos y su colocación. **No es el hash
del audio ni prueba de exactitud del ASR.** Recompilá al cambiar la toma, palabras,
trim o rate; no fuerces la voz para sostener una animación vieja. Si el audio cambia
sin volver a transcribirlo, el hash no puede detectarlo: verificar la toma sigue
siendo obligatorio. No se genera voz ni se abre un proveedor desde este compilador.

Asigná Sources reales y resolvé motion_events. Compará las palabras/cues en la
preview y escucha; assetCuePointSeconds del efecto conserva su propio reloj.
