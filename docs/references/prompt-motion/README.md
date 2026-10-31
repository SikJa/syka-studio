# Referencias de motion integradas en Syka

Snapshot: 6 de octubre de 2026. Biblioteca local de estudio y recuperación;
sin publicación, entrenamiento de pesos ni instalación de skills externas.

## Qué cambia en el uso del agente

Cuando se pide una nueva pieza de varios beats, una demo de interfaz, motion
tipográfico o un lanzamiento SaaS, las instrucciones compartidas del host remiten
a **syka-motion-references**. La skill usa el índice offline para elegir pocos
ejemplos pertinentes, lee análisis y prompts permitidos y convierte decisiones
observadas en `design.md`, `frame.md` y la receta del proyecto. Después construye
y revisa componentes de fuente editable en Diffusion.

La conexión es aditiva en
[`editorial-instructions.ts`](../../../packages/agent-chat/src/host/editorial-instructions.ts);
conserva las instrucciones existentes. La skill está en
[`docs/skills/syka-motion-references`](../../skills/syka-motion-references/SKILL.md).
No agrega otro motor ni reemplaza el editor por un dashboard de referencias.

## Cobertura medida

| Material | Resultado |
| --- | --- |
| Prompt Motion | 230 entradas listadas; 230 detalles inventariados, todos HTTP 200 |
| Texto visible en la galería | 227 bloques leídos completos tal como se exponen; 3 sin prompt |
| Repo completo | 475 entradas y 479 archivos de fuente conservados en la copia local |
| Estado declarado del repo | 279 prompts completos, 5 parciales, 191 textos de post sin prompt completo |
| Unión por publicación original | 528 publicaciones; 177 presentes en ambas fuentes |
| Diferencias y duplicados | 33 publicaciones con variantes de texto; 421 textos distintos del repo y 11 grupos de prompts idénticos |
| Revisión visual | 8 videos; 96 frames regulares y 12 adicionales alrededor de cuatro transiciones |
| Textos exclusivos de la web retenidos enteros | 0; se conservan metadatos, enlaces, hashes y análisis propios |

El inventario de todas las entradas fue automático. Los ocho videos fueron
inspeccionados por muestreo visual; no se certifica el resto de las películas,
las curvas exactas, el historial de iteraciones ni la calidad sonora. Las
declaraciones Opus 5.5 / one shot pertenecen a las fuentes; no son validación de
nuestros proveedores. Los tags técnicos del repo corresponden a los remakes
de Skillry según su README, no necesariamente al original.

Los contadores reproducibles están en [coverage.json](inventory/coverage.json).
Las variantes no se sobrescriben: [text-variants.json](inventory/text-variants.json).

## Referencias visuales seleccionadas

| Referencia | Qué se observó y se adapta | Análisis propio |
| --- | --- | --- |
| Spotify, @brainextends | Player persistente, cambios de escala y convergencia de colección | [spotify](../../skills/syka-motion-references/references/analyses/spotify.md) |
| Shape morph, @twoclipping | Una forma enlaza varios estados de UI; salida/entrada de contenidos | [shape-morph](../../skills/syka-motion-references/references/analyses/shape-morph.md) |
| Hooklab, @twoclipping | Hook → interacción → selección → resultado → cierre | [hooklab](../../skills/syka-motion-references/references/analyses/hooklab.md) |
| Develop, @twoclipping | Una imagen conserva identidad entre foto, teléfono, web y print | [develop](../../skills/syka-motion-references/references/analyses/develop.md) |
| Build the Floor, @Gdgtify | Palabras convertidas en estructura espacial del discurso | [build-the-floor](../../skills/syka-motion-references/references/analyses/build-the-floor.md) |
| Taxtello, @daniel_haida | Relación entre recibo, fila y confirmación | [taxtello](../../skills/syka-motion-references/references/analyses/taxtello.md) |
| Comparación, @notdwd | Correspondencia temporal de dos versiones publicadas | [frame-by-frame](../../skills/syka-motion-references/references/analyses/frame-by-frame.md) |
| Showreel, @himanshutwtxs | Movimiento que demuestra el significado de una palabra | [motion-principles](../../skills/syka-motion-references/references/analyses/motion-principles.md) |

Cada análisis liga timestamps, prompt disponible, procedencia, decisiones
transferibles y límites de adaptación. El muestreo y los archivos locales están
registrados en [video-sample.json](evidence/video-sample.json). Los MP4 originales
y sus frames son evidencia privada excluida de Git, no assets de producción.

## Recuperación acotada

Desde la raíz del repo, sin red ni dependencias nuevas:

```powershell
node docs/skills/syka-motion-references/scripts/retrieve.mjs --query "interfaz continuidad shape morph" --visual-only --limit 3
node docs/skills/syka-motion-references/scripts/retrieve.mjs --id post-2103273003555402193 --include-prompt --max-chars 24000
```

Los resultados incluyen razones, fuentes, estado del prompt y análisis. Se
diversifican textos idénticos y se filtra por capacidad (`native2d`, `html`,
`surface3d`, `any`). Estas etiquetas orientan la selección; no prueban soporte
de cada efecto. Por defecto no se devuelven cuerpos de prompts. La salida JSON
respeta su presupuesto de caracteres y marca cualquier truncamiento.

La copia local MIT está en `upstream/awesome-opus5-5-videos/`, excluida de Git
para conservar el repositorio original sin crear un gitlink. Su LICENSE y README
permanecen intactos. El [manifiesto](provenance/upstream-snapshot.json) registra
commit y SHA-256 de los 479 archivos. Una app empaquetada contiene el índice y
los análisis propios; si falta la biblioteca de estudio, informa
`localPromptAvailable: false`. `--library <carpeta prompt-motion>` conecta una
copia local; no descarga archivos automáticamente.

## Procedencia y derechos

Fuentes: [Prompt Motion](https://prompt-motion.com/) y
[awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos),
commit `3d54892e2ae5b0e8d337171e6508bba4cec01ab8`,
[licencia MIT](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/3d54892e2ae5b0e8d337171e6508bba4cec01ab8/LICENSE).
Se mantiene atribución a cada creador. La licencia del repo no se presenta como
un permiso sobre marcas, fotos, videos o música enlazados.

No se verificó una licencia general de redistribución de los prompts exclusivos
de la galería. Su [robots](provenance/prompt-motion-robots.txt) declara
`search=yes, ai-train=no, use=reference`. Por eso el corpus durable no copia sus
bloques exclusivos. La caché HTML transitoria queda fuera de los artefactos.
La investigación no usó cookies, logins nuevos ni scripts del upstream.

Se intentó acceder a ocho publicaciones X originales. HTTP 200 no estableció
lectura fiable de sus posts dinámicos; el lector web devolvió 403 al volver a
probar Spotify y Shape. No se afirman verificados esos originales. Registros:
[original-post-access.json](evidence/original-post-access.json) y
[source-access.json](provenance/source-access.json).

## Validación e integración real

El recuperador pasó 9 tests sobre el corpus real: pertinencia en español,
UI/SaaS, portal, diversidad, presupuesto de JSON, copia local ausente,
proveniencia, escape de rutas y cobertura. El host pasó 3 tests en dos archivos:
descubrimiento/lectura reales de skill y análisis, conexión a instrucciones
compartidas y enrutamiento editorial existente. El validador de skills pasó.
Los tres bundles de QA se compilaron sin escribir los builds compartidos.

La prueba nativa aislada está en
`F:/Coding Proyects/Syka Clips/Pruebas Syka/QA-prompt-motion-2026-10-06`.
Usa perfil y puertos propios 5317 / 3317 / 9417; evita el editor principal
5188 / 9346 y los proyectos 12–15. Su arnés conecta el host real de chat, el
proveedor Codex y el MCP de su propia instancia Electron, sin mocks de edición.

Se verificó GPT-6.1 Sol en la lista real de modelos. La primera parte corrió
en Max; Sikora pidió cambiar a **Alto**, se interrumpió sólo ese turno y se
retomó el mismo chat y proyecto con `effort: high`, conservando los documentos
y el prototipo. El agente eligió Shape morph y Build the Floor, leyó análisis,
prompts locales y contact sheets, y escribió design.md/frame.md con decisiones
ligadas a timestamps.

**Recorrido completado y revisado:** el agente creó seis textos, 30 formas,
siete grupos y 58 keyframes de fuente editable, sin HTML ni videos importados.
`check` informó 44 nodos, 8 segundos y cero incidencias. El MP4 nativo tiene
1920×1080, 60 fps, 480 frames y ninguna pista de audio. Se inspeccionaron estados,
transiciones y el último cuadro codificado.

La revisión independiente reabrió el proyecto y operó la interfaz real:
3.6 → 1.2 → 5.6667 → 2.5667 → 3.6 s. El lienzo al volver a 3.6 s fue idéntico
píxel por píxel; es un seek hacia atrás real, distinto del muestreo de `capture`.
Un muestreo de la expansión del export confirmó cambios de geometría entre
pares de frames adyacentes a 60 fps. No se afirma revisión manual de todos los
480 frames ni aprobación artística.

Resultados: [validation.json](evidence/validation.json),
[native-integration.json](evidence/native-integration.json),
[independent-review.json](evidence/independent-review.json). La fuente,
`design.md`, `frame.md`, capturas y revisión están en el proyecto de QA.
El MP4 está en `02 Finales/qa_motion.mp4`, reabrible junto con sus nodos nativos.

Se observó una limitación: `capture` cuantiza al reloj interno de 30 unidades/s.
Para el último frame a 60 fps se verificó el archivo codificado con FFmpeg,
evitando pedir 479/60 s al capturador y caer por redondeo fuera de la ventana.
La prueba de teclado necesitó una ventana visible, porque la instancia oculta
no procesaba esos saltos a través de su loop de render. La revisión final se
hizo en una ventana privada visible y se cerró al terminar.

La integración está en el código y fue cargada en el host de QA recién
compilado. Al cerrar se verificó en lectura que el bundle compartido principal
también contiene la nueva instrucción: fue reconstruido a las 21:24:30 y la
app principal se inició a las 21:24:41, hora argentina. Ese reinicio ocurrió
fuera de este arnés; este encargo no escribió el build compartido ni controló
la sesión principal. La validación completa registrada sigue siendo la de QA.
La skill queda disponible en el árbol de desarrollo; un release empaqueta el
índice y análisis, con la copia completa conectada como biblioteca local.

## Qué falta evaluar

- No se evaluó Opus 5.5 por Antigravity; requiere identidad/capacidad y un turno
  real independientes. La conexión compartida no garantiza equivalencia entre modelos.
- No se produjo el lanzamiento de Syka ni se aprobó su guion. La preparación
  está en [brief-and-review.md](../../skills/syka-motion-references/references/brief-and-review.md):
  estudiar producto, evidenciar funcionalidades y usar medios propios antes de escribir copy.
- No se validaron como nativos efectos de vidrio/displacement, deformación de
  glifos, subframes, sincronización musical ni cada técnica de los originales.
- Mejorar la calidad artística exige revisar cada nueva pieza con contenido
  real; la biblioteca reduce improvisación, no garantiza calidad ni aprobación.

## Scripts propios

- `scripts/collect.py`: inventario de Next/HTML público, caché temporal y hashes;
  no conserva cuerpos exclusivos de la web en el índice.
- `scripts/build_catalog.py`: unión por post original, variantes, duplicados,
  catálogo completo y catálogo compacto para la skill.
- `scripts/sample_videos.py`: descarga local acotada de ocho URLs públicas,
  ffprobe y contacto de 12 frames por video; no ejecuta contenido ajeno.
- `scripts/preserve_snapshot.py`: registra hashes de todos los archivos
  rastreados de la copia Git en el commit fijado.
- `scripts/qa-native.mjs`: compila y arranca sólo una instancia privada,
  comprueba modelo/esfuerzo y ejecuta el recorrido agente → MCP → motor.
- `scripts/qa-set-effort.mjs`: interrumpe únicamente el chat QA registrado;
  no cambia otros agentes ni la sesión principal.
- `scripts/qa-live-window.mjs`: reabre la misma composición en una ventana
  privada visible, sin repetir el turno del modelo.
- `scripts/qa-review.mjs`: comprueba saltos de teclado hacia atrás, igualdad de
  píxeles, reapertura, nodos editables y último frame del archivo exportado.

Los scripts de colección requieren las mismas condiciones públicas y no son
una autorización para saltar 403/429, logins o derechos. El recuperador de uso
diario es offline y no ejecuta instrucciones embebidas en los prompts.
