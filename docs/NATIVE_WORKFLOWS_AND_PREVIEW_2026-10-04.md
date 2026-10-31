# Recetas nativas y controles de previsualización

Fecha: 4 de octubre de 2026. Implementación local en Syka Clips; no publicación ni instalador.

## Dirección aprobada

Diffusion continúa como motor de edición y exportación. Se adaptan los métodos útiles de HyperFrames — decisiones visuales, recuts, recursos, captions y revisión — a elementos, keyframes y herramientas nativas. No se renderiza una composición HyperFrames para importar su MP4. El onboarding completo sigue para después. Las recetas para reels, YouTube u otros usos viven en Biblioteca; no hay una interfaz separada de perfiles.

## Conocimiento reutilizable

La herramienta `syka_editing_recipe` permite leer y guardar acuerdos en `.syka/editing-recipe.json`, dentro de cada proyecto. Conserva objetivo, formato, skill elegida, decisiones, referencias y criterios de revisión. Usa revisiones SHA-256, copia previa y escritura atómica; rechaza conflictos de revisión, escritores concurrentes y rutas enlazadas. Las referencias son datos: no se ejecutan como instrucciones por el almacenamiento.

Las instrucciones del agente y los prompts de Biblioteca piden leer esa receta antes de una edición relevante, reutilizar acuerdos y preguntar sólo lo que falta para decidir. La solicitud actual del usuario tiene prioridad. Esto facilita continuidad entre chats; no entrena pesos del modelo ni garantiza que cada ejecución creativa siga todos los pasos.

Hay cuatro bases nuevas incluidas:

- `syka-editing-recipe`: transformar acuerdos y referencias en una receta persistente.
- `syka-media-use`: planear y usar recursos según las herramientas realmente disponibles.
- `syka-faceless-explainer`: resolver una explicación con escenas y relaciones visuales.
- `syka-design-import`: adaptar diseños, SVG y exports de Figma aportados por el usuario. No incorpora un conector autenticado de Figma.

Se reforzaron `syka-editing-basics`, `syka-explainer-edit` y `syka-captions`: montaje antes de decoración, transcripción cruda/revisada separadas, sincronía después del recut y subtítulos nativos editables. El ejemplo `recut-timing.ts` convierte tiempos de palabras del medio original a intervalos conservados de la timeline, incluyendo recorte y cambios de velocidad.

`syka-motion-transitions` ya era una base nativa: sus ejemplos expresan movimiento con keyframes de Diffusion. Se ajustaron referencias para respetar el FPS del proyecto. La adaptación no equivale a trasladar todos los patrones de transitions.dev ni todo el registry de HyperFrames.

El catálogo real de esta instalación muestra 13 bases incluidas y una skill personal. Biblioteca agrega filtros Todas/Reels/YouTube con metadatos opcionales en las skills, sin perder las skills personales antiguas. La bienvenida «Crear con Syka» continúa reservada a una biblioteca vacía.

## Lienzo y controles

- Barra flotante con bordes redondeados, formas de iconos suavizadas y estilo de trazo coherente.
- Inicio, reproducción/pausa, fin, tiempo, velocidad con flecha integrada, bucle, volumen, pantalla completa y guía de atajos. Se retiraron los botones de avanzar/retroceder un cuadro; sus atajos siguen disponibles.
- El control de velocidad refleja el estado real de reproducción, incluidos J/K/L.
- Volumen y silencio actúan sobre la escucha de previsualización. No cambian los niveles del proyecto ni el audio exportado; la ganancia de escucha se aplica una sola vez en la raíz de la mezcla.
- Pantalla completa del video con controles y menús dentro del contenedor, salida por Escape o Ctrl+Enter y restauración de la cámara y vista anterior. Las herramientas de edición quedan ocultas durante esa vista.
- Nombre real de la composición en una cabecera compacta; selector de lienzos sólo cuando hay varias composiciones o una vista general. Se conserva la capacidad de trabajar con varias composiciones.
- Mayor superficie útil del video, chat con contorno redondeado y corrección de la línea del encabezado del inspector.
- Apertura/cierre de menús y estados de interacción siguen los tiempos de transitions.dev; se respeta `prefers-reduced-motion`.

El motor actual reproduce audio de previsualización a 1×. El menú lo indica: los otros valores de velocidad no añaden todavía reproducción de audio con cambio de tiempo.

## Assets y el logo de Vercel

`Assets` es el inventario de archivos importados en el proyecto. En `Tarjetas editoriales - 2026-10-04`, `assets.yml` registra únicamente `logos/vercel.svg`, una copia local creada durante la comprobación de búsqueda/importación de logos. No hay referencias a Vercel en la fuente actual de la composición. Los proyectos nuevos arrancan con el catálogo vacío; no es un logo predeterminado de Syka ni un cambio de su marca. El clip de esta prueba usa una ruta de medio directa y por eso no figura como archivo importado en ese catálogo.

No se retiró ese archivo: se investigó por pedido del usuario y no afecta el video.

## Verificación y límites

- Suite de agent-chat: 116 pruebas en 17 archivos.
- Suite de escritorio: 168 pruebas en 31 archivos, incluyendo metadatos y separación de skills incluidas/personales.
- Pruebas focalizadas de web: 10 en cuatro archivos para límites de transporte, tiempo, metadatos, ganancia de escucha y cámara.
- TypeScript de web, agent-chat y escritorio; validación de ocho skills.
- IPC de la app reabierta: 13 bases, una personal, nuevos contratos visibles, filtros y bienvenida oculta con contenido.
- Comprobación final de transporte en la app reabierta: volumen al 35%, silencio/reactivación, J/K/L y velocidad, bucle, pantalla completa con menús, Escape y Ctrl+Enter; sin excepciones del renderer.
- Build final web de producción completado con TypeScript. Persisten avisos del bundler sobre directivas `use client` ignoradas y tamaño de chunks; no son fallos de compilación ni prueban optimización de carga.
- La comprobación de transporte compara el hash del proyecto antes/después: no reescribe la composición ni genera un video nuevo.

La evidencia local está en `.runtime/native-toolbar-2026-10-04/`, con `ui-results.json`, `library-results.json` y capturas de la app. La comprobación final pasó después de reabrir Syka con las nuevas herramientas. Los timeouts de dos intentos de automatización previos no se contabilizan como éxitos; la ejecución secuencial final y el diagnóstico de fullscreen pasaron.

No se ejecutó una edición artística completa con las cuatro bases nuevas. La calidad del resultado requiere esa próxima prueba real con referencias y revisión visual. No se integraron todas las skills upstream, sus 394 entradas del registry, un renderer adicional, el onboarding completo ni un instalador.

## Primera comprobación de logos y recetas, antes de completar el catálogo

Sikora aclaró que el agente debe reutilizar los SVG existentes cuando una edición requiera mostrar una marca. Se reforzó esa instrucción general — no depende de elegir manualmente una skill — y `syka-media-use`: revisar assets del proyecto y biblioteca conectada primero, verificar marca/variante, copiar el original al proyecto y conservar proporciones. Una mención verbal no obliga a añadir un overlay. Ante una ausencia se informa el resultado y se usa otra fuente autorizada, se pide el original o se conserva el nombre como texto; no se inventa un logo real.

La búsqueda por la herramienta del agente y por el IPC de la app abierta encontró dos variantes de Vercel y cero resultados de Supabase, sin advertencias de lectura. Esto confirma que ambas carpetas conectadas se leen, pero no que contengan todas las marcas. No se descargó ni fabricó Supabase durante esta comprobación.

Actualización posterior: se encontró la colección LobeHub de la carpeta importada y se agregó un catálogo público offline con 2.052 SVG. La app ahora devuelve tres variantes de Supabase y seis de Vercel; una edición real de 15 s con Sol xhigh importó ambos SVG originales y exportó por Diffusion con mezcla nativa. Evidencia y reparación del bloqueo de export AAC en [LOGOS_AND_LIQUID_NATIVE_TEST_2026-10-04.md](LOGOS_AND_LIQUID_NATIVE_TEST_2026-10-04.md).

Se probó una receta sintética en un proyecto aislado bajo `.runtime/logos-recipes-2026-10-04/`: guardado, lectura desde una nueva instancia, respaldo y rechazo de una escritura con revisión antigua. Pasaron 12 tests dirigidos de recursos/recetas, TypeScript de agent-chat, validación de la skill modificada y build del host. No se modificó la composición ni la receta del proyecto del usuario y no se envió un turno al modelo. La evidencia de búsqueda y almacenamiento no equivale a una decisión autónoma del agente ni a una edición visual completa.
