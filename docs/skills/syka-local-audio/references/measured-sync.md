# Ataque medido → evento nativo

`syka_audio_analyze` trabaja sobre un archivo ya importado al proyecto. No necesita
Python, modelos ni red; usa FFmpeg y FFprobe configurados en Herramientas locales.
Acepta hasta 180 segundos por llamada. Para un archivo largo, pasá un intervalo:

```json
{"source":"Audio/tema.wav","startSeconds":12,"endSeconds":32}
```

Todos los tiempos devueltos están en **segundos del archivo fuente**; el primer
ataque de ese tramo puede estar en 12,23 s, no en 0,23 s. Conservá `analyzedRange`
y la ruta junto a la evidencia. No reutilices cues si cambiaste o reemplazaste el
archivo. Para medir `assetCuePointSeconds`, analizá el asset completo o un tramo
que incluya su ataque y guardá el tiempo fuente devuelto.

La herramienta decodifica energía estéreo a 8 kHz en ventanas de 10 ms: no cancela
canales en fase opuesta mediante un downmix mono. Propone onsets, el punto de mayor
energía, cambios de nivel de al menos 6 dB entre ventanas de medio segundo y tempos
entre 60 y 180 BPM. La grilla se devuelve solo con ajuste suficiente; `confidence`
es un score heurístico de alineación/cobertura y `gridFitErrorMs` expresa el error
medio de los ataques alineados. No son probabilidad musical ni identificación de
compases, palabras, drops o emociones. Puede no haber grilla o existir ambigüedad
de tempo mitad/doble. Elegí por escucha y función narrativa.

Pico y RMS a 8 kHz son auxiliares. LUFS integrado, rango de loudness y true peak se
miden aparte con `loudnorm` sobre la calidad original decodificada. Los valores no
finitos del silencio se representan con `null`. No se normaliza ni escribe audio.
Para limpieza/normalización pedida existe `syka_audio_enhance`; no confundas ambos.

## Alinear el acento

Si el ataque está a 0,25 s dentro del whoosh y el contacto visual a 4,00 s, el
archivo debe empezar a 3,75 s, no a 4,00 s. Son cifras ilustrativas, no una medición
de un recurso incluido. Guardá el evento en el brief:

```json
{
  "id":"bottle-reveal-sfx", "beat":"reveal", "at":"holdStart",
  "kind":"sfx", "description":"Acento al asentarse la botella",
  "asset":"Audio/whoosh.wav", "assetCuePointSeconds":0.25,
  "element":"bottle-reveal"
}
```

El compilador devuelve `mediaStartSeconds` para rate 1 sin trim. Después de construir
o retimar, resolvé el mismo ID con `motion_events` y recalculá con el ancla real:

`inicioTimeline = eventoTimeline - (ataqueFuente - sourceIn) / playbackRate`

Si el resultado cae antes de cero, resolvé preroll o recorte compatible con el
ataque; no lo fuerces a cero y declares sincronización. Si el trim excluye el
ataque, elegí otro cue o corregí el trim. No estires voz para hacerla coincidir con
una grilla. Volvé a comprobar oído/imagen después del ajuste, incluyendo el final.

Elegí pocos acentos principales, dejá espacio a la voz y usá silencios intencionales.
Medir no obliga a cortar en cada beat ni convierte una base sintetizada en música
terminada. Conservá archivos relativos con `copy:true`; no redistribuyas audio
extraído de una referencia por inferencia.
