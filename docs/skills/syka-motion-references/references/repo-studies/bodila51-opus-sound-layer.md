# Bodila51/opus-sound-layer: diseño sonoro y revisión

Estudio original de Syka, 2026-10-10. Snapshot upstream:
`52ac266a24b7dfd3cd06a28c34d5af360a8d7586`.
[Repositorio](https://github.com/Bodila51/opus-sound-layer).

## Qué contiene y qué aporta

El prompt de la captura “Sound design for Opus 5.5: no more cheap beeps” coincide
con la versión del 9 de octubre: 26 muestras CC0. El snapshot posterior anuncia
1.139 entradas de siete packs Kenney y Freesound. Son metadatos y descargas
opcionales, no 1.139 archivos verificados por Syka ni garantía de grabación física.
El repo contiene README, PROMPT, catálogo JSON y tres utilidades Python: selección
de SFX, mezcla y QA. Código MIT; no tiene SKILL.md ni pesos/modelo entrenado.
El artículo completo no se verificó: esta investigación parte del repo y prompt
confirmados, no de texto que no se pudo recuperar.

La selección usa material, duración, ataque, brillo y cola para elegir sonidos
coherentes. Propone familias de vidrio/aire, papel/tela o metal/cuerpo; capas y
variaciones pueden funcionar mejor que repetir un click sintético. No todos los
recursos externos son foley grabado: verificar cada licencia y su origen.

Las acciones son corte, movimiento, asentamiento y revelado. Los cues salen de
la animación y se alinean con el pico de la muestra, no con su primer sample.
Silencio previo, build y acento protagonista se eligen según la historia.

La mezcla estima ganancia del SFX en su banda contra la base y reduce música
bajo voz. Esto no es sidechain espectral dinámico. Sus sugerencias de sala,
pitch y loudness necesitan evaluación por pieza; no trasladar su hero obligatorio,
reverb o target a todas las animaciones.

Fuentes: [PROMPT](https://github.com/Bodila51/opus-sound-layer/blob/52ac266a24b7dfd3cd06a28c34d5af360a8d7586/PROMPT.md),
[selección](https://github.com/Bodila51/opus-sound-layer/blob/52ac266a24b7dfd3cd06a28c34d5af360a8d7586/scripts/sfx.py),
[mezcla](https://github.com/Bodila51/opus-sound-layer/blob/52ac266a24b7dfd3cd06a28c34d5af360a8d7586/scripts/mix.py).

## Revisión: utilidad y defectos observados

La QA upstream mide LUFS/true peak del MP4 y offset del mix codificado respecto
al master. Usa también stems y diferencias visuales globales. La audibilidad y
sincronización por cue se calculan contra stems agregados previos al mastering,
que pueden ocultar que un asset esperado falta.

Lectura completa de los tres scripts y pruebas aisladas de sus funciones, con
NumPy/SciPy y archivos controlados: un clip de un segundo con 100 ms de retraso
no tenía ventana completa de comparación y obtenía pass/0 ms; un SFX ausente
podía aprobarse por otro efecto del stem; un downmix mono perdía energía L/R
opuesta; leer WAV 44,1 kHz sin conservar su rate cambiaba duración a 48 kHz.
No se ejecutó su CLI completa ni se evaluó perceptualmente una pieza upstream.

Fuente: [QA](https://github.com/Bodila51/opus-sound-layer/blob/52ac266a24b7dfd3cd06a28c34d5af360a8d7586/scripts/qa.py).

## Adaptación instalada en Syka

- Diffusion, timeline nativa y recursos editables se conservan. No se agrega el
  renderer Python upstream ni dependencias Python/uv para consumir la biblioteca.
- Se incorporan 233 archivos seleccionados de Kenney Impact, Sci-fi, Casino y
  RPG, CC0, sin previews/footsteps/motores sostenidos ni duplicados por hash.
  Catálogo total: 434 recursos, incluidos 420 SFX. El origen, las licencias y
  SHA256 se distribuyen con los assets. No se descargaron las 1.139 entradas.
- `syka_audio_analyze detail:sfx` mide ataque, brillo, bandas y cola a 48 kHz
  estéreo. La biblioteca permite filtros de brillo/ataque y etiquetas de material.
- `syka_audio_balance` propone volumen editable contra una base aislada real;
  no escribe ni garantiza el pico de la suma. Mantener escucha y ducking nativo.
- El brief acepta familia, intensidad y espacio; cues SFX guardan acción, material
  y peso. Máxima velocidad/contacto requiere derivación o inspección: los límites
  de clip no lo detectan automáticamente.
- `syka_audio_review` mide el export real y busca cada muestra concreta, conserva
  hashes del export y assets, y devuelve matched/inconclusive/not-detected.
  Una coincidencia es candidata; no demuestra audibilidad aislada ni estética.

Reglas operativas: leer `syka-local-audio/references/sound-layer.md`. Las pruebas
incluyen entrada 44,1 kHz, transiente estéreo opuesto, offset conocido y un mix
AAC real. Son evidencia funcional; no sustituyen comparar y escuchar una pieza.
No se implementó reverb de bus ni sidechain/EQ dinámico con este cambio.

Recursos oficiales: [Impact](https://kenney.nl/assets/impact-sounds),
[Sci-fi](https://kenney.nl/assets/sci-fi-sounds),
[Casino](https://kenney.nl/assets/casino-audio),
[RPG](https://kenney.nl/assets/rpg-audio).
