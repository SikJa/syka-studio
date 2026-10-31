# Investigación y conocimiento incluido en Syka

## Lo que reciben las personas

`docs/skills/syka-motion-references` se incluye en los recursos del instalador
mediante `apps/desktop/scripts/stage-docs.mjs`. Son aproximadamente 3.4 MB de
texto: reglas propias de composición, tipografía, tarjetas y continuidad,
estudios escritos, un índice de 645 publicaciones y 387 fichas de skills,
y 475 textos atribuidos del snapshot MIT del repositorio. No contiene videos,
imágenes, downloader, caché de referencias ni rutas a una carpeta personal.

El agente tiene la ruta a esta skill en sus instrucciones. Lee `design-rules.md`,
recupera unos pocos estudios con la herramienta nativa `syka_motion_knowledge`
y aplica decisiones a un brief y a una pieza editable en Diffusion. Esa búsqueda
y los textos incluidos funcionan
sin red. `libraryAvailable: false` indica que no se abrió el archivo de
investigación; `knowledgeAvailable: true` identifica el conocimiento instalado.
La herramienta corre en el host de la app, sin un Node CLI adicional.

Los videos sirvieron para la investigación. El uso habitual de Syka no descarga
referencias y no requiere que una persona conecte la colección o abra su visor.
La nueva pieza se comprueba con sus propios frames, reproducción y export.

## Cobertura de la investigación, separada del instalador

Snapshot 2026-10-07, cierre de la comprobación 2026-10-08:

| Material | Cobertura comprobada |
|---|---:|
| Publicaciones únicas | 645 |
| Opus en Skillry | 513 |
| Fable en Skillry | 80 |
| Exclusivas de la galería anterior agregadas | 52 |
| Fichas de skills | 387 |
| Documentos públicos reales recuperados | 42 |
| Descripciones premium sin workflow obtenido | 345 |
| URLs de medios inventariadas y adquiridas | 4680 / 4680 |
| URLs de video con ffprobe y muestras automáticas | 2064 / 2064 |
| Archivos de video con SHA-256 distinto | 2060 |
| Publicaciones estudiadas visualmente por muestras | 14 |

Los archivos incluyen originales, remakes y previews; no equivalen a 2060
animaciones distintas. Todas las publicaciones tienen medios en el archivo de
investigación y las 513 de Opus tienen original y remake. El análisis automático
de todas las URLs no equivale a una revisión visual, de fluidez o de audio.

Hay 593 bloques de texto recuperados: 279 completos declarados, 5 parciales
declarados, 38 fragmentos nuevos, 263 textos de posts y 8 prompts mostrados sin
autenticación de su conversación original. Las 52 publicaciones exclusivas
anteriores conservan metadatos y enlaces, sin copiar sus prompts web exclusivos.
Los 475 textos que se distribuyen proceden sólo del snapshot MIT y conservan
el estado de evidencia y su atribución. Los documentos premium no se obtuvieron
ni se trataron como workflows completos.

Antes de esta ampliación se habían inventariado 528 publicaciones, pero sólo
8 videos se habían descargado y estudiado. No se habían descargado todos.
Ahora la cobertura del archivo anterior también quedó reconciliada.

El archivo pesado se conserva fuera del producto, exclusivamente para
investigación. La distribución no necesita conocer su ubicación. Para una
investigación explícita, `library.mjs --library <carpeta>` puede consultarlo;
el comando tampoco hace descargas. `coverage.json` y `acquisition-audit.json`
documentan la cobertura y las comprobaciones de identidad/rutas.

## Validación de distribución

- El test `portable.test.mjs` copia la skill a una instalación temporal, bloquea
  la red y comprueba recuperación de estudios y textos, ausencia de archivos de
  medios y presencia de los 475 textos y la licencia. No consulta el archivo
  personal de investigación.
- Los 17 tests de los recuperadores y portabilidad pasaron; también 20 tests del
  host/routing/herramientas, el chequeo TypeScript y la compilación del host.
- `qa-native-knowledge.mjs` comprueba un turno real de Syka contra los recursos
  públicos preparados para el empaquetado, sin conectar la investigación. Su
  resultado de la recuperación por herramienta nativa queda en
  `evidence/native-knowledge-tool-integration.json`; la prueba anterior por
  recuperador directo está en `evidence/native-knowledge-integration.json`.

Esta es una mejora local de instrucciones y conocimiento recuperable; no es
entrenamiento de pesos, una mejora estética demostrada de todas las piezas ni
una publicación de un instalador nuevo. No se reinició la app compartida.

Fuentes: [Skillry Opus](https://skillry.dev/ai-videos/opus-5-5),
[Skillry product launch](https://skillry.dev/skills/use-case/product-launch),
[awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)
(commit `3d54892e2ae5b0e8d337171e6508bba4cec01ab8`) y
[Prompt Motion](https://prompt-motion.com/).
