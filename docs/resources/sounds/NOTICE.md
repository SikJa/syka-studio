# Sonidos incluidos con Syka

Catálogo offline: originales Kenney CC0 y síntesis original Syka MIT. Kenney Interface Sounds y UI Audio conservan sus bytes y licencias. Las bases musicales son instrumentales electrónicos proceduralmente compuestos; no se anuncian como canciones generadas por un modelo de texto.

`catalog.json` registra paths relativos, SHA-256, título, tags, tipo y familia de sonido, duración, origen/licencia y BPM/loop/cue cuando corresponde. Los 187 efectos están agrupados en 16 familias; Biblioteca abre las categorías antes de mostrar archivos. No contiene rutas personales ni credenciales. Los stems vacíos no forman parte del catálogo. Las carpetas privadas conectadas no se distribuyen.

Fuentes: https://kenney.nl/assets/interface-sounds y https://kenney.nl/assets/ui-audio. Archivo ZIP fijado y verificado por pack en `scripts/prepare-audio-catalog.mjs`; su extracción se prepara localmente antes de ejecutar el script. Se copia audio original y sólo se inspecciona con FFprobe; no se ejecuta código del archivo descargado.

Reproducción de catálogo: `node scripts/prepare-audio-catalog.mjs --source-dir <packs-locales> --ffprobe <binario>`. Es una operación de desarrollo; usar la biblioteca incluida no necesita FFprobe, Python, cuenta ni conexión. `audio-studio.mjs` sólo necesita el runtime Node para producir nuevas variaciones.

Licencias: `LICENSE-KENNEY-INTERFACE.txt`, `LICENSE-KENNEY-UI.txt`, `LICENSE-SYKA.txt`. No se copian las librerías privadas de HyperFrames, catálogos comerciales o sonidos con prohibición de redistribución standalone.
