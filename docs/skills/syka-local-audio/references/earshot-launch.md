# Earshot 0.4: biblioteca y kit de lanzamiento

Syka incluye una selección de 79 sonidos Earshot: los 53 anteriores y 26 de
0.4. Conserva los WAV anteriores. Los nuevos son pops suaves, contactos de
madera/plástico, impactos cortos, mallets, obturadores y transiciones. Buscá por
acción/material con `syka_resources`, no por un archivo favorito fijo.

El kit `launch` upstream se distribuye aparte como 72 tomas locales en 20 roles,
con su preset, mediciones y licencia MIT. Sus variantes de teclado/notas no
llenan la grilla de Biblioteca de duplicados. No requiere Python ni modelos.
Los valores del preset son una dirección para anuncios con música; no son
reglas estéticas universales ni justifican sonorizar cada movimiento.

## Agente → proyecto → timeline nativa

1. Elegí música adecuada y autorizada, conservando la aprobada en revisiones.
   Prepará su sección exacta dentro del proyecto; el kit no crea canciones.
2. Derivá los cues de acciones reales del mapa temporal / `motion_events`.
   `syka_launch_audio action:status` lista roles y variantes sin generar nada.
3. `action:create` recibe `duration`, `cues:[{id,role,seconds}]` y opcionalmente
   `bed`, `bedVolumeDb`, `bedSourceIn`, `includeBed`, `stopDown`, `seed`.
   `seconds` es tiempo relativo a la escena; la música comienza en cero y rate 1.
   Para una base con otro inicio/rate prepará primero una sección equivalente.
   El máximo por llamada es 32 cues / 180 s; dividí piezas largas por escenas.
4. La herramienta copia únicamente las tomas usadas y sus licencias a Assets.
   El código se guarda en `components`, separado de las carpetas protegidas de
   medios. Entrega `EarshotLaunchAudio.tsx`, `componentImport`, `componentJSX` y plan
   reproducible. **Insertá el import y `<EarshotLaunchAudio />` en la escena
   activa mediante las herramientas de source.** Preparar archivos no es insertar
   pistas. Ajustá el import si el archivo de composición está en una subcarpeta.
5. Verificá que cada `<audio>` aparezca como clip nativo editable en la timeline;
   probá seek y reproducción. La mezcla usa el mismo motor de exportación.

Se conserva la anchura estéreo renderizada, la alineación por onset/peak, offsets
del preset y variantes por seed. Un inicio negativo se recorta con `sourceIn`,
sin correr el video. Los runs muy juntos se separan sólo en audio; un corrimiento
mayor a 150 ms se rechaza para que agrupes gestos en vez de desincronizarlos.
Revisá `requestedSeconds` / `audioCueSeconds` en el plan si hubo separación.
Elegí una nota compatible por `take` en los roles bell/text; sus pitches están
en `kit.lock.json`. Conservá seed/plan para revisiones, no regeneres por capricho.

Con una base aislada real, se mide su nivel K-weighted en bloques de 50 ms del
segundo anterior al cue, aplicando su volumen real. El gain sigue `bed_db` del
kit y limita el pico individual a -1 dBFS; sin base audible usa `level_db`.
Esto no garantiza el pico de la suma. `syka_audio_review` mide el export real.

`includeBed:true` genera **una** pista musical copiada, con trim y volumen
editables. No sumes esa pista a la copia previa de la misma música.
`stopDown:true` requiere `includeBed`: crea keyframes que bajan la música 9 dB
durante unos 400 ms antes de hit/drop/whoosh.long/swell y vuelven sobre el evento.
Es una adaptación dentro de los rangos del preset upstream (6–12 dB / 0.3–0.5 s),
no sidechain ni ducking debajo del efecto. Ajustalo al ritmo y a la voz.
Los keyframes se guardan en tiempo fuente incluyendo `bedSourceIn`.

## Análisis neuronal opcional

El arranque, Biblioteca, búsqueda y kit no importan Torch, CLAP o Transformers.
`syka_earshot_analyze action:status` tampoco inicia Python. La instalación normal
no trae modelos ni los descarga. La selección por metadatos sigue disponible.

Un usuario avanzado puede preparar un entorno Python privado de Earshot 0.4
según su README, cargar allí sus modelos y establecer `SYKA_EARSHOT_PYTHON` con
la ruta a ese Python antes de iniciar Syka. El paquete y los modelos tienen sus
propias licencias; no copiar credenciales ni mezclar entornos globales.
El primer aprovisionamiento explícito tiene aproximadamente 1.1 GB de pesos,
además de las dependencias. No se ejecuta desde el flujo normal de edición.

Después, `syka_earshot_analyze action:rank useModels:true query:... sources:[...]`
compara sólo 1–4 SFX locales ya preseleccionados, de hasta 15 s cada uno.
Se ejecuta CPU con 2 threads, caché offline y plazo de 90 s, serializado con los
trabajos de audio. Termina el proceso al concluir/cancelar; no mantiene modelos
residentes. Si faltan pesos o configuración informa el problema, no descarga ni
sube audio ni cambia de proveedor. La similitud no certifica gusto ni calidad.

Fuente fijada: https://github.com/Leonxlnx/earshot/tree/591fa3e028032e6dce56620a20e932e35667e8d8
Ver `docs/SFX.md`, `earshot/forge/kit.py` y `earshot/forge/kits/launch.json`.
