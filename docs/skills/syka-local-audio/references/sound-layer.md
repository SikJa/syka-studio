# Selección, mezcla y revisión de una capa sonora

Adaptación independiente de [opus-sound-layer](https://github.com/Bodila51/opus-sound-layer),
revisado en el commit `52ac266a24b7dfd3cd06a28c34d5af360a8d7586` (10/10/2026).
El prompt de la captura de 0xCodila anunciaba 26 sonidos; el repo actual anuncia
1.139. Es un prompt y tres scripts, sin entrenamiento de pesos ni una skill con
`SKILL.md`. Sus ideas se traducen a herramientas/skills de Syka, sin otro renderer
ni descargar todo el kit en cada instalación.

## Resolver intención y seleccionar

En una pieza nueva, confirmar música, SFX, ambos, audio existente o silencio,
y presencia de voz. Reusar respuestas reales. Si cambia la elección sonora,
preguntar energía, carácter/material y referencia de sonido en una consulta
compacta; puede delegar esos detalles. La especificidad depende del pedido.

Relacionar cada cue con una acción: `appear` aparición, `move` velocidad máxima,
`land` contacto/asentamiento, `cut` cambio de plano. Las anclas actuales de
`motion_events` resuelven límites nativos con offsets; no detectan automáticamente
velocidad máxima ni contacto físico. Derivar un marker del mismo easing/spring o
registrar el instante inspeccionado. No inventar esa medición desde el nombre.

Elegir una familia (vidrio + aire, papel + tela, metal + cuerpo grave) apropiada a
la pieza. Buscar varias opciones con `syka_resources`: material/acción en `query`,
familia, `brightness:dark|balanced|bright` y `attack:sharp|soft` si hace falta.
Los filtros medidos excluyen archivos personales sin perfil. `soundProfile`
describe señal, no procedencia acústica, calidad percibida ni identidad semántica.
`sharp` significa rise medido <=25 ms, una clasificación orientativa.

No un hit en cada transición ni un hero obligatorio cada cuatro segundos.
Construir preparación, acento, descanso y cierre según relato/música. Un hero
puede tener cuerpo + detalle; alinear los ataques de ambas capas. Anticipación
puede empezar antes del evento. Agrupar microacciones y usar silencios acordados.

## Medir y colocar

Importar con `copy:true`. Para archivos externos/personalizados:

```json
{"source":"Audio/impacto-vidrio.ogg","detail":"sfx"}
```

`syka_audio_analyze` conserva el original. El detalle SFX admite 30 s, decodifica a
48 kHz estéreo y mide envelope de 2 ms + FFT Hann de 2048 muestras. El cue point es
el máximo de energía suavizada; no identifica automáticamente contacto o palabra.
Perfil: ataque 10–90%, centroid, energía <150/>6000 Hz, flatness, cola relativa,
correlación estéreo y bandas aproximadas. Un perfil silencioso devuelve null.

Usar `measuredCuePointSeconds` en reloj fuente. Con trim y velocidad:
`inicio = eventoNativo - (ataqueFuente - sourceIn) / playbackRate`.
No clamp de un inicio negativo: resolver preroll o cambiar/recortar el sonido.
Pitch que cambia duración exige medir de nuevo el archivo procesado.

## Proponer volumen sin perder edición

Cuando haya una base aislada de música + voz con niveles reales, usar:

```json
{"source":"Audio/impacto-vidrio.ogg","bed":"Audio/base-voz-musica.wav",
 "bedCueSeconds":3.2,"assetCuePointSeconds":0.04,"weight":"support"}
```

`syka_audio_balance` analiza la ventana del ataque contra la misma ventana de esa
base. Para support propone la banda suficientemente presente que requiere menor
ganancia; para hero, la dominante. Incluye graves desde 30 Hz. Lift por defecto
3/5 dB, configurable 1–6; gain candidato limitado a −36/+12 dB y pico individual
−2 dBFS. Son ayudas, no objetivos universales ni mastering del mix.

Aplicar `suggestedNativeVolumeDb` a `volume` o un keyframeTrack nativo; escuchar y
corregir. El cálculo es una aproximación FFT, no masking perceptual, separación
de fuentes ni sidechain de EQ. `bedCueSeconds` es relativo al archivo base, no
automáticamente el reloj de composición. Sin base aislada, elegir por escucha y
medir el mix real. Ducking de música bajo voz usa las curvas nativas existentes.

Una sala corta compartida o pitch tonal pueden servir, pero no aplicar reverb a
todo ni afinar foley de fuerza. Syka no incorpora aquí un bus de reverb/EQ ni
pitch independiente del tiempo; pedir/crear un derivado sólo si se necesita,
con derechos y cue point remedido. No sustituir el motor por el mixer Python.

## Revisar el resultado real

Con un export ya disponible:

```json
{"source":"Export/pieza.mp4","cues":[
 {"id":"botella-contacto","seconds":3.2,"asset":"Audio/impacto-vidrio.ogg",
  "assetCuePointSeconds":0.04,"playbackRate":1,"toleranceMs":33.33}]}
```

`syka_audio_review` mide LUFS/true peak del archivo codificado y compara fingerprints
del asset concreto dentro de ±80 ms. Usa ventanas de audio estéreo a 8 kHz, sin
cancelar L/R; contempla playbackRate por remuestreo. No compara sólo el stem SFX
sumado. El valor `.45` de correlación es heurístico, no una probabilidad.

`matched` sólo indica un candidato parecido; `withinTolerance` contrasta su
desfase contra el margen pedido. Sonidos repetidos, fondo correlacionado, EQ,
reverb, pitch y codec pueden confundirlo. `inconclusive`, falta de ventana,
silencio o falta de template no se transforman en un pass. No demuestra
audibilidad individual ni inteligibilidad. Una frecuencia dominante no es
detección de tonalidad musical. Máximo 180 s/export y 12 cues.

Enviar tiempos del archivo real: `eventoNativo - inicioRealDelExport`. Reanalizar
cuando cambia el export. Sin targetLufs no imponer −14; con target explícito se
informa diferencia. El usuario escucha esos timecodes y el conjunto a volumen
comparable; luego corregir pocos problemas de mayor impacto y volver a medir.
La revisión devuelve SHA256 del export y de cada asset usado; falla si cambian
mientras se miden. Esto identifica la evidencia, no demuestra qué revisión del
proyecto produjo el export.

## Recursos incluidos y procedencia

La app incorpora cuatro packs CC0 de Kenney seleccionados por utilidad para motion:
Impact, Sci-fi, Casino y RPG; conserva Interface/UI y efectos/música propios.
Excluir previews, footsteps, motores sostenidos y duplicados por SHA256. No
eliminar colas ni convertir todo en transientes; conservar archivos originales.
Las licencias están en `resources/sounds/LICENSE-KENNEY-*.txt`; catálogo registra
origen, hash, formato, cue y perfil. La selección de packs y hashes de archivo se
conserva en `resources/sounds/sources/kenney-motion-packs.json`.
Los patrones de selección adaptados del catálogo upstream conservan su aviso
MIT en `licenses/LICENSE.opus-sound-layer.txt`; no cambia la licencia CC0 de
los archivos sonoros originales.

Recursos y metadatos viajan en el staging público de Syka. La instalación no
necesita Python, uv, una cuenta Freesound ni el archivo personal del desarrollador
para usar esa biblioteca. Medición/revisión requieren el FFmpeg/FFprobe local
configurado por la app. Freesound/Openverse son fuentes opcionales adicionales:
comprobar licencia por asset, preservarla, evitar cargar una librería entera al
contexto y no tratar un preview MP3 como un original de estudio.
