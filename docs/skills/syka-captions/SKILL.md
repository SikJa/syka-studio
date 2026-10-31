---
name: syka-captions
description: Crear o corregir subtítulos editables en Syka con timestamps reales, frases legibles y sincronía tras cortes o cambios de velocidad.
---

# Captions legibles

## Contract

Syka entrega una composición audiovisual nativa editable dentro del proyecto. El pedido actual manda: conservá originales, voz, estilo/geometría aprobados y edición nativa. Un plan sólo es entrega si se pidió plan; al editar, aplicá la composición y comprobala. Un fallo deja verificaciones pendientes o bloqueadas, nunca habilita otra app, juego, web o motor como sustituto. Exportá sólo ante pedido explícito.

Conservá palabras, timestamps reales y estilo nativo editable. No inventes tiempos; después de cortes/velocidad remapeá el transcript existente sin aplicar trim dos veces.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Leé reference/jsx/captions.md, timing.md y text.md antes de elegir propiedades. Reutilizá el transcript existente; cuando haga falta transcribir, media_transcribe usa el proveedor configurado por el usuario.

### Biblioteca y tipografía

`Biblioteca → Subtítulos` muestra los diecinueve estilos del renderer con previews animados de demostración. Una tarjeta se aplica a captions existentes (también por arrastre y con Deshacer), o se arrastra al chat como referencia visual con el preset y la selección. Aplicar un estilo conserva el transcript, sus palabras y tiempos, el trim y la velocidad; nunca reemplaces el contenido por el texto del preview. La biblioteca también importa SRT/VTT/JSON o agrega captions que usan el servicio de transcripción configurado para la escena.

Consultá `fonts` antes de sugerir una familia. Las trece familias incluidas funcionan sin conexión; las fuentes propias se importan en `Biblioteca → Fuentes` o en el selector del inspector. El agente puede proponer alternativas entre piezas según tono y jerarquía: Inter/Urbanist/Figtree para lectura limpia, Montserrat ExtraBold/Poppins Black/Archivo Black para énfasis, Instrument Serif cursiva para relatos editoriales. Conservá una pareja coherente dentro de una pieza. Respetá los pesos y estilos reales, `missingSpanish` y la licencia. Una demo sin ñ o acentos no es una buena elección para subtítulos en español. Importar una fuente no autoriza incluirla en el instalador ni regalarla a otras personas.

### HyperFrames nativo

Hay ocho adaptaciones nativas adicionales en el mismo selector y la biblioteca: `hyperframes-clip-wipe`, `hyperframes-kinetic-slam`, `hyperframes-weight-shift`, `hyperframes-neon-glow`, `hyperframes-glitch-rgb`, `hyperframes-gradient-fill`, `hyperframes-parallax-layers` y `hyperframes-editorial-emphasis`. Son presets editables, no HTML embebido ni todos los estilos anunciados upstream. Usan fuentes locales, tiempos reales y colores editables; no descargan GSAP, texturas ni fuentes de CDN. Consultá `reference/jsx/captions.md` para elegir uno según el material. Kinetic Slam funciona por palabra y se reserva para golpes de énfasis; Glitch RGB sólo separa color brevemente al entrar. Para lectura continua priorizá Weight Shift, Clip Wipe o Editorial Emphasis según tono. No apliques un efecto intenso a todas las frases por costumbre. Conservá la selección del usuario y comprobá los primeros/últimos frames, silencios y reproducción hacia atrás.

## Build

### Datos y estilo

- Guardá el transcript crudo con una ruta nueva y conservá su procedencia. Si corregís texto, creá una versión revisada que preserve los intervalos reales; no inventes un timestamp por palabra cuando solo hay tiempos de frase.
- Elegí el preset por el resultado buscado, no siempre classic. whisper/paper son candidatos para frases; classic/spotlight para énfasis, cuando corresponda. El estilo aprobado del proyecto prevalece.
- Hay cuatro adaptaciones nativas de BridgeClip: `bridgeclip-subtle` para entrevistas discretas, `bridgeclip-editorial` para relato con serif itálica, `bridgeclip-boxed` para fondos que necesitan una placa de contraste y `bridgeclip-spotlight` para una píldora en la palabra activa. Mantienen transcript, tiempos, colores y fuentes locales editables. No son videos quemados ni necesitan el servidor de BridgeClip. Probá el estilo en la toma real; la existencia de cuatro opciones no justifica cambiar entre todas durante un reel.
- Agrupá según unidades de lectura, pausas y formato. Como punto de partida, una o dos líneas compactas; adaptá cantidad de palabras, tamaño y duración al material. No pases a minúsculas ni elimines muletillas automáticamente si altera la voz del hablante.
- Evitá dejar artículos, preposiciones o conectores («un», «de», «y») como un caption aislado por cumplir un conteo mecánico. Conservá la unidad de sentido, salvo que haya énfasis real. El renderer puede reagrupar por puntuación y por duración: `whisper` divide alrededor de 2 s; un timestamp largo puede separar una frase que parecía correcta en JSON. Comprobá la agrupación renderizada. Si necesitás frases exactas, elegí un preset adecuado o nodos de texto nativos con intervalos de frase; no falsifiques tiempos de palabras para forzar el preset.
- Evitá tapar caras, demostraciones o controles importantes. Probá contraste sobre el fondo real; no agregues un recuadro negro por costumbre.
- Mantené tipografía, posición y colores editables. Para letras o palabras destacadas, consultá textRange; no asumas que todos los presets admiten los mismos overrides.

### Tiempo

Separá tiempo del archivo original de tiempo de salida. Para un tramo conservado, tiempo de salida = inicio del tramo en timeline + (tiempo original - sourceIn) / playbackRate. Una palabra fuera del tramo no se coloca allí.

Después de varios cortes, generá intervalos de captions por tramo conservado o una pista con tiempos de salida. Un solo nodo no salta huecos internos. Evitá contar dos veces offset/trim. Recutar una escena no actualiza automáticamente su transcript cacheado; revisá src/seed según la referencia actual.

Usá **`syka_captions_retime`** para convertir el JSON real de `media_transcribe`
o un transcript nativo ya guardado en el proyecto. Pasá `source` y `spans`, cada
uno con `sourceIn`, `sourceOut`, `timelineStart` en segundos y `playbackRate`
(por defecto 1). Se pueden reordenar/repetir tramos de la fuente, pero no
superponerlos en una misma pista de salida. La herramienta conserva el original,
crea otro JSON con hash/procedencia y convierte sólo los tiempos existentes;
no transcribe, no consume cuota y no cambia la escena sola.

```json
{"source":"03 Assets reutilizables/Transcripciones/entrevista.json","spans":[{"sourceIn":10,"sourceOut":14,"timelineStart":0,"playbackRate":2},{"sourceIn":20,"sourceOut":23,"timelineStart":2,"playbackRate":1}]}
```

Importá/montá `relativePath` en `<captions src="..." preset="..." />` desde el
inicio de escena, a velocidad 1. Esos tiempos ya son de salida: no agregues el
trim original ni vuelvas a dividir por la velocidad. Revisá `clippedWords` y
`reviewCuts` cuando un corte atraviesa una palabra; conserva la parte visible
pero requiere decidir si mover el corte para que el audio se entienda. El JSON
compatible con el renderer no prueba sincronía escuchada ni aprobación visual.

### Captions integrados y detrás del sujeto

La intención upstream de embedded-captions se adapta a texto/caption nativo. Leé `syka-visual-direction` para elegir jerarquía y énfasis según el video. Las palabras importantes pueden tener una intervención más grande; no conviertas todas las palabras en un efecto hero. Reutilizá tiempos reales y conservá el clip base.

Texto detrás de una persona requiere una máscara/segmentación válida y capas coordinadas: footage base, texto y sujeto recortado por delante. `media_segment`/SAM2 puede preparar el recurso cuando el modelo local esté disponible. Comprobá el borde en varios frames, movimiento y sincronía con el source; no declares el efecto terminado sólo por producir una máscara. Si la segmentación no está disponible, explicalo y resolvé captions legibles delante, sin prometer oclusión. La skill no instala pesos ni inventa tracking automáticamente.

## Review

### Comprobar el resultado

Estos captions se **integran en el render nativo** y quedan editables; cubren la intención de embedded-captions sin crear un MP4 intermedio con otro motor. Si el usuario pide además SRT/JSON externo, es una entrega separada. Una referencia estética no exige imitar sus palabras o su idioma.

Para recuts, leé [examples/recut-timing.ts](examples/recut-timing.ts) mediante `syka_skills read`. Convierte intervalos fuente a salida por tramo y recorta lo que queda afuera. Si un corte atraviesa una palabra, la conversión conserva la parte existente, pero eso es una señal para revisar/mover el corte, no prueba de que suene bien.

Revisá una aparición durante habla, la primera/última palabra y los límites que cambiaste. En cambios largos, distribuí muestras y marcá palabras dudosas. check + capture confirma estructura/apariencia, no que hayas escuchado el archivo. Para correcciones pequeñas, no pidas aprobación extra ni exportes el video entero.
