# Presets de subtítulos de BridgeClip

Verificado el 6 de octubre de 2026. Checkout local y main remoto: b996820ef80fa324a3ad233bef1aac5cc6936804.

BridgeClip tiene 13 presets de subtítulos: Pop, Spotlight, Impact, Glow, Boxed, Sweep, Editorial, Hype, Punch, Neon, Headline, Paper y Subtle. No son imágenes descargables: son estilos con agrupado de palabras, tipografía, colores, contornos, sombras, glow, cajas/píldoras y temporización. `CaptionPresetPicker.tsx` contiene muestras estáticas y una preview animada con una frase común, pausa, scrub y replay. `config.py` define los estilos reales; `caption_generator.py` compone capas ASS que FFmpeg/libass quema en el video.

## Material y licencias

`references/bridgeclip-captions/`: catálogo estático HTML/PNG, 13 definiciones de preview JSON, registro TypeScript de presets, funciones de estilo Python como referencia, siete fuentes usadas por captions, cinco avisos de licencia de sus familias y licencia MIT BridgeClip. PROVENANCE.json fija commit y hash del picker. Cuatro estilos ya tienen una adaptación nativa en Syka; los otros nueve siguen siendo referencias.

El código BridgeClip es MIT y conserva copyright/licencia. Las fuentes son SIL OFL 1.1 con avisos propios; no se modificaron. Plus Jakarta es fuente de interfaz y no se copió para este paquete de captions. No se copiaron logos de terceros ni binarios FFmpeg.

## Integración nativa completada

Syka conserva Classic, Cascade, Spotlight, Whisper, Paper, Guinea y Stark sin renombrar sus IDs. Los cuatro nuevos estilos usan IDs `bridgeclip-*`, por lo que Spotlight de Syka sigue siendo independiente de Spotlight de BridgeClip.

| ID nativo | Fuente local | Comportamiento |
| --- | --- | --- |
| `bridgeclip-subtle` | Montserrat ExtraBold 800 | Hasta cuatro palabras, futuro al 55 %, énfasis celeste suave. |
| `bridgeclip-editorial` | Instrument Serif Italic 400 | Hasta cuatro palabras, futuro al 60 %, énfasis crema. |
| `bridgeclip-boxed` | Archivo Black 400 | Hasta tres palabras, placa oscura por línea, palabra activa amarilla y rebote corto. |
| `bridgeclip-spotlight` | Poppins Black 900 | Hasta tres palabras, píldora violeta bajo la palabra activa y rebote corto. |

El selector está en **Subtítulos → Estilo**. También admite varios bloques de subtítulos seleccionados: muestra “Varios estilos” si difieren y aplica el nuevo estilo con un solo Deshacer, junto con el reinicio de los colores de cada preset. Los colores de énfasis/fondo/píldora usan los controles nativos. Fuente, tamaño, posición y timestamps siguen editables. Las placas y píldoras forman parte del preset, no son nuevas capas independientes.

`packages/runtime/src/media/caption/bridgeclip.ts` dibuja en el motor Diffusion; no reproduce un video prerenderizado ni un documento HTML. El agrupado conserva palabras y tiempos, corta por pausas/puntuación y sostiene cada frase como máximo 700 ms sin pisar la siguiente. Las animaciones dependen del tiempo absoluto de la composición. Se mantienen los avisos MIT y OFL y se empaquetan las cuatro fuentes y sus licencias con la aplicación.

La adaptación conserva la intención visual de BridgeClip; no promete equivalencia píxel a píxel con su renderizador ASS/libass.

## Proyecto y comprobaciones

Proyecto reabrible: `F:/Coding Proyects/Syka Clips/Pruebas Syka/12-subtitulos-bridgeclip`, ID `91d7aaa6-1521-4344-a726-27b9148a7a44`. Son 24 segundos verticales: la misma toma real y los mismos seis segundos de voz con limpieza suave se repiten para comparar los cuatro estilos. `COMO_PROBAR.md` indica cómo recorrerlos y modificarlos.

Evidencia en `Pruebas Syka/resultados/`:

- `12-subtitulos-bridgeclip.mp4`: exportación nativa 1080 × 1920, 30 fps, 24 segundos.
- `12-bridgeclip-{subtle,editorial,boxed,spotlight}.png`: capturas del render nativo.
- `12-bridgeclip-selector.png`: selector real dentro de Syka.
- `bridgeclip-validation.json`: chequeo del documento sin problemas, cuatro fuentes cargadas, capturas idénticas al retroceder y exportación.
- `bridgeclip-ui-validation.json`: cambios desde el selector real, actualización de la fuente, Deshacer/Rehacer de preset y colores como una unidad, selección múltiple, persistencia tras recarga y restauración de la prueba.

Los tests de captions pasan 23/23. La compilación web de producción incluye las cuatro TTF y los cinco avisos de licencia. El video exportado se verifica además decodificándolo completo con FFmpeg. Esto valida ejecución local Windows; no equivale a una prueba en Mac ni a una aprobación estética del usuario.

Durante estas pruebas se corrigieron tres errores existentes: Deshacer podía restaurar el código pero dejar la imagen anterior por una caché del editor; el selector de fuente podía quedar desactualizado al cambiar preset; Guinea cambiaba de color al volver al mismo segundo. Las comprobaciones de integración cubren los dos primeros, y un test de seek cubre Guinea.

## Pendiente

Sweep requiere un barrido real del glifo según progreso de la palabra; Impact/Punch requieren agrupado propio y tamaños seguros; Glow/Neon deben probarse en seek/export. Evitar reemplazarlos por un MP4 quemado como fuente.

Quedan nueve estilos BridgeClip por evaluar y adaptar si aportan algo, además de guardar los estilos aprobados en recetas y Brand Kit. La limpieza suave queda como preferencia del ensayo de audio 07, no como entrenamiento del modelo. La ingesta por URL se trabaja por separado y no forma parte de esta validación de captions.

Fuentes: https://github.com/bridge-mind/bridgeclip/blob/b996820ef80fa324a3ad233bef1aac5cc6936804/src/shared/caption-presets.ts ; https://github.com/bridge-mind/bridgeclip/blob/b996820ef80fa324a3ad233bef1aac5cc6936804/engine/clip_engine/config.py ; https://github.com/bridge-mind/bridgeclip/blob/b996820ef80fa324a3ad233bef1aac5cc6936804/LICENSE ; https://github.com/bridge-mind/bridgeclip/blob/b996820ef80fa324a3ad233bef1aac5cc6936804/engine/THIRD_PARTY_NOTICES.md
