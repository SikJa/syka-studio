# Audio, biblioteca y categorías — 04/10/2026

Se reforzó `syka-local-audio` y se conectó una biblioteca pública offline al editor y a `syka_resources`. Diffusion conserva composición, clips, automatización y render. No se creó un instalador, no se integró una skill privada, no se ejecutó generación cloud ni se modificó la edición Liquid que aprobó Sikora.

## Qué se implementó

- 151 OGG originales Kenney: 100 de Interface Sounds y 51 del ZIP UI Audio, excluyendo previews. La página UI anuncia 50; el archivo descargado contiene 51 efectos incluidos y verificables. ZIPs fijados por SHA-256 y archivos/licencias CC0 conservados.
- 36 WAV originales Syka: tres variantes para cada una de 12 familias de síntesis. Incluye pops, clics, toques, whoosh/barridos, impacto, subida/bajada, campana, confirmación, notificación y destello.
- Tres bases electrónicas: cálida 96 BPM, pulso 116 BPM y ambient 80 BPM. Once stems activos de armonía/melodía/bajo/percusión; ambient no exporta una batería muda. Mix y capas conservan la misma ganancia, evitando normalización independiente que impida reconstruir la base.
- Generador `audio-studio.mjs`: Node estándar, WAV estéreo PCM16/48 kHz, semilla, timbre/variante/duración, BPM/compases, loop o fades y stems. Rechaza sobrescritura y parámetros inválidos. No se presenta como compositor de cualquier género por texto. El script Python anterior permanece como alternativa.
- Catálogo de 201 archivos/60.560.174 bytes, con hashes, licencia, duración, tipo, familia y BPM/cue cuando corresponden. Los recursos públicos se preparan con `stage:docs`; no requieren carpetas D/F ni bibliotecas privadas.
- Biblioteca: preescucha sin inserción; filtros Efectos/Música/Capas; importación con copia a `assets/sounds`. Efectos entran a −12 dB y bases/capas a −16 dB como niveles iniciales editables. La búsqueda preserva logos: Supabase 3/Vercel 6 sin warnings, configuración personal intacta.

## Organización solicitada

La portada muestra 16 categorías, sin montar las 187 tarjetas de efectos. Abrir una familia muestra sólo sus variantes; hay vuelta, búsqueda dentro del grupo y paginación de ese grupo. Cambiar tipo resetea familia/página y detiene preescucha. Un resultado vacío mantiene el nombre de la categoría. Los nombres desconocidos de carpetas conectadas quedan en Otros sonidos.

| Familia | Archivos |
| --- | ---: |
| Pops | 10 |
| Whoosh y barridos | 6 |
| Clics | 29 |
| Toques | 6 |
| Impactos | 3 |
| Subidas | 3 |
| Bajadas | 3 |
| Campanas | 9 |
| Confirmación | 7 |
| Notificaciones | 7 |
| Destellos | 3 |
| Errores | 8 |
| Abrir y cerrar | 30 |
| Interruptores | 49 |
| Glitch | 4 |
| Texturas | 10 |

`audioCategories` devuelve cantidades antes de paginar, y `audioFamily` selecciona una familia también desde el agente. La UI usa la transición `t-panel-slide` ya instalada de transitions-dev y respeta reduced motion. No depende de selectores nativos del sistema.

## Adaptación de la mezcla

De [HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes-audio/references/presets.md) se toma organización de cues, selección de recursos, capas y espacio para la voz. De [Remotion](https://www.remotion.dev/docs/audio/volume), automatización y cuidado del reloj. Se traduce a dB y tiempo fuente de Diffusion, sin copiar sus props ni integrar sus renderers.

`examples/audio-envelope.ts` agrupa pausas cortas, evita subir la música entre palabras y combina fade/ducking en una única curva editable. Usa spans de voz ya remapeados al montaje y `sourceIn + (timelineTime - start) * playbackRate`. `NativeMusicBed.tsx` genera un clip y sus keyframes. Esto no detecta voz automáticamente ni implementa carve espectral, EQ/compresión nativas o escucha semántica cloud. FFmpeg puede preparar derivados explícitos cuando se necesita procesar un archivo; no se confunde ese derivado con un efecto en vivo.

## Validación realizada

- Compilación de escritorio/host y web, TypeScript de agent-chat/web/escritorio, staging de docs y validador de skill pasan. Build conserva warnings previos de framer/sourcemaps y tamaño de chunks.
- 142 tests/19 archivos de agent-chat y 168 tests/31 archivos de escritorio pasan. Casos nuevos cubren síntesis reproducible, PCM, protección de archivos, suma de stems, continuidad de loop, spans/trim/rate, clasificación, paginación y lectura de recursos sin perfil personal.
- Los 201 archivos se decodificaron completos y sus hashes coincidieron. Los WAV propios no clipean. Diecinueve OGG originales presentan overshoot de decodificación, máximo aproximado +2,99 dBFS; se preserva el original y se deja margen de ganancia al insertar. Esto no garantiza que la suma de muchas pistas quede sin clipping.
- Preescucha real: `currentTime > 0`, pausa al cambiar tipo, ninguna modificación de `index.tsx`. Inserción real copiada a assets con `volume={-12}`, luego deshecha dentro del proyecto de prueba.
- Categorías reales: portada con cero tarjetas de audio, Pops 10/Whoosh 6, búsqueda vacía conservando título, Interruptores paginados 48+1, Música 3 y reseteo correcto. Reduced motion devuelve transición 0s.
- Render Diffusion de mezcla con voz: 15 segundos, OGG/Opus 48 kHz/128 kbps. Comparación de dos renders sólo de música: trim 2, rate 1.1, reducción medida −12,0015 dB y recuperación +0,0730 dB frente a referencia. Se restauró la composición de prueba después.
- Demo móvil MP3: 67,0135 segundos, 837.893 bytes; loudness −19,0 LUFS/true peak −6,7 dBFS. Métricas y reproducción comprobadas; no se presentan como una aprobación auditiva humana del estilo musical.
- `index.tsx` y MP4 aceptados de Liquid conservaron sus SHA verificados. La prueba nueva vive en `projects/Prueba de audio - 2026-10-04`.

Evidencias locales: `.runtime/audio-library-2026-10-04/{audit,live-library,ui-verification,category-verification,envelope-render,demo-file}.json`. Las previews finales `output/playwright/portada-sonidos.png` y `categoria-whoosh.png` renderizan el DOM real del panel y su CSS compilado en un navegador aislado: capturar una ventana Electron minimizada devolvía buffers anteriores. No son imágenes inventadas por un generador.

## Fuentes y límites de distribución

[Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), [UI Audio](https://kenney.nl/assets/ui-audio) y [soporte/licencia](https://kenney.nl/support) permiten incorporar estos assets CC0. La síntesis propia se distribuye bajo MIT. Fuentes, licencias y hashes quedan dentro de `docs/resources/sounds`.

[Mixkit SFX](https://mixkit.co/license/modal/sfxFree/) sirve para obras terminadas pero prohíbe redistribuir sus sonidos solos en herramientas/plantillas, por eso no se incluyó. La ruta de [música de HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/skills/media-use/audio/references/bgm.md) contempla proveedores/cuentas y modelos; [MusicGen small](https://huggingface.co/facebook/musicgen-small) declara CC-BY-NC-4.0. No se instala como dependencia comercial predeterminada ni se usan claves de otra aplicación. Snapshot investigado HyperFrames: `cd0d04e4e983a71b5720a8248176a0cd2c7d3518`.

La distribución en una PC limpia y el empaquetado completo siguen pendientes. La biblioteca y la síntesis local están implementadas y verificadas en esta máquina; la calidad musical final queda para la escucha del usuario y una dirección concreta por proyecto.
