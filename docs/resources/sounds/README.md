# Sonidos incluidos en Syka Studio

El [catálogo](catalog.json) contiene 434 recursos: 420 SFX, tres bases musicales y
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

Se incorporaron 233 muestras en esta ampliación. Cada pack conserva su aviso
`LICENSE-KENNEY-*.txt`; los originales Syka usan `LICENSE-SYKA.txt`. Los nombres
de packs no garantizan grabación acústica: escoger por el carácter de la muestra,
escuchar y no atribuir a síntesis una procedencia física inventada.

Los 420 SFX tienen perfil a 48 kHz estéreo: cue de energía, ataque, brillo, bandas,
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

Para el agente, leer `syka-local-audio/references/sound-layer.md`. Medición y QA
usan el FFmpeg/FFprobe local configurado por la app. Para mantener esta colección:

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
