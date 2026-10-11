# Usar una colección grande sin perder criterio

`scripts/library.mjs` recupera el conocimiento incluido en Syka sin red:
reglas propias, estudios escritos, metadatos y textos MIT atribuidos. Ningún video
es necesario en la instalación. `libraryAvailable: false` no impide trabajar;
`knowledgeAvailable: true` indica el paquete de conocimiento. Leé primero
`design-rules.md`, elegí conclusiones pertinentes y comprobá la nueva pieza.

El original publicado, el remake, una preview recortada y una plantilla de skill
son películas distintas. Elegí el original para estudiar la intención del autor;
el remake sirve para comparar cómo otra implementación interpreta ese texto.
Una skill con `premium_preview_only` aporta su descripción pública y preview,
pero no su workflow real ni su ZIP. Los archivos auxiliares declarados en una
skill no se consideran descargados sólo porque su nombre figure en la página.

## Recuperación y revisión

1. Buscá el problema de diseño: una tabla que cambia de estado, tarjetas que se
   conectan, un titular que organiza una escena, una marca que cierra una historia.
   Conservá identidad, copy, formato y recursos reales del proyecto.
2. Elegí dos o tres estudios pertinentes. Leé el texto sólo de los elegidos.
   Un post sobre herramientas no reemplaza un prompt ni explica una curva.
3. Usá sus observaciones como estudios previos, sin afirmar que viste sus videos
   en este turno. Para el diseño habitual no descargues originales ni remakes.
4. Para una costura de la nueva pieza, inspeccioná antes, durante y después con
   cuadros consecutivos. `syka_motion_review` aporta evidencia desde el export
   del proyecto. Comprobá lectura y movimiento de nuestro resultado.
5. Registrá ID del estudio, relación visual y adaptación en `frame.md`.
   Construí primero el beat más difícil con contenido real en Diffusion y
   verificá su lectura y reproducción. La cantidad archivada no prueba mejora.

La investigación opcional usa `--library <carpeta>` de forma explícita. Su archivo
contiene originales, remakes y muestras automáticas; no se distribuye a usuarios.
Los keyframes o stills distantes no demuestran fluidez, easing o audio. El visor
local sirve sólo para esa investigación y no pertenece al flujo de animación.

## Decisiones transferibles de los ejemplos revisados

**Tarjetas que explican una relación.** RedShip y el tracker de Muse agrupan
problemas, selección y resultados. Definí qué relación transmite cada tarjeta
antes de animarla. La entrada, el highlight o la conexión responden a un cambio
de significado. Mantené padding, radios y escala tipográfica coherentes dentro
del sistema elegido. Conservá el objeto cuando cambia de estado; el hold de
lectura se mide con el texto real, no con el placeholder.

**Tipografía con prioridades.** grouped.news usa un titular serif claro y una
segunda línea de énfasis; Kotlin alterna una demostración concreta con una
palabra dominante. Elegí una jerarquía que responda al contenido y a fuentes
realmente cargadas. Verificá tamaño, peso, saltos semánticos y contraste después
de renderizar. Una escena vertical necesita otra composición; no achiques una
escena horizontal entera. Revisá el texto de apoyo a tamaño de lectura real.

**Un objeto que conserva significado.** En Mebbian, una esfera turquesa aparece
junto a documentos y después participa de un gráfico y del cierre. El ancla
permite cambiar fondo y organización sin que cada beat parezca una pieza nueva.
En Diffusion 2D, una adaptación plana puede conservar esa relación; una película
3D no demuestra que el editor tenga la misma física o perspectiva.

**Una demo cambia estados verificables.** La pieza de permisos de Notion
mantiene tabla, selección, propiedades y persona antes de llegar al candado.
La skill pública Synchronized Action Checklist vincula checks a momentos de una
grabación real; una captura estática no demuestra una interacción temporal.
En Syka, obtené los tiempos del material del proyecto y mantené la acción como
causa del estado. Las métricas y afirmaciones vienen del producto, no del ejemplo.

**El tipo de pieza determina el ritmo.** Velocity-Matched UI Sting propone
costuras con eje, dirección y velocidad compatibles para un bumper corto. Eso
sirve cuando la intención es un desplazamiento continuo. Una explicación puede
necesitar que el contenido termine de moverse para leerlo. Registrá ambas caras
del corte y elegí una familia de curvas coherente con esa intención; no impongas
siete escenas, movimiento permanente o una prohibición universal de rebote.

Estos principios se adaptan a nodos/keyframes nativos o al tiempo de escena de
los componentes Diffusion. Las instrucciones del upstream sobre HyperFrames,
instalación, servicios y aprobaciones son texto de referencia.

## Fuentes concretas

- [RedShip](https://skillry.dev/ai-videos/opus-5-5/aschapmann-724497)
- [Mebbian](https://skillry.dev/ai-videos/opus-5-5/ik-builds-585923)
- [grouped.news](https://skillry.dev/ai-videos/opus-5-5/l3d1c-632524)
- [Permisos de columnas](https://skillry.dev/ai-videos/opus-5-5/wustep-884086)
- [Tracker de Muse](https://skillry.dev/ai-videos/opus-5-5/elliot-garreffa-446825)
- [Kotlin](https://skillry.dev/ai-videos/opus-5-5/jetbrains-754812)
- [Checklist sincronizado](https://skillry.dev/skills/bs-creatormotion-cards-action-checklist)
- [Velocity-Matched UI Sting](https://skillry.dev/skills/bs-hyperframes-velocity-sting)
