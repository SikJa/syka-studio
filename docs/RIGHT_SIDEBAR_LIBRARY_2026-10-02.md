# Biblioteca y Propiedades integradas en Syka Clips

## Implementación local

`pages/editor.tsx` monta `RightSidebar`. Soundboard y la timeline original se conservan. Las pestañas separan Biblioteca de Propiedades; una nueva selección de elemento, asset o keyframe abre Propiedades. Las categorías son Básico, Estilo, Efectos, Animación, Transiciones y Audio; Todo mantiene la vista completa.

Los 22 paneles de Diffusion existentes siguen montándose con sus componentes y condiciones originales. No se reemplazaron sus sliders, selectores, keyframes ni acciones por controles de demostración. El filtrado por categorías organiza esos paneles sin alterar sus operaciones. Las categorías incompatibles explican qué selección necesitan.

Se usan los SVG originales, los tokens de tema y la tipografía existentes. Las pestañas deslizan su indicador; la entrada de paneles es breve y respeta `prefers-reduced-motion`, según transitions-dev.

## Biblioteca y edición

- Media muestra la AssetLibrary real, permite importar, insertar y arrastrar mediante el formato original de assets.
- Texto inserta Text y SolidPaint en la composición activa, en el playhead o en el tiempo del drop.
- Efectos, animaciones y transiciones se generan a partir de los catálogos originales. Estilo ofrece sombra y stroke.
- Aplicación y drops pasan por DocumentEditor/EditHistory. Las selecciones múltiples se validan antes de editar y se agrupan en un paso de Deshacer.
- Los drops de presets resuelven el clip usando el hit-test original de timeline. Un drop sin clip no modifica otra selección accidentalmente.
- Una transición requiere un shape dentro de una secuencia, como el inspector original. No se convierte silenciosamente un proyecto en secuencia.
- Las miniaturas son muestras ilustrativas del preset, no renders temporales del material del usuario. El resultado real se ve al aplicar en el lienzo.

## Skills y flujos

Biblioteca sirve para elegir, ejecutar, importar y administrar skills guardadas. Crear con Syka y Editar en chat abren una conversación con el modelo elegido y el contexto del proyecto; el agente pregunta por resultado, estilo y proceso antes de guardar. El formulario manual de pasos fue retirado. Las preferencias recientes pueden acompañar la conversación sin implicar entrenamiento automático del modelo.

syka_skills ahora expone list/read/create/save. Create escribe SKILL.md en el perfil personal configurado y rechaza reemplazos; save exige la revisión SHA-256 de read y conserva la versión anterior. La biblioteca refresca al terminar una tarea, al recuperar foco o con Actualizar. Importar conserva los archivos acompañantes mediante el IPC existente.

## Correcciones de las grabaciones 21:50 y 21:52

Los botones + de Efectos, Animaciones y Transiciones abren un catálogo visual con los presets originales. La selección abre sus controles originales de cantidad/duración/fase. Escape cierra el catálogo sin deseleccionar el clip. La apertura/cierre usa la receta dropdown de transitions-dev con reduced motion.

Las tarjetas dibujan un documento descartable usando reconciler, assetSystem, playbackSystem, motionSystem, transformSystem y renderSystem reales, sin audio, servicios ni fuente del proyecto del usuario. Hover/foco reproducen; el resto mantiene un fotograma estable. Las transiciones usan shapes en una secuencia con inicios explícitos, porque Diffusion no coloca automáticamente los hijos de sequence. Los presets de texto animan texto real y los colores permiten distinguir filtros.

Tracking conserva el panel, la herramienta y SAM2 originales. Las grabaciones muestran que el botón entra al modo de seguimiento; no muestran una operación SAM2 fallida ni permiten certificar un tracking completo.

## Validación

- Build de web (`tsc -b && vite build`) correcto. 33 tests en 9 archivos pasaron.
- Paridad de los 22 componentes del inspector contra la copia local previa a esta integración.
- Tests de biblioteca: compatibilidad de selección, transición en secuencia, aplicación múltiple en un comando, drop vacío, fallos de inserción y serialización de flujos.
- Tests del IPC real sobre filesystem temporal: crear/leer/guardar, rechazo de revisión vieja, backup e importación con archivos acompañantes sin sobrescritura.
- Regresiones existentes de historial, fuente/escritura, split, menú contextual y separación de audio.
- Captura del Electron real vía screenshot del puente confirma el panel nuevo dentro del proyecto abierto, sin modificar sus archivos de composición.
- En navegador con el componente y motor reales, proyecto aislado en memoria: seleccionar texto conserva Typography/Flow/Grow/Align; seleccionar clip abre Propiedades; aplicar blur y texto modifica entidades y Deshacer revierte; transición Dissolve aparece en su panel original; los catálogos visuales aplican Hue Rotation y Deshacer lo revierte; animaciones y las cinco transiciones se ven distintas; Skills presenta creación por chat sin formulario de pasos.

## Límites de la verificación

La fixture `apps/web/qa/sidebar.html` usa el motor y el componente reales, sin escritor de fuente ni acceso a proyectos personales. En navegador no tiene IPC de Electron y lo indica; no simula guardados ni ejecución de agentes. El backend de guardado se probó con archivos reales temporales. La captura del editor real muestra que Crear con Syka abrió el chat y el agente preguntó por el flujo sin editar el video. No se completó el guardado conversacional ni se ejecutó una skill contra un proveedor ni se hizo una prueba manual de drag con el usuario. La ejecución usa el puente existente y depende del modelo y los servicios disponibles en esa sesión.

El editor Electron local sigue usando Vite en localhost:5188. Los cambios de renderer llegan por HMR; el host local del chat fue recompilado y reiniciado de forma aislada para activar create/save de skills. La gestión de MCPs y El Mago no cambiaron. No hubo deploy ni publicación.

## Correcciones de contexto y entrada del panel · 02/10/2026

- El detalle de contexto se recortaba al pensar/responder porque el composer sólo permitía overflow visible cuando existía el botón Send con MetalFx. Ahora mantiene visible el detalle tanto con Send como con Stop. Escape también lo cierra aunque el disparador conserve el foco.
- El motor registraba cada pointerup de window, incluyendo interacciones con inspectores superpuestos al lienzo. Ahora sólo procesa la liberación del mismo puntero que inició un gesto en su canvas; mantiene la liberación fuera del canvas.
- Las tarjetas del selector “+” permiten arrastrar el mismo recurso que la Biblioteca. Las previews no capturan punteros y un selector en su animación de cierre deja de interceptar clics. Se conserva el renderer nativo y los inspectores originales.
- Verificación: build web correcto; 17 pruebas en 4 archivos (frontera de puntero, biblioteca, menú contextual de timeline e historial). Fixture `/qa/context.html` usa el composer real con telemetría fija de prueba: reposo, Pensando y Respondiendo; validación visual en anchos 360 y 300. No equivale a una prueba de proveedor ni a un arrastre físico de punta a punta.
- La grabación 22:41 se revisó localmente con Watch y transcripción offline. Se ajustaron las muestras al fondo oscuro y azul de Syka, usando el mismo renderer nativo. Sigue pendiente la conversación completa de creación de skills.
- El arrastre tenía otra causa concreta: la abreviatura JSX `draggable` producía un atributo vacío, que HTML no interpreta como habilitado. Se usa explícitamente `draggable="true"` en presets y medios; verificado en el DOM de biblioteca y selector.

## Corrección del catálogo que desaparecía · grabación 23:01

- La grabación fue revisada con Watch y transcripción offline. Mostraba el catálogo de Animaciones apareciendo y desapareciendo; Tracking y Audio sí respondían. No se reprodujo esa desaparición exacta en Electron mediante interacción automatizada.
- El catálogo ahora usa estado y Portal controlados por Syka, sin cierre automático por blur/foco ni el ciclo Presence de Popover. Cierra al elegir, pulsar el disparador, tocar fuera o usar Escape. Un nuevo open cancela el temporizador de cierre anterior. Conserva las previews reales, el drag de recursos y los inspectores nativos.
- Se coloca a la izquierda del panel, ajustado al viewport, para no tapar las categorías. Tiene fondo opaco, cierre sin capturar clics y las transiciones con reduced motion de transitions-dev.
- Las teclas del catálogo no propagan a los atajos del canvas: ArrowDown/Tab no deben mover clips ni crear historial.
- Verificación con componente y motor reales en `/qa/sidebar.html`, proyecto descartable en memoria: apertura persistente, cierre/reapertura rápida, Escape con retorno de foco, cambio a Efectos/Transiciones con el catálogo abierto, navegación por teclado sin generar historial; Slide up abre Phase/Duration/Delay nativos y Dissolve abre Duration nativa. El catálogo de transiciones quedó opaco y dentro del viewport de 1280×720, sin tapar categorías.
- Build web correcto; 13 pruebas en 3 archivos pasaron (biblioteca, punteros del canvas e historial). Typecheck final correcto. Estas pruebas no equivalen a interacción automatizada con la sesión Electron del usuario; no se editaron sus archivos de composición ni se llamaron proveedores.
