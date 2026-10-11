# Contrato de la biblioteca

El snapshot original de esta página conserva sus cifras del 2026-10-06. La
ampliación Skillry/medios se describe en
[collection-workflow.md](collection-workflow.md), y su cobertura medida está en
`collection-index.json`. Los dos recuperadores conservan contratos distintos:
`retrieve.mjs` para la selección curada original; `library.mjs` para explorar el
archivo ampliado, con metadatos, medios y documentos públicos disponibles.

Snapshot consultado el 2026-10-06: Prompt Motion y el repo
`yihui-dev/awesome-opus5-5-videos`, commit
`3d54892e2ae5b0e8d337171e6508bba4cec01ab8`. El catálogo no se refresca solo.

| Estado | Significado | Uso |
| --- | --- | --- |
| `declared_complete` | El repo no marca el texto como parcial | Ejemplo de instrucciones; no autenticación del historial original |
| `declared_partial` | El repo dice que se compartió sólo una parte | No rellenar instrucciones faltantes como si fueran originales |
| `post_text_only` | El repo incluye el texto del post porque no publicó el prompt completo | Contexto, no brief completo; hay casos contradictorios como Taxtello |
| `complete_as_displayed` | Se leyó todo el bloque expuesto por la web | Describe el bloque de la galería, no garantiza que sea todo el prompt original |
| `absent` | No había bloque de prompt en la página | Conservar publicación y resultado; no inventar prompt |
| `sampled_frames_reviewed` | Se inspeccionaron frames locales con tiempos registrados | Evidencia visual parcial; curvas exactas y calidad sonora pueden seguir desconocidas |

Se fusiona por ID de publicación X, preservando las dos fuentes. 33 publicaciones
compartidas tienen texto distinto: no se sustituye silenciosamente una versión.
Cada publicación conserva su resultado aunque comparta el prompt con otra.
El recuperador diversifica grupos de texto idéntico para no devolver tres copias
del mismo “showreel”, y prioriza evidencia observada cuando hay relevancia.

`remakeTechTags` identifica la implementación de los remakes de Skillry, según
el README del repo; no demuestra el stack original. Opus 5.5, “one shot” e
iteraciones son declaraciones del autor/curador, no identidad o capacidades
verificadas de nuestros proveedores. Antigravity requiere su propia evaluación.

## Ubicaciones y retención

En desarrollo, los archivos originales están en
`docs/references/prompt-motion/upstream/awesome-opus5-5-videos/`, con LICENSE y
README intactos. Esta copia local está excluida de Git para no convertir el
repositorio anidado en un gitlink; el manifiesto de los 479 archivos y sus hashes
queda en `provenance/upstream-snapshot.json`. La licencia MIT del repositorio y su invitación a usar prompts
permiten conservar esa copia de estudio con atribución. El README conserva los
derechos de cada creador: MIT no concede automáticamente derechos sobre videos,
marcas, fotografías o música enlazados.

La web no expone una licencia general verificada para copiar toda su colección.
Sus textos exclusivos se leen para clasificar, pero el corpus durable guarda
enlaces, autores, fechas, hashes y análisis propios. No se descargan skills de
los posts. Su robots declara `search=yes, ai-train=no, use=reference`; esta
biblioteca es referencia local, no fine-tuning.

Los ocho MP4 y sus frames viven en `docs/references/prompt-motion/media/` y
`evidence/source-frames/`: evidencia privada para análisis, excluida de Git.
No se incorporan a una entrega ni se publican como assets licenciados. No se
usaron cookies, cuentas nuevas ni el backend autenticado de X. HTTP 200 de la
publicación no basta para verificar su contenido dinámico; consultar el registro
`evidence/original-post-access.json`.

El catálogo compacto y los análisis propios están dentro de esta skill. La
copia de estudio, los MP4 y el corpus completo están fuera de los árboles que
`stage-docs.mjs` empaqueta. Si se usa una app instalada sin esa copia, el
recuperador informa `localPromptAvailable: false` y conserva los enlaces. Podés
usar `--library <carpeta prompt-motion>` para una biblioteca local conectada;
no baja materiales ni contacta servicios en tiempo de ejecución.

Fuentes: [galería](https://prompt-motion.com/),
[repo y créditos](https://github.com/yihui-dev/awesome-opus5-5-videos),
[licencia](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/3d54892e2ae5b0e8d337171e6508bba4cec01ab8/LICENSE).
