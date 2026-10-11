# Elegir y producir música y efectos

## Biblioteca portable

`syka_resources kind:sounds` y Biblioteca → Sonidos usan los mismos recursos. Se puede buscar `whoosh`, `pop`, `barrido`, `transición`, `música`, `fondo` o una intención más concreta. `audioType` separa efectos, música y capas conocidas; `audioFamily` filtra una familia de efectos. La biblioteca muestra primero las categorías y abre sus variantes al elegir una. Los archivos personales sin tipo musical declarado aparecen en Efectos, agrupados por nombre o en Otros sonidos. La preescucha no inserta nada. Al agregar se copia el original al proyecto.

El catálogo público conserva título, duración, BPM y punto de cue cuando se conocen, hash, origen y licencia. En un whoosh, el pico puede caer a mitad del archivo: para centrarlo en el cambio visual usá `start = momento del cambio - cuePoint`; no alinees todos los efectos por su primer sample. Los pops/impacts suelen tener su contacto cerca del comienzo. No inventes metadata que un archivo personal no tenga.

Las carpetas del usuario tienen prioridad sobre copias byte a byte. Un sonido con nombre parecido puede tener otro timbre; no lo trates como duplicado sólo por el nombre.

## SFX con una función

| Función visual | Familia candidata | Qué escuchar |
| --- | --- | --- |
| Selección, pequeño contacto | Click o tap | Ataque corto, sin un agudo que canse con repetición. |
| Aparición/rebote amable | Pop | Cuerpo pequeño y cola corta; que no parezca una explosión. |
| Desplazamiento/cambio de plano | Whoosh o swipe | Dirección, anchura y pico alineado con la transición. |
| Cambio de escala importante | Impacto suave | Grave con espacio; evitar golpes enormes debajo de una frase. |
| Anticipación y resolución | Riser → acento o downer | Duración del crecimiento y llegada al cue; no cortar la cola. |
| Confirmación o dato relevante | Chime/success | Motivo tonal breve compatible con la música. |

Elegí pocas familias compatibles para una pieza. Variá duración, nivel o timbre de gestos repetidos y agrupá microacciones. Reservá silencio; ni una animación ni una aparición de texto necesita obligatoriamente un sonido.

`audio-studio.mjs` usa ruido filtrado con barridos para whooshes, pitch/envelopes y ruido transitorio para pops/impacts, y osciladores con armónicos suaves/reflejos para cues tonales. La seed permite reproducir una variante. El efecto puede ajustarse al gesto en vez de ralentizar arbitrariamente el archivo: cambiar playbackRate también altera su tono y envolvente.

## Música por capas y estructura

Antes de generar o elegir una base, resolvé energía, duración útil, papel de la voz y arco: entrada → desarrollo → énfasis → cierre. BPM es una referencia de ritmo, no una orden de cortar en cada beat. Guardá esas decisiones con el storyboard.

El generador local ofrece tres puntos de partida: cálido con plucks/pads, pulso electrónico y ambient sin batería. Usa progresión armónica, notas con envolventes, bajo/percusiones cuando corresponde y delay estéreo a tempo. `--stems` escribe capas con **el mismo gain del mix**: su suma reconstruye la base, salvo redondeo PCM. Las capas vacías no se exportan. Ninguna grabación privada ni performance de terceros se muestrea.

Los stems permiten bajar melodía durante explicación densa, conservar armonía, quitar batería en la intro o reforzar un cambio de escena. No sumes los cuatro stems y el mix completo. Para cambiar timbre/arreglo en serio, adaptá el generador o escribí otra composición; tres presets no son una promesa de música ilimitada por texto libre.

`--loop` produce un ciclo con colas continuas. Sin `--loop` agrega entrada/salida; aun así, elegir el final musical y adaptarlo a la edición requiere revisar. Para una entrega de longitud distinta, generá suficientes compases, elegí una sección o armá continuidad por frases. No cortes una base a cualquier segundo dejando un transitorio o reverb truncados.

En una canción externa, el comienzo no siempre es la sección útil. Compará entrada, desarrollo y cierre contra la voz. En una pieza sin voz puede haber más densidad; con voz, seleccioná registro, instrumentos y arreglo que dejen aire antes de bajar todo por reflejo.

## Fuentes y uso compartido

- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) y [UI Audio](https://kenney.nl/assets/ui-audio): archivos originales CC0; procedencia/licencia incluidas en el catálogo. [Kenney confirma uso personal y comercial y atribución opcional](https://kenney.nl/support).
- Sonidos y música procedural Syka: código original y WAV bajo MIT; licencia incluida. Son bases electrónicas, no modelos entrenados ni una biblioteca de canciones comerciales.
- Freesound y otras bibliotecas pueden servir para ampliar una carpeta personal, pero hay que comprobar la licencia **del archivo**. No asumir que «gratis» permite redistribuir una colección con el editor.
- [Mixkit SFX](https://mixkit.co/license/modal/sfxFree/) permite usos dentro de obras finales pero prohíbe redistribuir los archivos solos en herramientas/plantillas: no se incluye como biblioteca de Syka.

[HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/skills/media-use/audio/references/bgm.md) separa búsqueda de música, generación y metadata de cues. Su ruta HeyGen depende de una cuenta; Lyria es un servicio y MusicGen tiene requisitos propios. `facebook/musicgen-small` declara CC-BY-NC-4.0: no se instala ni se usa como requisito/fallback comercial automático. Si el usuario elige un proveedor, comprobá acceso, condiciones y coste por separado. No heredar sus credenciales ni subir medios como consecuencia de leer una skill.
