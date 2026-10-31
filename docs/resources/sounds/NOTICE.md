# Sonidos incluidos con Syka

Catálogo offline: originales Kenney CC0, síntesis original Syka MIT, variantes Cuelume MIT, cinco partituras procedurales OpenDesign Apache-2.0 y un kit Earshot MIT de 53 efectos (quince ajustados a fuentes CC0). Los recursos conservan sus bytes o su procedencia de render y los avisos específicos. Las bases musicales son instrumentales proceduralmente compuestos; no se anuncian como canciones generadas por un modelo de texto.

`catalog.json` registra paths relativos, SHA-256, título, tags, tipo y familia de sonido, duración, origen/licencia y BPM/loop/cue cuando corresponde. Hay 641 efectos, ocho músicas de stock y once stems, además de composición local a demanda. Biblioteca abre las categorías antes de mostrar archivos. No contiene rutas personales ni credenciales. Los stems vacíos no forman parte del catálogo. Las carpetas privadas conectadas no se distribuyen.

Fuentes: https://kenney.nl/assets/interface-sounds y https://kenney.nl/assets/ui-audio. Archivo ZIP fijado y verificado por pack en `scripts/prepare-audio-catalog.mjs`; su extracción se prepara localmente antes de ejecutar el script. Se copia audio original y sólo se inspecciona con FFprobe; no se ejecuta código del archivo descargado.

Reproducción de catálogo: `node scripts/prepare-audio-catalog.mjs --source-dir <packs-locales> --ffprobe <binario>`. Es una operación de desarrollo; usar la biblioteca incluida no necesita FFprobe, Python, cuenta ni conexión. `audio-studio.mjs` sólo necesita el runtime Node para producir nuevas variaciones.

Licencias: `LICENSE-KENNEY-INTERFACE.txt`, `LICENSE-KENNEY-UI.txt`, `LICENSE-SYKA.txt`. No se copian las librerías privadas de HyperFrames, catálogos comerciales o sonidos con prohibición de redistribución standalone.

Los demás packs Kenney conservan `LICENSE-KENNEY-{IMPACT,SCIFI,CASINO,RPG}.txt`.
Cuelume conserva `LICENSE-CUELUME.txt` y `sources/cuelume.json`. OpenDesign conserva
`LICENSE-OPENDESIGN.txt` y `sources/opendesign.json`, incluyendo el manifest de cada
plantilla en el tag fijado `open-design-v0.25.0`. Se incorporaron únicamente sus
cinco músicas originales; no el audio de publicaciones utilizadas como referencia.

Earshot: Copyright (c) 2026 Leon Lin, `LICENSE-EARSHOT.txt`, snapshot
`925ebe56a1b755e5d354ab642bb8f344440cfa9c`. Los efectos fitted son resíntesis de
recetas ajustadas a grabaciones CC0, acreditadas en `CREDITS-EARSHOT-FIT.md`,
sin samples originales. `sources/earshot.json` registra el renderer, cada fuente,
receta, hash y medición. No se distribuyen modelos CLAP/AST ni runtime Python.
