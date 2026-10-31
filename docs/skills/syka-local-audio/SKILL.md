---
name: syka-local-audio
description: "Diseñar música y SFX en Syka: elegir sonidos por material/ataque/brillo, alinear cues medidos, proponer volumen contra la base real y revisar el mix exportado con fingerprints. Usar al pedir audio o mejorar una mezcla; conserva Diffusion y edición nativa."
---

# Música y diseño sonoro nativo

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Conservá audio original y pistas nativas editables. Síntesis local, medición y mezcla están disponibles; no son escucha semántica ni permiso para servicios pagos/modelos. En revisiones conservá música aprobada, sin doblar mix y stems.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

### Fuente preferida para motions y lanzamientos online

Para una pieza nueva destinada a redes, YouTube o publicidad online, buscá
primero música adecuada en **Mixkit** con `syka_mixkit` (`action:search` por
género y ánimo, `action:download` del elegido, que deja la licencia registrada
en el proyecto), además de los recursos propios elegidos por el usuario. Esta preferencia elige una fuente, no una canción fija ni un
sonido universal. Compará opciones por carácter, desarrollo y cierre; conservá
el historial de variedad y la música aprobada al revisar la misma pieza.
Leé [references/mixkit.md](references/mixkit.md) antes de descargar o reutilizar
un recurso: música y SFX tienen licencias diferentes. Seleccioná sólo lo necesario
para la obra; no incorpores su banco al instalador, a un pack o a plantillas.

Si el usuario pide música compuesta originalmente, aporta una pista o el destino
no admite la licencia musical de Mixkit, seguí esa dirección. La síntesis local
es una alternativa creativa cuando encaja o fue pedida, no el reemplazo por
defecto de una grabación adecuada. Si no hay una pista autorizada que encaje,
planteá la carencia concreta y las alternativas sin repetir música a escondidas.

### Búsqueda, clasificación y música nueva

El catálogo incluido no limita la creación musical. Buscá por intención con
`syka_resources`, hasta cuatro candidatos; compará también carpetas personales.
`classificationSource:filename` es una sugerencia, no análisis del audio. Los
archivos desconocidos se devuelven sin inventar un tipo. Si corresponde,
`action:classify kind:sounds path:<archivo o carpeta conectada>
classification:music|sfx|stem` conserva una corrección fuera del original;
`classification:auto` restaura la detección. La UI ofrece el mismo control.
No inventes derechos de redistribución ni instrumentación a partir del nombre.

Leé `musicDecision`: si faltan candidatos adecuados o solo quedan familias
recientes, ampliá la búsqueda a la fuente preferida cuando el destino lo permita;
no recicles una base como salida silenciosa. Cuando el brief pida o admita
una composición sintetizada, usá **`syka_music_create`**: estilo editorial,
ambient, pulse, lofi, cinematic o bright; duración exacta de 4–60 segundos;
BPM opcional. Produce un WAV y stems con armonía, motivo y arreglo nuevos,
registra su familia/elección y termina el worker al acabar. El agente todavía
debe escucharlo en contexto e insertar pistas nativas; no suma mix y stems.
La semilla hace reproducible la composición, no demuestra variedad por sí sola.

Si pide una interpretación realista, voz cantada, otro género que el generador
no resuelve o rechaza la síntesis, **preguntá** si prefiere aportar una pista,
usar una biblioteca autorizada o elegir un proveedor. No actives servicios de
pago por tu cuenta ni afirmes que un pluck sintetizado es una grabación de piano.
Reutilizá decisiones explícitas del proyecto para no preguntar lo ya resuelto.
Una revisión conserva su música; una pieza nueva usa `newPiece:true`. Repetir
una pista/familia reciente en una pieza nueva requiere una elección explícita
del usuario (`allowRepeat:true`), no un motivo inventado por el modelo.

Los SFX también registran uso local y entre proyectos: elegí un kit coherente
por material/función y variá candidatos pertinentes, sin convertir diversidad
en ruido aleatorio. Se cachean hashes de audio sin cambios; no se carga el
catálogo completo ni se ejecuta un modelo para cada búsqueda.

El agente puede producir sonido con código local y editar pistas de Diffusion. Resolver el audio significa elegir timbre, función, ritmo y relación con la voz; crear un archivo no demuestra que la mezcla suene bien. Los contratos de automatización y medios de HyperFrames/Remotion se adaptan al reloj de Diffusion, sin instalar sus motores ni copiar sus atributos.

## Build

### Elegir el camino

Antes de elegir música, consultar `syka_creative_selection action:status`. Buscar
`syka_resources action:list kind:sounds audioType:music limit:4` por intención.
Para otra pieza, incluso dentro del mismo proyecto, agregar `newPiece:true`; en
una corrección conservar lo elegido. El host usa relevancia, continuidad y menor
prioridad para pistas/familias recientes. `excludeIds` y `nextOffset` permiten
alternativas. Registrar ID, `role:music` y motivo con `syka_creative_selection`;
después de importar, `projectAsset` verifica la copia mediante SHA-256.

Hay ocho bases incluidas: tres de Syka y cinco scores breves originales de
OpenDesign (Apache-2.0, procedencia y licencia incluidas). Las tres bases Syka
comparten una familia armónica; variar su seed no crea otra composición. Elegir
según la pieza y escuchar, sin convertir ningún preset en fallback universal.
Las pistas OpenDesign no son loops certificados ni música de los posts originales;
ajustar duración/cierre y preservar sus créditos. Estos recibos no certifican escucha.

- Buscá recursos del proyecto y `syka_resources` con `action:list`, `kind:sounds`, `query` en español o inglés y, si sirve, `audioType:sfx`, `music` o `stem`. `audioCategories` devuelve las familias con cantidades; `audioFamily:pop`, `whoosh`, `click`, etc. limita las variantes al gesto buscado. La biblioteca incluida tiene Kenney CC0, Cuelume MIT, efectos originales y bases/capas Syka MIT; las carpetas personales siguen siendo opcionales. Evaluá candidatos por su función y escuchalos en Biblioteca, no elijas el primer nombre por defecto.
- Para demos de apps, botones, menús, escritura y resultados, leé [references/cuelume.md](references/cuelume.md): 14 cues × 4 materiales × 3 arreglos de intensidad, ya renderizados como WAV locales. Buscá `query:Cuelume` o `query:"Cuelume press"`, elegí por evento/material, importá con `copy:true` y colocá `<audio>` nativo. No uses `bind()`/`play()` en HTML para sonorizar un video: esos eventos de interfaz no se conservan en seek/export. No reemplaces los sonidos de la aplicación por los del video.
- Para foley, impactos o una mezcla exigente, leé [references/sound-layer.md](references/sound-layer.md). Elegí por material y función, usando `brightness`/`attack` y `soundProfile` cuando existan. Conservá una familia sonora coherente y variá repeticiones. No conviertas una preferencia por grabaciones en una prohibición universal de síntesis.
- Si el brief pide o admite música sintetizada original, usá `syka_music_create`: registra automáticamente la composición y consulta historial. Conservá la preferencia de Mixkit para piezas online y los medios aprobados; no confundas ausencia en el catálogo local con ausencia de música autorizada. Para trabajo avanzado por CLI, obtené **ambos** `scripts/audio-studio.mjs` y `scripts/music-composition.mjs` mediante `syka_skills read`, guardalos juntos en el proyecto y ejecutá con Node. No necesita Python, modelos, red ni paquetes npm. Produce WAV estéreo a 48 kHz, metadata, variantes reproducibles y capas separadas opcionales. El CLI aislado no conoce el historial entre proyectos: ese control lo aplica la herramienta nativa.
- El generador previo `scripts/synthesize.py` sigue disponible como alternativa Python estándar para cues y bases sencillas; no es el camino principal para una música más desarrollada.

Descubrí la carpeta con `syka_skills list` y leé sólo el soporte necesario con `path` y `file` relativo. `syka_read_reference` lee documentación del motor, no estos scripts. Los scripts rechazan sobrescrituras; elegí otra salida para una variación.

```text
node "audio-studio.mjs" --kind whoosh --variant 1 --duration 0.5 --seed 9 --output "Audio/whoosh.wav"
node "audio-studio.mjs" --kind music --style editorial --bpm 96 --duration 24 --seed 29 --loop --stems --output "Audio/base-calida.wav"
node "audio-studio.mjs" --kind music --style pulse --bpm 116 --duration 20 --stems --output "Audio/pulso-con-cierre.wav"
```

- El script sintetiza `pop`, `click`, `tap`, `whoosh`, `swipe`, `impact`, `riser`, `downer`, `chime`, `success`, `notification` y `shimmer`. Música: seis estilos con armonías/motivos/arreglos distintos, BPM, duración, seed y loop/cierre. Los antiguos `--mood warm|pulse|ambient` siguen siendo compatibles. Son puntos de partida configurables, no generación musical universal por texto libre.
- Para música/SFX elaborados, leé [references/music-and-sfx.md](references/music-and-sfx.md): mapa de cues, arreglo por capas, elección de secciones y fuentes de recursos. Un instrumental sintetizado no reemplaza automáticamente una producción musical profesional o instrumentos realistas. Otros proveedores/modelos son una elección independiente, no un fallback silencioso.
- Antes de reutilizar un FFmpeg empaquetado por otra aplicación, comprobá que tenga los filtros y formatos necesarios (`-filters`, `-formats`). Algunos binarios reducidos sirven para render específico pero no para extraer PCM/rawvideo. Verificá el código de salida y la cantidad de muestras antes de calcular métricas; un decoder sin datos no demuestra silencio ni corrupción del video.

### Integración

Para microacciones y respuestas de interfaz también está la colección pública
Bencho: 24 WAV locales. Buscá por material/acción y proveedor con `syka_resources`;
consultá [references/bencho.md](references/bencho.md) al usarla. Copiá sus archivos
al proyecto e insertá clips nativos; no necesita modelos ni sonido por eventos DOM.

Para anuncios/demos con música, consultá [Earshot launch](references/earshot-launch.md)
y usá `syka_launch_audio` sobre acciones reales. Prepara tomas portátiles y un
componente de clips nativos con sincronización, variantes y volumen contra la
base. Insertá su JSX en la escena activa y comprobá las pistas en timeline;
crear los archivos por sí solo no cambia la composición. El kit y la biblioteca
no necesitan modelos. `syka_earshot_analyze` es una opción avanzada explícita,
con entorno privado preconfigurado; no lo invoques por rutina.

El perfil `brief.audio.microActions:detailed` permite una capa más expresiva de
acentos pequeños en clics, selección y respuesta, con peso support. Agrupá gestos
rápidos, variá material y separá acentos principales; el fondo ambiental no pide
sonido por cada pulso. selective concentra los acentos y none omite esta capa.
Respetá el modo elegido, voz y pausas; no convertirlo en un límite fijo de sonidos.
Para una narración existente, las palabras medidas se conectan con event.wordCue
en syka_motion_plan; consultar syka-product-launch/references/narration-sync.md.

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

## Review

### Verificación

Verificá duración, frecuencia de muestreo, niveles, clipping, costuras y ubicación temporal. El generador devuelve pico/RMS, no LUFS ni true peak; `syka_audio_analyze` sí mide esos valores mediante FFmpeg sobre audio existente. Analizá también el mix real disponible, no solo sus stems. Compará voz sola, música sola y mezcla; ofrecé una preview audible para juzgar calidad. Ajustá intensidad, timbre y cantidad al brief, sin un SFX en cada movimiento por costumbre.
Sobre un export ya autorizado/disponible, `syka_audio_review` mide el mix codificado
y compara cues con el asset concreto. `inconclusive` o `not-detected` requieren
escucha/diagnóstico; nunca equivalen a aprobado. No exportes sólo para satisfacer
esta revisión si el usuario no lo pidió. Para comparar versiones, igualá loudness
de escucha y conservá el original; un test verde no demuestra mejor sonido.

Guardá en la receta/plan de audio qué se usó, BPM/seed si corresponde, cues, niveles, recursos/licencias y revisión. Registrar una preferencia sonora no entrena pesos del modelo ni obliga a otros usuarios a esa música.
