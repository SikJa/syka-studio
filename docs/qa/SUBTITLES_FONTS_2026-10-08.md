# Biblioteca de subtítulos y fuentes — validación local

## Resultado

Biblioteca ahora incluye Subtítulos y Fuentes. Texto, Subtítulos y Fuentes usan tarjetas de una columna, del ancho del panel, con nombres de 13 px. El preview de subtítulos muestra un acercamiento al render nativo; su encuadre no modifica el proyecto. Los once presets tienen un poster con texto visible y animan al pasar el mouse. El preset Cascade conserva su alineación a la izquierda dentro del acercamiento.

Se corrigió el render vacío de Stark: un cambio de preset podía dejar `Computed.chars` vacío aunque el decoder ya tuviera texto. El texto efímero del decoder actualiza ambos stores sin emitir cambios que se guarden como contenido del usuario.

## Fuentes y distribución

El catálogo incluido contiene trece familias y sus avisos OFL/Apache, servidos como archivos locales del bundle. El agente puede consultar estas familias sin permiso de acceso a las fuentes del sistema. El runtime resuelve las fuentes de los nodos nativos Text/Captions y espera su carga para capturar.

La carpeta de Drive aportó doce archivos en seis familias: Athelas, Bootzy TM, Moonscape Demo, Nofex, OPTIZither y Switzer. Se importaron al perfil nativo como quince variantes: Athelas contiene cuatro caras en un TTC. Todas las quince caras cargaron realmente en FontFace de Chromium. El catálogo del agente devolvió diecinueve familias: trece incluidas y seis importadas.

Las fuentes del usuario se copian al perfil y se restauran en aperturas posteriores; no dependen de la carpeta original. No se incluyen en el distribuible público. La licencia [ITF Free Font License de Fontshare](https://www.fontshare.com/licenses/itf-ffl) restringe ofrecer Switzer como fuente seleccionable a terceros en una plataforma de edición. Nofex declara Free Personal Use en el archivo y Moonscape es una edición Demo. No se deducen derechos de redistribución del permiso de embedding del archivo. La interfaz y el agente conservan la metadata de licencia y los caracteres españoles faltantes.

## Verificación

- TypeScript de web, desktop y runtime: aprobado. Build web de producción y main desktop: aprobados. Se mantienen avisos de build sobre el módulo CRT y tamaño de chunks.
- Catorce pruebas de importación y resolución de fuentes: aprobadas, incluida extracción TTC con checksum, persistencia sin archivo original, deduplicación y selección de variantes estáticas.
- Veinticuatro pruebas de captions y BridgeClip: aprobadas, incluida la regresión de Stark y cambios de cue al buscar hacia atrás.
- App nativa aislada: perfiles, proyecto y puertos propios. No se modificó un proyecto del usuario para las pruebas. La última apertura no registró errores de página.
- Aplicar Editorial persistió en el JSX; Deshacer restauró Subtle y Rehacer restauró Editorial. Aplicar Switzer persistió su familia y peso 400; un solo Deshacer retiró todos los overrides de fuente. `src`, inicio y fin se conservaron. SHA256 del transcript antes y después: `454DDF106D59FA108DE8DB77292183E714A113CF6607EC0A784C67A02C3ED50E`.
- Arrastre nativo HTML5 hasta el textarea del chat: quedó una referencia Editorial con preview cargado. No se envió un mensaje ni se ejecutó un turno del agente.
- Grabación del editor: 61,27 s, H.264, 1500×980, 30 fps, sin audio. Las guías de texto se agregaron al video, no a la interfaz. [Demo subida a Drive](https://drive.google.com/file/d/11wY5kJfz9Yzs3cOSxBCm9q5snsmZxu3P/view).

Los scripts reproducibles son `scripts/subtitles-fonts-e2e.mjs` y `scripts/encode-library-demo.mjs`, relativos a esta carpeta. La evidencia local vive en `Pruebas Syka/Subtitulos-y-fuentes-2026-10-08`, fuera del bundle.

## Límites

Se agregó el botón de generar subtítulos con el servicio de transcripción configurado, pero no se ejecutó una transcripción remota como parte de esta prueba. Las piezas con fuentes propias necesitan esas fuentes y sus derechos en cada instalación; el catálogo incluido sí viaja con Syka. El nuevo IPC de importación se carga al iniciar el proceso nativo: una instancia abierta antes del cambio necesita reiniciarse. No se produjo ni publicó un instalador.
