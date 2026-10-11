# Instalación y distribución inicial de Syka Studio

Estado de la versión **0.208.0**: se construyó el instalador **Windows x64**, se verificó el conjunto de distribución y la aplicación empaquetada abrió con un perfil aislado en el equipo de desarrollo. La preparación de herramientas descargó los binarios upstream fijados, comprobó sus SHA256 y ejecutó Node, FFmpeg y yt-dlp; FFprobe forma parte del mismo paquete de FFmpeg.

Es una **beta sin firma digital**. Windows puede mostrar una advertencia de seguridad. Estos resultados locales no equivalen a una instalación completa en otra PC ni a un upgrade entre versiones.

| Validación | Estado |
| --- | --- |
| Instalador Windows x64 y recursos de la aplicación | Construidos y verificados localmente |
| Arranque de la aplicación empaquetada con perfil aislado | Probado en el equipo de desarrollo |
| Descarga, integridad y ejecución de las herramientas upstream | Probadas localmente |
| Instalación completa en otra PC | Pendiente |
| Upgrade real desde una versión anterior | Pendiente; requiere dos versiones publicadas |
| Firma de código de Windows | No incluida en esta beta |
| Instalación, firma y notarización de macOS | Pendientes de validación en una Mac real |

Las instrucciones para usuarios están en [el README](../README.md#instalación). El instalador se obtiene de una release pública compatible; si todavía no existe una estable, el bootstrap puede elegir una beta pública, pero nunca un borrador. El proceso para generar, revisar y publicar nuevos instaladores está en [Releases de Windows](RELEASING.md). Un push de código por sí solo no actualiza las instalaciones existentes.

## Recursos y datos del usuario

La carpeta de instalación y sus recursos se tratan como archivos de lectura. Chats, configuración, temporales y proyectos viven en ubicaciones escribibles del usuario. El código calcula ese runtime con `runtimeDirectory`; no debe sustituirse por rutas del equipo del desarrollador.

| Elemento | Procedencia |
| --- | --- |
| Interfaz, preload y agente host | Bundles incluidos en la aplicación |
| CLI y wrappers | Recursos de distribución; usan el Electron de la aplicación |
| Compilador y Babel | Dependencias externas incluidas en `runtime` |
| Preview interna | `web/preview-worker.html` y dependencias de navegador |
| Recorte de fondo | Runner, HyperFrames fijado, ONNX y librerías de la arquitectura |
| Node, FFmpeg/FFprobe y yt-dlp | Descarga directa desde upstream al directorio de herramientas del usuario; versiones y SHA256 fijados |
| Grabador Windows | Binario compilado para Windows x64 y aviso de origen conservado |
| Chats, preferencias, notas y credenciales | Perfil personal; no se distribuye el perfil del desarrollador |
| Video y audio del proyecto | Archivos del usuario; enlaces externos requieren conservar su ubicación |
| Proveedores opcionales | CLI o transporte soportado y login individual del usuario |

La preparación inicial de herramientas necesita Internet. Los proveedores también requieren sus propias cuentas y conexiones. Descargar herramientas directamente de upstream y redistribuir binarios dentro del instalador son operaciones distintas; sus avisos se describen en [Créditos](../CREDITS.md).

El modo de desarrollo y la distribución no tienen las mismas rutas. Para configuración explícita, `SYKA_RUNTIME_ROOT` debe ser absoluto; `SYKA_MEDIA_ROOT` define la carpeta de proyectos. Un proyecto con enlaces absolutos a un disco externo seguirá necesitándolo: no hay migración automática de esos medios.

## Comprobaciones de lectura

Desde la raíz del repositorio:

```powershell
npm run check:distribution
npm run build:installer -- --verify-only
```

Estas comprobaciones inspeccionan recursos o un conjunto ya generado: no instalan, no publican y no generan un instalador. Un resultado válido corresponde solamente a los archivos inspeccionados en ese momento. Si se vuelve a empaquetar, hay que volver a verificar el conjunto y generar sus checksums; los hashes de una compilación anterior no son los de la nueva.

Se puede inspeccionar un layout ya preparado para otro target:

```powershell
node scripts/check-distribution.mjs --app-dir="ruta/al/app" --resources-dir="ruta/a/recursos" --platform=win32 --arch=x64 --json
```

La verificación comprueba archivos esenciales, resolución dentro del runtime, módulos nativos y arquitectura PE de los ejecutables Windows. No ejecuta esos binarios ni prueba permisos, confianza de firma, codecs o un upgrade en otra PC. No debe reemplazarse por la presencia de herramientas en el PATH del desarrollador.

El build y el staging se describen por separado en [RELEASING.md](RELEASING.md): copian dependencias y generan recursos. No son comprobaciones de lectura. La preparación debe incluir todas las páginas de la UI, CLI, documentación pública y dependencias externas para la arquitectura elegida. FFprobe debe acompañar a FFmpeg.

## Validación pendiente en otra computadora

Usar Windows x64 y un perfil propio, sin las herramientas ni las cuentas del desarrollador. Comprobar el arranque desde una ruta con espacios y acentos y con la carpeta de instalación sin permisos de escritura. Crear un proyecto, importar imagen/video/audio, editar, cerrar/abrir y comprobar persistencia. Probar micrófono, grabación y un export manual corto con y sin audio.

Conectar un proveedor mediante su login propio y comprobar una tarea real. Verificar varios proyectos, cola de preview interna, cancelación y suspensión/reanudación. Cambiar la carpeta de medios y probar un enlace externo ausente para confirmar que se informa el problema. Como referencia de pruebas, se busca evaluar un equipo con 16 GB de RAM, SSD y gráficos integrados; todavía no es un mínimo de rendimiento validado.

Cuando existan dos versiones publicadas, probar el upgrade completo mediante Squirrel: conservar proyectos y preferencias, comprobar la versión instalada y confirmar el arranque después de actualizar. No inferir este resultado de un hash correcto ni de que el feed `RELEASES` tenga una estructura válida.

macOS requiere su propio build, dependencias nativas, firma/notarización y una instalación real en esa plataforma. No se anuncia todavía como soporte validado.

No incluir proyectos del desarrollador, su perfil, tokens, cuentas conectadas ni la carpeta `.runtime` personal. Muse está retirado y no es un requisito de instalación.
