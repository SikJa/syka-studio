# Syka Studio: calidad de edición y cierre del producto

Revisión del 6 de octubre de 2026. Diffusion sigue siendo el motor y el documento editable. Este plan separa implementación, prueba local y validación humana de la calidad; una compilación correcta no equivale a una buena edición.

## Qué problema estamos resolviendo

El editor ya reúne chat, timeline, medios, notas visuales y export. La debilidad principal señalada por el usuario es editorial: escenas genéricas, poco criterio para elegir recursos y escasa semejanza con las referencias. Agregar más presets sin mejorar su elección, adaptación y revisión no resuelve eso.

La entrega trabaja tres capas: funciones realmente utilizables (captions/importación/biblioteca), fiabilidad (historial, tema, captura y export) y dirección (brief visual, beats, componentes con fuente y prueba sobre una toma real).

## Implementación y evidencia de esta entrega

| Área | Implementado | Evidencia / límite |
| --- | --- | --- |
| Subtítulos BridgeClip | Subtle, Editorial, Boxed y Spotlight nativos; palabras temporizadas, tipografía local, colores y selección | Proyecto 12 sobre la misma toma; comparación renderizada y cambio de preset en inspector. No MP4 quemado en la timeline |
| Pegar YouTube | Detección del enlace, ficha de duración/canal/capítulos, rango, descarga/cancelación e importación nativa | Proyecto 15: descarga real de 0:03–0:10, 7 s, reapertura, edición y deshacer. Preserva prompt y adjunto |
| Directos largos | Rango explícito en VOD/live/duración incierta o video largo; máximo 30 min por importación | No transcribe al descargar. No es todavía un analizador automático de un directo de 12 horas |
| Biblioteca de motions | Órbita y Carrusel circular originales para Diffusion; poster, video de muestra y fuentes/props via referencia al chat | Proyecto 13, 18 s, export real, seek determinista. HTML interno editable en fuente; no todos sus hijos tienen inspector independiente |
| Calidad del agente | Ruta compartida para proveedores, extracción concreta de referencias y revisión del beat difícil antes de repetirlo | Guía `reference-to-edit.md`. Proyecto 14 evalúa un turno real GPT-6.1 Sol xhigh; ver resultado específico, no generalizar a todos los modelos |
| Limpieza de voz | Perfil suave de 6 dB y filtro 70 Hz; normalización medida en dos pasadas; original conservado | Derivado real del audio del usuario: −17.99 LUFS, pico verdadero −2.03 dBTP. No separación neuronal ni aprobación automática de todos los sonidos |
| Modo claro | Superficies, composer, chat flotante, notas, portales, contraste y preferencias sincronizadas | Electron real; mismo fotograma idéntico entre temas. Falta matriz completa de todas las pantallas |
| Historial | Corregida la imagen desactualizada al deshacer contenido; preset/fuente siguen el historial | Prueba de preset, undo/redo y recarga en proyecto 12 |
| Preferencias y herramientas del agente | Corregido el dispatch de `syka_onboarding_memory` en Codex; endpoint/estado MCP real por instancia y bloqueo de conexiones fallidas | Un segundo turno real GPT-6.1 Sol leyó memoria, contexto, chequeo y captura de proyecto 14 mediante herramientas nativas, sin buscar otro puerto |
| Capturas y revisión | Opacidad reactiva ya no se confunde con un video vacío; captura de varias escenas no actualiza entidades destruidas | Proyecto técnico QA-visibilidad, tres escenas y retorno al mismo frame |
| Mac | Makers DMG/ZIP, icono, micrófono, CLI ARM/Intel y comandos de build | Configuración comprobada en Windows. Falta build, firma y prueba real en Mac |
| Distribución de referencias | Fuentes de componentes portátiles y avisos/licencias incluidos en el staging de documentación | No se redistribuyen las fotos, canciones ni los videos de inspiración de HeyGen |

Los informes de subtítulos, importación y UI contienen archivos exactos y pruebas reproducibles. Los proyectos de usuario anteriores se conservan; no se limpió la lista borrando trabajo ajeno.

## Cómo aprovechamos HyperFrames

- **Examples y catálogo:** referencias para elegir una técnica concreta, no un buffet de efectos que haya que insertar todos juntos. Una colección de imágenes justifica un carrusel; una explicación corta puede necesitar sólo una tarjeta o texto.
- **Design / FRAME.MD:** separar identidad visual del modo de componer y mover cada pieza. Guardar decisiones reutilizables dentro del proyecto, sin imponer otro formulario al usuario.
- **Prompt Guide:** convertir “hacelo lindo” en beats, jerarquía, duración de lectura, recurso y movimiento; comprobar una muestra con material real antes de terminar toda la pieza.
- **Studio Animation:** referencia para controles de timing, curvas, trayectorias y gestos. La reproducción determinista y la edición de propiedades ya tienen soporte nativo; un editor completo de trayectorias/gestos sigue pendiente.
- **Orbit y Circle Carousel 3:** reinterpretados como componentes originales nativos. La órbita es 2.5D; no es el rig Blender completo ni incorpora el runtime de HyperFrames.

Fuentes revisadas: [Examples](https://hyperframes.heygen.com/examples), [Catalog](https://hyperframes.heygen.com/catalog), [Design](https://www.hyperframes.dev/design), [Prompt Guide](https://hyperframes.heygen.com/prompting/overview), [Animation](https://hyperframes.heygen.com/studio/animation), [Orbit Card](https://hyperframes.heygen.com/catalog/blocks/orbit-card), [Circle Carousel 3](https://hyperframes.heygen.com/catalog/blocks/carousel-circle-3), [repositorio](https://github.com/heygen-com/hyperframes).

Esto **no entrena los pesos** de Codex, Claude, Gemini ni Hermes. Son instrucciones, ejemplos, recuperación de recursos y contexto de decisiones aprobadas. Un entrenamiento real requiere un modelo que admita ajuste, un conjunto de pares adecuados y evaluación; no surge de descargar una web. Tampoco corresponde afirmar que una técnica funcionará igual con cada proveedor sin probarlo.

## Orden recomendado para continuar

### 1. Evaluación editorial que cambie el resultado

Mantener un conjunto pequeño de videos reales: talking head vertical, entrevista horizontal, screencast, producto, montaje musical y explicación. Para cada uno conservar brief, fuente, receta, resultado, capturas y correcciones aceptadas. Comparar legibilidad, pertinencia del motion, ritmo, voz y fidelidad a referencia con una rúbrica común. Separar evaluación técnica de aprobación del usuario.

Criterio de cierre: dos ediciones distintas del mismo brief deben tener una diferencia observable y justificada; el agente debe revisar y corregir fallos visibles antes de declararlas completas. Repetir por proveedor, sin asumir equivalencia por compartir la skill.

### 2. Ocho patrones pulidos y parametrizables

La biblioteca previa tiene ocho patrones básicos: comparación, diagrama, pasos, cita, estadística, logo, antes/después y tarjeta. No se declaran ocho diseños excelentes porque rendericen. Pulirlos con contenido largo, vertical/horizontal, imagen real y versiones claras/oscuras. Exponer texto, colores, medios, duración de lectura y nivel de movimiento; cada ficha debe tener preview real y código portable, como los dos nuevos motions.

Criterio de cierre: cada patrón se usa en al menos una edición real, mantiene el texto más largo legible y se puede corregir desde una nota sin alterar el resto del video.

### 3. Directos: encontrar fragmentos antes de transcribir

Partir de URL + metadatos + capítulos/subtítulos disponibles + rango elegido. Mostrar duración y alcance antes de descargar/transcribir. Para bloques largos, extraer audio adecuado, dividir con solapamiento, guardar resultado por bloque, convertir tiempos a la fuente y reanudar sin repetir trabajo. Aplicar los límites reales de la cuenta/proveedor; no diseñar la operación alrededor de duplicar cuentas gratuitas.

Luego sumar candidatos de clip con motivo, intervalo y preview. Aprobados/importados van al ProjectPlan y timeline existentes. No crear un segundo editor oculto. El flujo actual de rangos es la base comprobada, no una promesa de selección semántica automática de 12 horas.

### 4. Audio que se pueda aprobar escuchándolo

Mantener limpieza suave como punto de partida aceptado. Comparar A/B a loudness comparable y guardar preferencia por pieza. Curar una selección pequeña de SFX y música utilizable, con licencia y previews escuchables; no confundir sintetizar 200 variantes con tener 200 sonidos buenos. Vincular cues a eventos y dejar silencios.

Pendiente: separación/aislamiento de voz cuando se justifique, ducking más automático sobre voz real, manejo de reverberación y evaluación auditiva. La normalización sola no los resuelve.

### 5. Animación y corrección sin fricción

Extender controles consistentes de entrada/lectura/salida y presets suave/rápido/rebote sobre propiedades nativas. Un ajuste debe conservar el tiempo legible y participar del mismo undo/redo. Incorporar trayectorias y grabación de gestos sólo si vuelven a keyframes editables y el seek/export coincide.

Conservar notas persistentes, captura y segundo/elemento señalado. Mejorar comparación antes/después vinculada a una modificación, no a una colección de capturas sin relación. Una nota antigua debe advertir sobre fuente cambiada antes de corregir un componente distinto.

### 6. Revisión de export y distribución

Ampliar pruebas con fuentes largas, subtítulos en bordes, recursos faltantes, codecs/rates y varios proyectos abiertos. `check` estructural no detecta por sí solo texto ilegible o una cara tapada. Evaluar fotogramas de lectura y transición, audio final y decode completo; conservar reporte concreto de problemas.

Cerrar Mac en hardware real ARM/Intel: importar, micro, proveedores, fuentes, WebGPU, export y proyecto reabierto en Windows. La configuración del instalador no sustituye eso. Completar modo claro y traducción con una matriz de pantallas, y separar publicación externa de validación local.

## Qué no está terminado sólo por esta entrega

No se promete selección automática de los mejores clips de 12 horas, edición al nivel de todos los ejemplos públicos, control individual de cada hijo HTML desde el inspector, aislamiento neuronal de audio, entrenamiento de modelos, un DMG probado ni una aprobación estética de todos los workflows. Son hitos con pruebas concretas por completar, no botones que convenga anunciar antes de funcionar.

## Cierre de exportación → portada y textos

Una exportación local de video terminada guarda su identidad (ruta, SHA-256, tamaño, fecha y revisión de fuentes observada) y ofrece **«¿Preparamos portada y textos?»**. No aparece por un audio, una cancelación ni un fallo, y espera si el recorrido inicial ocupa la pantalla. **Ahora no** queda guardado; Propiedades permite reabrir la oferta incluso sin seleccionar una escena.

El clic explícito continúa el chat actual y su modelo, o agrega el pedido a la cola si ya trabaja. Conserva el borrador y sus adjuntos. Una pregunta pendiente debe responderse primero. Si no hay chat o modelo compatible, deja la frase y una referencia como borrador, sin crear conversación ni enviar automáticamente. El mensaje visible es breve; las instrucciones de la skill, contexto del archivo y alcance van en un JSON local `.syka/chat-context/export-<id>.json`. Reabrir el mismo pedido aún no enviado no duplica ese adjunto.

La memoria editorial sigue siendo la de `syka-content-package` y su helper existente. El nuevo estado local sólo conserva identidad del export y presentación de la oferta. **No me lo preguntes más** ya registrado suprime sugerencias automáticas; la acción manual sigue disponible. El hash identifica el video; la revisión de fuente observada después de exportar no demuestra por sí sola qué revisión exacta se renderizó.

QA en Electron aislado: 16 casos pasaron, incluidos MP4 real de dos segundos, hash, temas claro/oscuro, movimiento reducido, rechazo persistido, reapertura, borrador sin chat, deduplicación, mismo chat/cola, pregunta pendiente, audio, cancelación durante encode, fallo real de escritura, archivo alterado y memoria manual. Evidencia en `Pruebas Syka/resultados/post-export/results.json`. Los envíos de ese suite fueron interceptados para comprobar el contrato sin llamar al modelo; la evaluación de portada y copy con un turno real es una prueba separada. Preparar borradores no publica ni sube archivos, y render completado no equivale a aprobación humana.

La validación también cerró la preview negra después de tapar el canvas o reanudar tras exportar. La escena, cámara y tiempo estaban intactos; fallaba la presentación de la superficie en Chromium. La capa visible queda estable y su backing store se reinicializa una sola vez al reanudar. Un proyecto nuevo con texto e imagen PNG conserva exactamente los píxeles de la preview antes/después del primer export, sin leer el canvas para forzar esa recuperación. La exportación offline no cambia. Queda pendiente repetir esta prueba gráfica en Mac y otras GPU reales.

## Referencias compactas y recorrido del editor

Los recursos de Biblioteca y los elementos de la timeline pueden usarse con el agente desde su menú contextual o arrastrarse al chat. El composer conserva una miniatura compacta; el detalle incluye la instrucción y el contexto completo, que se entregan en un adjunto local al enviar. La referencia retiene componente y segundo, fuentes editables y archivos acompañantes del motion. No descarga ni ejecuta instrucciones de referencia por adjuntarlas.

La prueba real con GPT-6.1 Sol xhigh envió Brightness y Carrusel circular desde el composer: el agente leyó el manifiesto y reconoció `index.tsx:qa-card`, 2,4 s, `CircleGallery.tsx`, `motion-time.ts` y `README.md`. No modificó ni exportó en ese ensayo. Evidencia en `.runtime/reference-ux-results/real-transcript.json`; las pruebas de interacción cubrieron mezcla de seis adjuntos, imagen/PDF, selección trasera, eliminación individual, menú por teclado y conservación del borrador ante un fallo de envío.

El recorrido opcional tiene 13 pasos, se puede omitir y reabrir desde Ayuda. Su paso de dictado apunta al botón real del micrófono: se comprobaron Groq configurado/sin configurar, chat normal/flotante y ventanas de 1200/940 px. El botón **Exportar** está arriba a la derecha de la columna central y usa el diálogo y pipeline existentes; el recorrido lo señala directamente. El menú conserva sus otras opciones de exportación. Foco por teclado, cierre, persistencia, temas y preferencia real de movimiento reducido están comprobados en `Pruebas Syka/resultados/editor-tour/`.

La memoria se evaluó con cuatro turnos reales, cerrando la app entre fases, en el proyecto16. Recuperó propósito, destino, referencia omitida y estilo de portada/textos sin repetir preguntas resueltas. Estos acuerdos son fixtures explícitos del proyecto QA, no preferencias globales de la marca del usuario. Ver `QA_MEMORIA_CONVERSACIONAL_2026-10-06.md`.

## Paquete de contenido probado con el modelo real

Proyecto16: export nativo de 6 s decodificado completo y acción **Preparar en este chat** ejecutada sin interceptar el envío. Codex GPT-6.1 Sol xhigh recuperó el estilo existente y creó portada SVG editable, preview PNG y dos descripciones de Instagram. La versión final v2 usa la transcripción previa del mismo original, verificado por hash; conserva v1 y el montaje. La respuesta final entregó portada y textos en el chat existente, y el host registró `turn.completed: completed`. Está listo para revisión en `03 Assets reutilizables/Contenido/prueba-de-memoria/export-234a72f4-v2/`; evidencia en `resultados/content-package-real-completion.json`. La instancia aislada no tenía Groq ni cuenta de publicación: no se confunde esa ausencia con el estado de las cuentas de la app principal.

## Integración en la app principal y cierre

Syka reiniciada en su perfil habitual, puerto 5188, conservando borradores, proyectos y chats. Los proyectos 12–16 se reabrieron allí y pasaron `check` sin incidencias ni conflicto de historial; Exportar está visible en los cinco. El16 conserva la respuesta final real y carga su PNG local dentro del chat. Los previews automáticos sólo leen raster de la carpeta del proyecto, verifican ruta real y tamaño, y liberan el blob al desmontar. Los enlaces a archivos también reconocen rutas de Mac; la ejecución en Mac sigue pendiente.

El `frame.md` de 14 actualizado por el integrador se incorporó como una entrada documentada sin reescribir la fuente ni borrar sus siete entradas anteriores. Snapshot y respaldo conservados; las APIs oficiales Deshacer/Rehacer se verificaron sobre una copia aislada. Reportes: `resultados/qa-doc-reconciliation.json`, `all-labs-main-integration.json`, `main-activation.json`; capturas `12-main-integrado.png` a `16-main-integrado.png`. La captura del16 antes de completar la carga de medios no demuestra una preview negra persistente: `16-main-warm.png` muestra el cuadro cargado en el mismo segundo sin seek ni readback del canvas.

Graphify actualizado sobre 119 archivos públicos seleccionados del árbol integrado: 1752 nodos y 3814 enlaces, rutas verificadas y hashes por archivo. Se ejecutó sólo AST local y agrupación sin etiquetas semánticas/API. No indexa documentos privados, medios ni credenciales. Es un mapa del código; los acuerdos editoriales persistentes siguen siendo datos del proyecto, no entrenamiento de pesos.

### Cierre adicional del 7 de octubre

Se incorporaron los cambios posteriores del chat de referencias: preset nativo **Subida suave**, acceso Suave y soporte de tipografía/tarjetas en las skills existentes. Pasaron nuevamente sus siete tests. Se recompilaron web desktop, proceso principal, preload, host del agente y CLI; se renovó la documentación distribuida con las skills y referencias permitidas. El proyecto `QA-tipografia-tarjetas-2026-10-07` quedó registrado en la app principal sin navegar fuera del proyecto abierto ni enviar mensajes. Conserva tres escenas/exports comparables y sus documentos de diseño. La aprobación estética y la prueba en Mac siguen pendientes.

Graphify se regeneró otra vez con 130 archivos públicos seleccionados, incorporando rutas del preset y previews locales del chat. Los hashes y resultados vigentes están en `graphify-out/`; sigue sin usar análisis semántico remoto ni indexar medios o documentación privada.
