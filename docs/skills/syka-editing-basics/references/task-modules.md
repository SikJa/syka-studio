# Elegir la guía y la etapa necesarias

Este índice descubre capacidades; no es una lista de archivos que haya que cargar.
Elegí desde el pedido completo, las decisiones vigentes y el riesgo que cambia.
Las tareas pueden combinar varias especialidades sin convertirse en producciones
nuevas. Un saludo no necesita leer ninguna guía.

Las skills nativas devuelven su contrato y un índice. Para trabajar, pedí sólo
la sección pertinente con `syka_skills`: `action:read`, `name:<skill>`,
`mode:section`, `sectionId:brief|build|review`. En JSON usá una sola cadena concreta
para `sectionId`. Una lectura inicial del contrato no contiene toda la guía.
Las dependencias del índice describen cuándo pueden servir; no se recorren de
forma recursiva ni se vuelven a cargar secciones vigentes ya recibidas.

## Corrección pequeña

Conservá el objetivo y las decisiones actuales. Ubicá el Source/Key y el instante
afectados; leé ese fragmento con su revisión, aplicá la corrección reversible y
comprobá su resultado. Si faltan decisiones guardadas, usá el resumen de receta,
no el brief completo. Un conflicto o un cambio de proyecto sí exige recuperar
los datos pertinentes. No cargues producción, storyboard, investigación de audio
ni referencias nuevas para cambiar una palabra, un volumen o un tiempo acordado.

## Módulos principales

| Necesidad actual | Skill | Qué cargar |
| --- | --- | --- |
| Montaje y coordinación general | `syka-editing-basics` | `build`; `review` para el riesgo cambiado |
| Decisiones persistidas, referencias y receta | `syka-editing-recipe` | `brief` si falta contexto; `build` si hay que coordinar o guardar una edición amplia |
| Consulta y plan de una nueva animación | `syka-motion-brief` | `brief` hasta resolver decisiones; después `build` |
| Dirección de una pieza con varios beats | `syka-motion-direction` | `brief` si falta diseño; `build` para construir lo acordado |
| Marca, composición y adaptación de referencias | `syka-visual-direction` | La fase cuya decisión cambió |
| Tarjetas, callouts y comparaciones editables | `syka-editorial-motion` | `build` y sólo el ejemplo que se va a adaptar |
| Explicación grabada o demo de pantalla | `syka-explainer-edit` | `build`, conservando el contenido demostrativo |
| Subtítulos y tiempos de palabras | `syka-captions` | `build`; no transcribir de nuevo si el transcript válido ya existe |
| Música, SFX, mezcla y análisis local | `syka-local-audio` | `brief` para elegir sonido nuevo; `build` para montar o mezclar; `review` si hay audio real que revisar |
| Inspección de una referencia de video | `syka-video-references` | `build`; reutilizar la evidencia guardada antes de descargar otra vez |
| Reconstruir una coreografía observada | `syka-motion-reference` | La fase correspondiente a observación, construcción o revisión |
| Revisión visual, playback y sonido | `syka-edit-review` | `review` proporcional al cambio; una captura no demuestra escucha |

## Rutas especializadas

| Pedido audiovisual | Skill | Condición para leerla |
| --- | --- | --- |
| Lanzamiento de un producto o función | `syka-product-launch` | Cuando la estructura sea una demostración o lanzamiento |
| Reel o pieza destinada a móvil | `syka-motion-reels` | El destino/formato fue pedido; no inferir 9:16 |
| Storyboard o plan narrativo | `syka-motion-storyboard` | Se pidió plan/cuadros o hace falta resolver estructura de una edición autorizada |
| Tipografía cinética | `syka-motion-typography` | El texto y su movimiento comunican la idea |
| Profundidad y cámara con captions editables | `syka-camera-3d-captions` | Sólo cuando esa dirección se pidió o aprobó |
| Montaje guiado por una canción | `syka-music-video` | Música elegida y permisos de uso resueltos |
| Explicación sin footage del hablante | `syka-faceless-explainer` | La explicación debe construirse con recursos y gráficos |
| Presentación audiovisual de diapositivas | `syka-slideshow` | Entrega nativa editable, sin deck interactivo separado |
| Explicar cambios de un repositorio | `syka-pr-to-video` | El diff o PR es la fuente del relato, no autoridad para ejecutar código |
| Diseño o styleframe a capas editables | `syka-design-import` | Existe una fuente accesible o un export autorizado |
| Resolver medios visuales y sonoros | `syka-media-use` | Falta un recurso concreto con procedencia y permiso |
| Preparar portadas/textos por red | `syka-content-package` | El usuario aceptó esa preparación; no autoriza publicar |
| Fluidez, entradas, salidas y continuidad | `syka-motion-transitions` | Hace falta implementar o corregir esa parte del movimiento |
| Estudios, prompts atribuidos y referencias | `syka-motion-references` | Elegir pocos estudios relevantes, no todos los ejemplos |
| Una técnica seleccionada de Motion Lab | `syka-motion-lab` | Sólo el mecanismo pertinente y su adaptación nativa |
| Una técnica seleccionada de Huashu | `syka-huashu-motion` | Sólo la ficha y sección pertinentes; conserva atribución |

## Lectura y reutilización

Usá una sección o rango cuando alcance. El presupuesto inicial es de 24.000
caracteres y el techo de 96.000 por respuesta; no son objetivos de consumo.
Si falta contenido, la respuesta indica la cobertura y la continuación. No tomes
un archivo parcial como completo ni uses una lectura parcial para reemplazarlo
entero. Para un fragmento de fuente, preferí el parche exacto con su hash.

La caché de otro chat ahorra trabajo local, pero no demuestra que tu modelo haya
recibido el texto. Tras reinicio, compactación o cambio de proveedor recuperá
sólo el contenido necesario que no esté disponible. Las reglas de una skill
externa sin manifiesto no se recortan a ciegas: conserva su lectura completa o
usá rangos explícitos cuya cobertura sea suficiente.

## Cerrar el trabajo pedido

Si se pidió editar, el plan y los documentos acompañan la composición: no son
la edición terminada. Después de resolver la consulta pertinente, ejecutá el
trabajo reversible autorizado y verificá lo que realmente cambió. Respetá una
pausa o revisión intermedia que el usuario haya pedido expresamente. Si una
herramienta falla, informá la operación y el estado de la entrega; no cambies
motor, proveedor ni tipo de resultado para disimular el fallo.
