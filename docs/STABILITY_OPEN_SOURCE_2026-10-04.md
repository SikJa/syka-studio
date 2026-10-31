# Estabilidad y preparación open source · 4 de octubre de 2026

## Cambios aplicados

Alcance confirmado: limpieza y configuración para seguir desarrollando. No construir un instalador ni implementar provisión de dependencias en esta etapa. Las notas de distribución son pendientes futuros.

- La app empaquetada guarda runtime, perfil, chat, temporales y logs en el espacio del usuario, separado del directorio de instalación. Un override explícito conserva su ruta y se rechazan overrides relativos. Desarrollo mantiene el runtime del checkout. No se movieron instalaciones ni proyectos existentes.
- El lanzador Syka dejó de usar una ruta personal de D. `npm run dev` y `dev:desktop` usan el mismo lanzador, que rechaza puertos ocupados sin matar servicios ajenos. Node mínimo del código fuente indicado en package/lock: 22.12.
- Detector compartido de Codex, Node, Git, Python, FFmpeg y FFprobe: override → herramientas administradas → sistema. FFprobe también se busca junto a FFmpeg. El entorno del host incorpora sus directorios para que la terminal pueda encontrarlos. La sanitización de credenciales de proveedores se conserva.
- Configuración → General → Herramientas locales muestra ejecutables encontrados/faltantes, su función y una acción de comprobación sin instalar/descargar. «Encontrado» significa que existe el archivo; no demuestra versión, login ni sus DLLs o paquetes.
- FFmpeg dejó de depender de un path Windows supuesto en el host. Se resuelve una instalación real o se comunica su ausencia, sin bloquear el encoder nativo del editor.
- La CLI preparada para el paquete apunta a `Syka Clips.exe`. Docs preparadas para distribución: instrucciones, mapa de servicios, reference, skills, guides y examples. Se excluyen los informes QA/auditorías del root y el árbol de marca upstream. Los targets de staging se validan antes de reemplazarlos. `.runtime` y output QA ignorados por Git; no se borraron esos datos.
- El texto de skills locales dejó de decir que se guardan en F. Las bases genéricas se empaquetan con las docs; skills personales, perfiles, cuentas y bibliotecas son opcionales y no se copian al paquete.

## Logos y portabilidad del proyecto

El agente queda instruido para buscar SVG de una marca en `syka_resources` antes de improvisar otro, cuando la marca se represente visualmente. Una mención de voz por sí sola no obliga a decorar el plano. Se elige símbolo/wordmark y contraste según el fondo.

Se encontró una limitación real: `AssetLibrary.import` enlazaba los medios locales; no copiaba sus bytes. Se añadió `copy:true` a `ImportOptions` y a la herramienta `assets`, y se activó para logos elegidos desde Biblioteca. El default de videos/audio sigue enlazando para no duplicar tomas grandes sin pedido. La copia conserva el original, usa `assets/` del proyecto y materializa un asset ya vinculado sin cambiar su identidad ni la ruta usada por JSX.

Comprobación real de `syka_resources`, query `Vercel`: dos resultados (`vercel.svg`, `vercel-text.svg`) en la biblioteca conectada, sin warnings. El primer SVG se importó mediante MCP con copy:true a `assets/logos/vercel.svg` en la muestra editorial. SHA-256 de copia y original idénticos; hash de `index.tsx` sin cambios. Se añadió sólo el asset, sin introducir un overlay ni cambiar/exportar el video. Evidencias locales: `.runtime/open-source-stability-2026-10-04/vercel-library.json` y `portable-vercel.json`, en el workspace padre.

Esto prueba búsqueda e importación reales, no un turno nuevo del modelo que decida por sí mismo usar Vercel. Las instrucciones quedan cargadas para los próximos turnos. Si la biblioteca no está conectada o no hay coincidencia, el agente debe comunicar ese resultado y usar otra fuente autorizada. Los SVG personales no se distribuyen como catálogo obligatorio de Syka.

## Validación

- Suite completa con config desktop: **58 archivos, 355 tests pasando**. Incluye edición, historial, puente, recursos, media, UI y pruebas nuevas de perfiles limpios/rutas de instalación y copia de assets.
- Regresión posterior de búsqueda de FFprobe al lado de FFmpeg: 3 tests dirigidos pasando.
- TypeScript desktop, web y agent-chat sin errores.
- Build web para desktop completado; advertencias existentes de `use client`/sourcemaps y tamaño de chunks. No se declaran resueltas como rendimiento de arranque.
- Build main/preload/agent-host/native y arranque Electron completados por el lanzador Syka.
- IPC real de dependencias encontró seis herramientas en esta máquina. Configuración renderizó el nuevo diagnóstico y respondió a «Volver a comprobar».
- Tests de assets: la importación normal conserva vínculos; copia exacta sin alterar original; reapertura tras desconectar el origen; conversión de un vínculo previo y deduplicación. Se mockea sólo el probe de dimensiones, no la lógica de copia/manifiesto.
- Staging real: CLI con nombre propio; docs sin informes de QA ni árbol brand. Las rutas personales no aparecieron en la búsqueda acotada de Markdown/TS/TSX del stage público.

No se cambió el orbe, no se ejecutó Computer Use, no se publicó un repo/release ni se enviaron datos a terceros durante esta revisión. La captura local de Configuración contiene datos del perfil del usuario y permanece sólo en el runtime local.

## Qué falta antes de un instalador público

Ver `OPEN_SOURCE_SETUP.md`, guía sin rutas de la máquina. Forge ya tiene ZIP/Squirrel y scripts de preparación, pero en esta entrega no se generó ni validó un Setup en un Windows limpio.

Falta el flujo de provisión de dependencias (versiones, descarga/verificación y resultados visibles), separación de requisitos del editor/chat/features opcionales, avisos/origen de binarios, firma/update propios y pruebas con un usuario sin ninguna herramienta o skill global. Node/Electron interno cubre el editor/CLI, no implica Node/Python/FFmpeg independientes para todos los scripts del agente. Codex requiere la instalación y sesión del usuario; Groq es opcional con clave propia.

No copiar el directorio de herramientas de esta máquina a un release sin validarlo: los ejecutables FFmpeg son un build compartido y faltan aquí sus DLLs/documentación completas como bundle autónomo. Una ruta detectada funcionando en esta PC no es una prueba portable. Tampoco se incluyeron cuentas, claves, skills personales de El Mago, ni carpetas de logos/sonidos/motions del usuario. Los medios grandes previamente vinculados requieren recopilarse antes de compartir un proyecto completo.
