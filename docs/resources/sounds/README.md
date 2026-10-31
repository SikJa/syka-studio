# Sonidos incluidos en Syka Studio

El [catálogo](catalog.json) contiene 710 recursos: 691 SFX, ocho bases musicales y
11 stems. Los archivos son públicos/licenciados y vienen con la aplicación; no
dependen de la biblioteca personal del desarrollador ni se descargan al empezar
una animación. Importarlos al proyecto con `assets copy:true` conserva portabilidad.

| Colección | Archivos | Licencia |
|---|---:|---|
| Kenney Interface / UI | 151 | CC0 |
| Kenney Impact | 105 | CC0 |
| Kenney Sci-fi | 42 | CC0 |
| Kenney Casino | 54 | CC0 |
| Kenney RPG | 32 | CC0 |
| Syka: efectos, bases y stems | 50 | MIT |
| Cuelume: variantes de interfaz renderizadas offline | 168 | MIT |
| OpenDesign: partituras procedurales de cinco plantillas | 5 | Apache-2.0 |
| Earshot: efectos seleccionados y resíntesis, incluidas 26 novedades de 0.4 | 79 | MIT; fuentes fitted CC0 |
| Bencho: los 24 sonidos del repositorio público | 24 | MIT; dos adaptaciones Cuelume MIT |

Cada pack Kenney conserva su aviso
`LICENSE-KENNEY-*.txt`; los originales Syka usan `LICENSE-SYKA.txt`. Los nombres
de packs no garantizan grabación acústica: escoger por el carácter de la muestra,
escuchar y no atribuir a síntesis una procedencia física inventada.

Los 691 SFX tienen perfil a 48 kHz estéreo: cue de energía, ataque, brillo, bandas,
cola y correlación estéreo. `syka_resources` permite buscar material/acción, familia,
`brightness` y `attack`; perfiles de señal no son evaluación musical ni semántica.
El catálogo registra duración, formato y SHA256; los cue points curados existentes
se conservan. No aplicar normalización o recortes indiscriminados a los originales.

La selección de cuatro packs se inspiró en
[opus-sound-layer](https://github.com/Bodila51/opus-sound-layer), snapshot
`52ac266a24b7dfd3cd06a28c34d5af360a8d7586`; ver
[procedencia](sources/kenney-motion-packs.json) y el aviso MIT en
[LICENSE.opus-sound-layer.txt](../../licenses/LICENSE.opus-sound-layer.txt).
No se descargó el catálogo upstream entero, ni se incluye su renderer Python.

Las cinco músicas de OpenDesign (`open-design-v0.25.0`) pertenecen a sus plantillas
product-promo, showreel, ui-morph, visual-lesson y future. Se conservan los MP3
originales (1.072.390 bytes), duración medida, licencia declarada por cada paquete,
SHA-256 y Git blob en [procedencia](sources/opendesign.json). El texto Apache-2.0
está en [LICENSE-OPENDESIGN.txt](LICENSE-OPENDESIGN.txt). No se extrajo música de
videos de referencia ni se encontró un banco independiente de SFX en esos paquetes.

El agente devuelve hasta seis candidatos compactos (6.000 caracteres por defecto),
puede paginar/excluir IDs y conserva elecciones locales verificables. Para una
pieza nueva usa `newPiece:true`: penaliza pistas/familias recientes. En una revisión
mantiene la elección del proyecto. Las tres bases originales de Syka pertenecen
a una misma familia armónica: variar semilla o BPM no cuenta como composición nueva.
No se añade entrenamiento, embeddings ni una llamada extra a otro modelo.

La biblioteca personal puede clasificarse por archivo o carpeta desde la UI o
`syka_resources action:classify`. Los nombres aportan sugerencias, no análisis
semántico; lo desconocido sigue visible en **Sin clasificar**. Las clasificaciones
por archivo caducan si cambia el archivo. Los hashes de audio sin cambios se
reutilizan en memoria para evitar releerlo en cada consulta.

Si no hay una pista nueva adecuada, `syka_music_create` genera una composición
sintética de 4–60 segundos y stems dentro del proyecto. Hay seis direcciones,
doce familias armónicas y variación de motivo/arreglo, con exclusión de familias
recientes. Si no alcanza para el estilo pedido o se agotan las familias, el agente
debe pedir una fuente/proveedor o una decisión del usuario. No equivale a un modelo
de música por texto ni a interpretaciones acústicas realistas. La herramienta no
inserta en la timeline y sus métricas no reemplazan audición.

Earshot aporta quince recetas ajustadas a fuentes CC0 y 64 efectos diseñados,
renderizados a 48 kHz/24 bits. Conserva los 53 WAV anteriores y suma 26 sonidos
de 0.4. Conserva
[MIT](LICENSE-EARSHOT.txt), [créditos CC0](CREDITS-EARSHOT-FIT.md) y
[procedencia](sources/earshot.json), con commit, hashes, receta y mediciones.
Son recetas de síntesis/resíntesis, no los samples originales. El kit `launch`
se guarda aparte con 72 tomas en 20 roles para no llenar la grilla de variantes.
`syka_launch_audio` lo adapta a clips y keyframes nativos, sin Python ni modelos:
[integración y análisis opcional](../../skills/syka-local-audio/references/earshot-launch.md).
La app no incluye Torch ni modelos y no los descarga al iniciar o buscar sonidos.
Los scripts `prepare-earshot04.py` / `import-earshot04.mjs` son herramientas de
construcción aisladas, con fuente fijada y controles de hashes/licencias.

Para el agente, leer `syka-local-audio/references/sound-layer.md`. Medición y QA
usan el FFmpeg/FFprobe local configurado por la app.

Bencho incluye los 24 sonidos públicos aprobados, fijados al commit
`30ab35a575eb83eed8f086a6893d4d6426f4fa91`. Son WAV estéreo de 48 kHz/24 bits,
con el mismo gain de la preview aprobada y ruido fijado para reproducibilidad.
Sus recetas, [licencia MIT](LICENSE-BENCHO.txt), [avisos de terceros](CREDITS-BENCHO.md)
y [hashes/procedencia](sources/bencho.json) se conservan. Beacon y Plop derivan de
Cuelume; no se atribuyen a grabaciones ni se cuentan como recetas de origen nuevo.
No incluye sonidos Pro, fotos, marca ni mascota de Bencho. No necesita navegador,
red, modelos o paquetes extra para usar los WAV instalados. Consultar también
`syka-local-audio/references/bencho.md`.

Para mantener esta colección:

```powershell
node scripts/extend-sound-catalog.mjs --source-dir <packs-oficiales-verificados>
node scripts/check-sound-catalog.mjs
npm --prefix apps/desktop run stage:docs
```

El importador necesita Node >=22.6 en la máquina de desarrollo y los ZIP oficiales
con `packs.json`/licencias/hash; consumir los archivos instalados no requiere ese
importador. El staging valida rutas, contenido y avisos del bundle y falla si falta
un archivo o no coincide su hash. La reconstrucción del catálogo base conserva los
packs adicionales y sus perfiles cuando no cambia el contenido original.
