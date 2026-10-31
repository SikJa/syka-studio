# Elegir y producir música y efectos

## Biblioteca portable

`syka_resources kind:sounds` y Biblioteca → Sonidos usan los mismos recursos. Se puede buscar `whoosh`, `pop`, `barrido`, `transición`, `música`, `fondo` o una intención más concreta. `audioType` separa efectos, música y capas conocidas; `audioFamily` filtra una familia de efectos. Los archivos personales sin tipo conocido siguen disponibles en las búsquedas y en **Sin clasificar**, sin afirmar que sean música o efectos. La clasificación manual por archivo o carpeta se comparte entre UI y agente; el nombre sólo da una sugerencia provisional. La preescucha no inserta nada. Al agregar se copia el original al proyecto.

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

Primero buscá una pequeña selección relevante con `newPiece:true`. Revisar la misma pieza mantiene su base; una pieza nueva consulta historial de canciones y familias armónicas entre proyectos. Si no hay una opción nueva adecuada, `musicDecision` exige crear otra composición o preguntar por una fuente. No elijas una pista reciente con `allowRepeat:true` salvo pedido explícito de reutilizarla. Las últimas elecciones de SFX también bajan de prioridad, manteniendo la relevancia y la coherencia del kit.

`syka_music_create` crea música instrumental original con seis direcciones sintéticas: `editorial`, `ambient`, `pulse`, `lofi`, `cinematic` y `bright`. Cambia entre doce familias armónicas, motivos, registro y arreglo rítmico, evitando las familias usadas recientemente. Duración exacta de 4–60 segundos; devuelve WAV y stems dentro del proyecto. Corre en un worker que termina al acabar o cancelar. No descarga modelos ni usa una API. Si se agotan las familias disponibles, devuelve `needs_direction`; no afirma diversidad ilimitada. Una nueva seed por sí sola no prueba un cambio musical suficiente.

El generador usa plucks, pads, keys y percusión sintetizados con delay estéreo a tempo. `--stems` escribe capas con **el mismo gain del mix**: su suma reconstruye la base, salvo redondeo PCM. Las capas vacías no se exportan. Ninguna grabación privada ni performance de terceros se muestrea. **No produce interpretaciones realistas de piano/orquesta ni voces**: cuando eso sea esencial, o el usuario no quiera síntesis, pedí una fuente o proveedor autorizado en vez de forzar una de estas bases.

Los stems permiten bajar melodía durante explicación densa, conservar armonía, quitar batería en la intro o reforzar un cambio de escena. No sumes los cuatro stems y el mix completo. Escuchá las opciones en contexto; diversidad de hashes y mediciones sin clipping no certifican calidad musical.

`--loop` produce un ciclo con colas continuas. Sin `--loop` agrega entrada/salida; aun así, elegir el final musical y adaptarlo a la edición requiere revisar. Para una entrega de longitud distinta, generá suficientes compases, elegí una sección o armá continuidad por frases. No cortes una base a cualquier segundo dejando un transitorio o reverb truncados.

En una canción externa, el comienzo no siempre es la sección útil. Compará entrada, desarrollo y cierre contra la voz. En una pieza sin voz puede haber más densidad; con voz, seleccioná registro, instrumentos y arreglo que dejen aire antes de bajar todo por reflejo.

## Fuentes y uso compartido

- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) y [UI Audio](https://kenney.nl/assets/ui-audio): archivos originales CC0; procedencia/licencia incluidas en el catálogo. [Kenney confirma uso personal y comercial y atribución opcional](https://kenney.nl/support).
- Sonidos y música procedural Syka: código original y WAV bajo MIT; licencia incluida. Son bases electrónicas, no modelos entrenados ni una biblioteca de canciones comerciales.
- Earshot: kit seleccionado de 53 cues congelados, MIT con aviso de Leon Lin. Se conservan los veinte anteriores y se suman 33: deslizamientos de papel/terciopelo, barridos, subidas/descensos, impactos, firmas de logo, glitch, destello, dos plucks de kalimba y secuencia de escritura. Quince usan recetas de resíntesis ajustadas a grabaciones CC0, atribuidas en `CREDITS-EARSHOT-FIT.md`; no son los samples originales. Los otros 38 son diseñados. Se descartaron tres candidatos señalados por el control upstream; no se importan todos los 201. El manifiesto incluye commit, hashes, puntos de cue y mediciones; no requiere Python, Torch ni CLAP en la aplicación. Buscar material/gesto y escuchar con el video: mediciones técnicas no equivalen a aprobación artística ni estos plucks a canciones completas.
- Freesound y otras bibliotecas pueden servir para ampliar una carpeta personal, pero hay que comprobar la licencia **del archivo**. No asumir que «gratis» permite redistribuir una colección con el editor.
- Mixkit es la primera fuente a comparar para música de motions y lanzamientos destinados a web/redes, respetando medios y decisiones del usuario. Leé [mixkit.md](mixkit.md): su licencia musical admite videos/publicidad online, pero no TV/radio, videojuegos o discos. Elegir una pista para una obra no autoriza a redistribuir un catálogo ni convertirla en música propia; la preferencia no obliga a repetir una canción o forzar ese proveedor cuando no encaja.
- [Mixkit SFX](https://mixkit.co/license/modal/sfxFree/) permite usos dentro de obras finales pero prohíbe redistribuir los archivos solos en herramientas/plantillas: no se incluye como biblioteca de Syka.

[HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/skills/media-use/audio/references/bgm.md) separa búsqueda de música, generación y metadata de cues. Su ruta HeyGen depende de una cuenta; Lyria es un servicio y MusicGen tiene requisitos propios. `facebook/musicgen-small` declara CC-BY-NC-4.0: no se instala ni se usa como requisito/fallback comercial automático. Si el usuario elige un proveedor, comprobá acceso, condiciones y coste por separado. No heredar sus credenciales ni subir medios como consecuencia de leer una skill.
