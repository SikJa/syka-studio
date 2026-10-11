---
name: syka-local-audio
description: "Diseñar música y SFX en Syka: elegir sonidos por material/ataque/brillo, alinear cues medidos, proponer volumen contra la base real y revisar el mix exportado con fingerprints. Usar al pedir audio o mejorar una mezcla; conserva Diffusion y edición nativa."
---

# Música y diseño sonoro nativo

El agente puede producir sonido con código local y editar pistas de Diffusion. Resolver el audio significa elegir timbre, función, ritmo y relación con la voz; crear un archivo no demuestra que la mezcla suene bien. Los contratos de automatización y medios de HyperFrames/Remotion se adaptan al reloj de Diffusion, sin instalar sus motores ni copiar sus atributos.

## Elegir el camino

- Buscá recursos del proyecto y `syka_resources` con `action:list`, `kind:sounds`, `query` en español o inglés y, si sirve, `audioType:sfx`, `music` o `stem`. `audioCategories` devuelve las familias con cantidades; `audioFamily:pop`, `whoosh`, `click`, etc. limita las variantes al gesto buscado. La biblioteca incluida tiene Kenney CC0, efectos originales y bases/capas Syka MIT; las carpetas personales siguen siendo opcionales. Evaluá candidatos por su función y escuchalos en Biblioteca, no elijas el primer nombre por defecto.
- Para foley, impactos o una mezcla exigente, leé [references/sound-layer.md](references/sound-layer.md). Elegí por material y función, usando `brightness`/`attack` y `soundProfile` cuando existan. Conservá una familia sonora coherente y variá repeticiones. No conviertas una preferencia por grabaciones en una prohibición universal de síntesis.
- Para personalizar sonido o música electrónica, obtené `scripts/audio-studio.mjs` mediante `syka_skills read`, guardalo en el proyecto y ejecutalo con Node. No necesita Python, modelos, red ni paquetes npm. Produce WAV estéreo a 48 kHz, metadata, variantes reproducibles y, para música, capas separadas opcionales.
- El generador previo `scripts/synthesize.py` sigue disponible como alternativa Python estándar para cues y bases sencillas; no es el camino principal para una música más desarrollada.

Descubrí la carpeta con `syka_skills list` y leé sólo el soporte necesario con `path` y `file` relativo. `syka_read_reference` lee documentación del motor, no estos scripts. Los scripts rechazan sobrescrituras; elegí otra salida para una variación.

```text
node "audio-studio.mjs" --kind whoosh --variant 1 --duration 0.5 --seed 9 --output "Audio/whoosh.wav"
node "audio-studio.mjs" --kind music --mood warm --bpm 96 --bars 8 --seed 29 --loop --stems --output "Audio/base-calida.wav"
node "audio-studio.mjs" --kind music --mood pulse --bpm 116 --bars 8 --output "Audio/pulso-con-cierre.wav"
```

- El nuevo script sintetiza `pop`, `click`, `tap`, `whoosh`, `swipe`, `impact`, `riser`, `downer`, `chime`, `success`, `notification` y `shimmer`. Música: `warm`, `pulse` o `ambient`, BPM, compases, seed y loop/cierre. Son puntos de partida configurables, no estilos obligatorios ni generación musical por texto libre.
- Para música/SFX elaborados, leé [references/music-and-sfx.md](references/music-and-sfx.md): mapa de cues, arreglo por capas, elección de secciones y fuentes de recursos. Un instrumental sintetizado no reemplaza automáticamente una producción musical profesional o instrumentos realistas. Otros proveedores/modelos son una elección independiente, no un fallback silencioso.
- Antes de reutilizar un FFmpeg empaquetado por otra aplicación, comprobá que tenga los filtros y formatos necesarios (`-filters`, `-formats`). Algunos binarios reducidos sirven para render específico pero no para extraer PCM/rawvideo. Verificá el código de salida y la cantidad de muestras antes de calcular métricas; un decoder sin datos no demuestra silencio ni corrupción del video.

## Integración

Con un archivo real, usá `syka_audio_analyze` antes de alinear acentos importantes.
Mide ataques candidatos, cambios de energía, tempo/grilla candidatos y LUFS/true
peak sin modificarlo. Leé [references/measured-sync.md](references/measured-sync.md)
para rangos, reloj fuente, trim/rate y la diferencia entre señal medida y escucha.
Para un SFX de hasta 30 s pedí `detail:sfx`: su perfil se mide a 48 kHz estéreo,
con cue point de energía a 2 ms, ataque, brillo, cola y distribución espectral.
Usá `measuredCuePointSeconds` para su acento; los tiempos del perfil son relativos
al intervalo analizado. Reanalizá después de pitch, recortes o procesamiento.

En un motion completo, prepará un mapa de cues junto al storyboard: tiempo, evento visual, función sonora, asset, duración y nivel inicial. La anticipación puede empezar antes; el acento principal coincide con el contacto, selección o cambio de estado. Agrupá microacciones para no convertir la UI en una máquina de escribir. Reservá momentos de silencio y variá intensidad/timbre si se repite un gesto.

Elegí música por energía y evolución, no solo BPM. Podés sintetizar una base y capas propias, pero diferenciá un loop de prueba de un diseño musical terminado. Construí frase, cambio y cierre para la duración real. Para reutilizar música/SFX externos, conservá procedencia y condiciones de uso; no extraigas y redistribuyas el audio de una referencia por suponer que está disponible.

Importá con `assets copy:true` para conservar sonidos incluidos o de carpetas personales dentro del proyecto. Colocá audio en la composición activa con IDs/nombres claros. Leé `reference/jsx/audio.md`: `volume` está en dB, no en porcentajes; una curva nativa conserva edición y seek/export. No reproduzcas el mix musical completo junto a todos sus stems: estarías sumando la misma música dos veces.

Para una mezcla con voz o cambios musicales, leé [references/native-mixing.md](references/native-mixing.md). Usá `examples/audio-envelope.ts` y, si simplifica, `examples/NativeMusicBed.tsx`: producen keyframes editables de fade y ducking desde spans de voz y convierten timeline a tiempo fuente, incluso con trim/rate. Son reducción de volumen basada en cues/transcript, no detección semántica ni sidechain espectral automático.
Si hay una base aislada real con música/voz y su nivel de mezcla, `syka_audio_balance`
propone el `volume` del SFX por energía en su banda; el agente lo aplica a una pista
nativa editable. No pases el mix que ya contiene ese efecto como base.

Los keyframes de volumen usan tiempo de fuente: con `sourceIn` o `playbackRate`, convertí el cue/duck al reloj fuente. Un track gana frente a un preset `gain` sobre la misma propiedad; no se suman. El mix puede saturar aunque cada archivo no clipee. Medí el render mezclado y ajustá por contexto antes de perseguir una cifra fija de loudness.

Para limpieza pedida de audio existente, `syka_audio_enhance` crea un derivado local y conserva el original. Empezá por `gentle`: reducción de ruido de 6 dB, corte de graves a 70 Hz y normalización medida en dos pasadas a −18 LUFS / −2 dBTP; entrega WAV de 48 kHz / 24 bits. `speech` agrega más reducción, EQ y compresión: comparalo sólo si el problema lo requiere. No es aislamiento neuronal de voz ni elimina toda reverberación o música mezclada. El objetivo de loudness deja margen para mezclar; no es una garantía perceptual ni un objetivo universal de publicación. Probá A/B a volumen comparable. La escucha semántica del proveedor sigue deshabilitada; metadata, waveform y transcript no sustituyen oír la mezcla.

## Verificación

Verificá duración, frecuencia de muestreo, niveles, clipping, costuras y ubicación temporal. El generador devuelve pico/RMS, no LUFS ni true peak; `syka_audio_analyze` sí mide esos valores mediante FFmpeg sobre audio existente. Analizá también el mix real disponible, no solo sus stems. Compará voz sola, música sola y mezcla; ofrecé una preview audible para juzgar calidad. Ajustá intensidad, timbre y cantidad al brief, sin un SFX en cada movimiento por costumbre.
Sobre un export ya autorizado/disponible, `syka_audio_review` mide el mix codificado
y compara cues con el asset concreto. `inconclusive` o `not-detected` requieren
escucha/diagnóstico; nunca equivalen a aprobado. No exportes sólo para satisfacer
esta revisión si el usuario no lo pidió. Para comparar versiones, igualá loudness
de escucha y conservá el original; un test verde no demuestra mejor sonido.

Guardá en la receta/plan de audio qué se usó, BPM/seed si corresponde, cues, niveles, recursos/licencias y revisión. Registrar una preferencia sonora no entrena pesos del modelo ni obliga a otros usuarios a esa música.
