# Auditoría de interfaz, captura y preparación de Mac

Fecha: 6 de octubre de 2026. Implementación y validación local en Windows. La prueba visual usa Electron real, un perfil separado y Vite privado en `127.0.0.1:5227`, sin HMR. No cambia el perfil del editor abierto ni publica una versión.

## Corregido

### Modo claro

1. **Dos sistemas de tema desincronizados.** Kobalte escribía `data-kb-theme`, mientras controles React/MetalFX consultaban `data-theme`. El controlador publica el mismo valor para ambos; menús montados en portales también reciben el tema.
2. **Inicio gris oscuro y composer negro en tema claro.** El fondo del dashboard y la tarjeta de nuevo proyecto usaban un overlay negro fijo. Ahora usan superficies del tema. El composer, historial, cola, menús y estados de texto tienen colores claros coherentes.
3. **Contraste insuficiente en controles y bordes.** Se corrigieron tokens claros de texto secundario, borde fuerte, éxito y error. `color-scheme` acompaña el tema para controles nativos. Los iconos para acoplar y redimensionar el chat mantienen contraste.
4. **Chat flotante y tarjetas de corrección permanecían oscuros.** Ahora cambian sus fondos, bordes, sombras y texto con el tema. La captura adjunta conserva sus píxeles; no se aplican filtros a los videos ni al contenido de marca.
5. **“Reducir movimiento” no llegaba al composer.** Configuración guardaba `data-syka-motion`; los controles React observaban `data-motion`. Se publican ambas preferencias, sin cambiar la elección persistida ni desactivar globalmente animaciones de video.

Las nuevas reglas viven en `apps/web/src/styles/light-mode.css`. El cambio de superficie de “Nuevo proyecto” en `home-view.tsx` fue coordinado con el trabajo de importación de enlaces. Se conservaron los cambios preexistentes en el árbol de trabajo.

### Revisión automática de opacidad

`check` evaluaba el valor actual de opacidad como si describiera toda la película. Una entrada con `useTicker()` que vale cero en el primer frame podía producir el error “todos los frames vacíos”. Además, cualquier keyframe —incluso uno sólo de posición— ocultaba el aviso de transparencia constante.

- El reconciler registra en un `WeakSet` los nodos cuya prop `opacity` llega como getter reactivo. Es metadata del montaje; no cambia el documento guardado ni los parámetros del video.
- `check` diferencia cobertura estructural de cobertura potencial. Emite `dynamic-visibility` cuando una región depende de opacidad reactiva y recomienda capturar instantes representativos. No afirma que esos frames sean negros.
- La incertidumbre se propaga a los descendientes de un grupo. Un fondo fijo que cubre el intervalo evita un aviso innecesario.
- Sólo un track de **opacidad** evita clasificar el valor base cero como transparencia constante. Un track de posición no lo hace.
- Se conservan los errores de recursos, duración, regiones sin contenido y opacidad constante. Este chequeo sigue siendo estructural: no es una prueba perceptual de legibilidad, clipping, contraste, encuadre o de todas las expresiones dinámicas.
- El chequeo ahora espera la revisión actual de la fuente, además de un ciclo del motor, antes de analizar el montaje. La barrera y sus pruebas se detallan al final de este informe.

### Fallo real al capturar escenas distintas

La regresión anterior descubrió otro fallo: `createCapture` elimina las escenas que no se exportan, pero sus expresiones Solid todavía comparten el reloj del montaje. Un getter de una escena eliminada intentaba actualizar una entidad destruida y Koota fallaba al capturar la escena siguiente.

`RuntimeDocument.setProperty` ahora ignora exclusivamente entidades que ya no están vivas. No silencia errores de props de una entidad válida. El montaje sigue cerrando normalmente sus efectos.

## Evidencia verificada

Directorio de capturas:

`F:\Coding Proyects\Syka Clips\Pruebas Syka\resultados\ui-mac-audit`

| Prueba real | Resultado |
| --- | --- |
| Inicio, editor, composer y selector de modelos claros | Capturados e inspeccionados |
| Desacoplar y volver a acoplar chat en tema claro | Superficie legible y operación completada |
| Seleccionar componente editable y escribir una nota | Tarjeta y composer claros; borrador de prueba cerrado sin enviar |
| Select de movimiento dentro de Configuración | `Escape` cierra la lista y conserva Configuración |
| Selector de color dentro de Configuración, ventana 940 × 700 | Popup completamente dentro de la ventana; `Escape` conserva Configuración |
| Preferencia de movimiento | Se propaga a `data-motion` y se restaura a seguir al sistema |
| Recargar aplicación | Tema claro persistido |
| Capturar tarjeta nativa a 2,1 s antes y después del cambio de tema | PNG idéntico byte por byte |
| Configuración y editor en oscuro | Capturados e inspeccionados después del cambio |

Archivos principales: `before-home-light.png`, `after-home-light.png`, `after-editor-light.png`, `after-models-light.png`, `after-floating-light.png`, `after-review-light.png`, `after-motion-light.png`, `after-color-picker-light.png`, `after-settings-dark.png`, `after-editor-dark.png`, `after-checks.json`.

La primera prueba sobre el Vite compartido fue interrumpida por una recarga al cambiar archivos en paralelo. La tanda final completó con servidor privado y sin HMR; las capturas `after-*` y `after-checks.json` corresponden a esa tanda. Los archivos `failure*` son diagnósticos previos, no resultados finales.

### Tres escenas de regresión reabribles

Proyecto: `F:\Coding Proyects\Syka Clips\Pruebas Syka\QA-visibilidad`.

Está registrado sólo en el perfil de prueba. Para revisarlo manualmente, abrir esa carpeta como proyecto en Syka. No contiene medios externos ni consume generación.

| Escena | Resultado de `check` | Captura real a 0 s y 1 s |
| --- | --- | --- |
| `ticker`: grupo con opacidad derivada del reloj, 0 → 1 | Aviso de visibilidad dinámica; sin falso error de video vacío | Cambia de fondo vacío a tarjeta visible |
| `position`: opacidad fija 0 y track de posición | `transparent` y `no-visuals` | Permanece invisible, como corresponde |
| `opacity`: opacidad base 0 y track de opacidad 0 → 1 | Sin avisos incorrectos | Tarjeta visible después de la entrada |

Se capturó `0 → 1 → 0` en cada escena y luego se volvió a la primera tras capturar las otras dos. Los frames repetidos son idénticos; no se reproduce el error de entidad destruida.

Resultados: `Pruebas Syka\resultados\check-visibilidad\results.json`, imágenes `ticker-0.png`, `ticker-1.png`, `position-0.png`, `position-1.png`, `opacity-0.png`, `opacity-1.png`.

Comprobaciones de TypeScript completadas: `@diffusionstudio/web`, `@diffusionstudio/desktop`, `@diffusionstudio/reconciler` y `@diffusionstudio/dapi`.

Scripts locales de reproducción, desde la raíz del repo:

```powershell
node .runtime/ui-audit-runner.mjs
$env:SYKA_AUDIT_TARGET = 'opacity'
node .runtime/ui-audit-runner.mjs
Remove-Item Env:SYKA_AUDIT_TARGET
node .runtime/mac-config-qa.mjs
```

El runner crea y cierra su Vite y su Electron; no termina procesos compartidos.

## Mac: preparado, todavía no validado en una Mac

La base existente ya contempla rutas POSIX, `userData` para datos escribibles, descubrimiento del PATH de la shell, binarios de Homebrew, inicio de sesión con el navegador del sistema mediante `open`, wrapper POSIX del CLI y addon nativo de esquinas para ambas arquitecturas.

En esta tarea se añadió:

- Maker de DMG y ZIP para Darwin, conservando los instaladores Windows.
- Generación del `.icns` a partir del icono de **Syka**, con `sips` e `iconutil` durante el build nativo de Mac. El script anterior apuntaba a los assets originales de Diffusion.
- Descripción de permiso de micrófono en `Info.plist`, en español.
- `npm --workspace=@diffusionstudio/desktop run make:mac` y `make:mac:unsigned`.
- Compilación explícita para la arquitectura de la Mac que ejecuta el comando. Dependencias nativas staged, como esbuild, también deben corresponder a esa arquitectura. No se anuncia un binario universal sólo porque el addon de esquinas sí lo sea.
- Guardia que rechaza ejecutar el build Mac desde Windows antes de iniciar la compilación.
- Superficie clara opaca para que la vibrancy nativa oscura no tiña el lateral cuando se selecciona claro.
- Descubrimiento del CLI de desarrollo por el resolvedor existente (PATH, `~/.local/bin`, `/opt/homebrew/bin` y `/usr/local/bin`), eliminando la ruta exclusiva de Apple Silicon. Se traducen los avisos de CLI ausente y de mover la aplicación a Aplicaciones. El binario empaquetado y el shim Windows mantienen sus rutas anteriores.

Validado aquí: configuración Forge cargada, makers DMG/ZIP para Darwin, fuente PNG Syka 1024 × 1024, script shell con saltos LF, descripción de micrófono presente, rechazo del comando en Windows y lista de publishers vacía. Evidencia: `ui-mac-audit/mac-config-check.json`.

**No se compiló ni ejecutó un DMG. No se firmó, notarizó ni publicó nada.**

### Pendiente antes de distribuir para Mac

1. Build nativo independiente en Apple Silicon e Intel. Instalar el DMG, abrir/quitar cuarentena mediante el circuito firmado, revisar icono y permisos reales.
2. Firmar/notarizar con la identidad de distribución de Syka y probar Gatekeeper. No reutilizar la antigua automatización de publicación upstream.
3. Validar captura/export WebGPU, codecs, audio y micrófono, fuentes, redimensionado, transparencia nativa y pantallas Retina.
4. Probar descubrimiento de ffmpeg/ffprobe/yt-dlp y proveedores instalados por Homebrew o fuera del PATH, junto con las sesiones del navegador normal.
5. Validar el descubrimiento del CLI de desarrollo al iniciar desde Finder y desde terminal, en ambos chips. Se quitó la ruta fija de Homebrew ARM, pero todavía falta la prueba en el sistema real.
6. Revisar y reemplazar la automatización de releases heredada antes de habilitar distribución. Los publishers actuales siguen vacíos.

## Alcance pendiente de interfaz

Esto corrige superficies compartidas y flujos representativos, no certifica todas las pantallas del producto. Falta una pasada visual completa por biblioteca, publicación con cuenta real, errores de proveedores, sesiones largas, pantallas de alta densidad y todos los acentos personalizados. La traducción de algunos controles heredados del editor (por ejemplo `Assets`, `Add media`, `Background`) sigue pendiente.

La preferencia de reducir movimiento ahora llega al composer; aún conviene evaluar con una persona todos los efectos visuales y microinteracciones. No se modificó el estilo de las películas ni se aplicaron filtros de tema a las previsualizaciones.

## Integración de Biblioteca > Motions

Segunda tanda de QA: ambas tarjetas incluidas, **Órbita** y **Carrusel circular**, en claro y oscuro. Se reutilizó el proyecto `13-motions-referencia` sin modificar sus fuentes. Electron usó el `main.js` compilado a las 20:17 y el mismo servidor QA aislado; no se envió ningún turno al agente.

Verificado para las cuatro combinaciones tarjeta/tema:

- Poster cargado con tamaño real y vista previa MP4 local válida.
- Hover inicia reproducción; salir pausa.
- Click abre el modal y reproduce el video.
- El botón de la tarjeta y “Usar con el agente” dentro del modal generan la misma referencia y conservan el borrador previo.
- Drag real al área del chat lleva `componentPath`, los tres `componentFiles`, `usage`, composición y segundo. Se comprobó que todos los archivos referenciados existen.
- Drag real a la timeline rechaza la muestra MP4 y explica que se debe usar el componente mediante el chat.
- El número y tipos de nodos de la timeline se mantienen: 1 escena, 2 grupos y 2 HTML, duración 18 s. Los hashes de todas las fuentes y assets del proyecto permanecen iguales. Sin errores de página.

No fue necesario corregir código de producto en esta tanda. Las referencias quedan como datos en el borrador; esta prueba valida la entrega de contexto al composer, no la aplicación posterior por parte del modelo. El borrador y sus adjuntos de QA se limpiaron al terminar.

Evidencia: `Pruebas Syka\resultados\motion-library-ui\results.json` y diez capturas de biblioteca, modales y referencias. En especial `Oscuro-library.png`, `Oscuro-OrbitFeature-preview.png` y `Claro-CircleGallery-preview.png`.

Repetir con:

```powershell
$env:SYKA_AUDIT_TARGET = 'library'
node .runtime/ui-audit-runner.mjs
Remove-Item Env:SYKA_AUDIT_TARGET
```

## Barrera de revisión después de editar código

`syka_edit_source` guarda el archivo y su journal antes de que `fs.watch` y su agrupamiento de 80 ms avisen al renderer. El chequeo anterior podía certificar la composición vieja; además, una compilación fallida dejaba la vista previa anterior en pantalla y el chequeo seguía aprobándola.

La implementación ahora:

- Compara la revisión de la fuente en el journal con la revisión montada. Una comprobación que llega inmediatamente después de guardar puede iniciar la carga sin esperar al watcher.
- Espera compilación, carga de la biblioteca y al menos un ciclo del motor para obtener los valores calculados. Si la revisión cambió durante la compilación —incluido el estampado inicial de IDs— vuelve a intentar sin afirmar que ese bundle es actual.
- Se limita a cuatro segundos por llamada. Si sigue pendiente devuelve `busy`; si hay un error de compilación o de montaje devuelve `invalid-input` con el diagnóstico real. No devuelve estadísticas de la vista previa anterior. Una cancelación devuelve `canceled`.
- Conserva el comportamiento visual de mantener la última vista previa buena ante JSX roto. No bloquea globalmente la interfaz ni detiene la reproducción.
- Los guardados manuales informan su transición atómica `previousRevision → revision`. Si continúan la revisión montada, el chequeo acepta el mundo ya editado sin remontarlo ni vaciar Undo. Una edición ajena intercalada sigue necesitando recarga.
- Lleva un contador de avisos recibidos y aplicados para que el debounce del watcher no vuelva a montar un cambio que un chequeo inmediato ya cargó. La prueba encontró esa segunda carrera y verificó su corrección.
- Preserva la guardia `documentEdited` incorporada por el trabajo de subtítulos: un Undo que vuelve al mismo bundle original sigue restaurando el canvas.

### Evidencia real y reproducible

Electron nuevo con el `main.js` reconstruido, perfil aislado y servidor 5227. Proyecto descartable reabrible: `F:\Coding Proyects\Syka Clips\Pruebas Syka\QA-check-freshness-0a5aef31`. No se tocaron los proyectos 12–15 ni se enviaron turnos al modelo.

| Caso | Resultado |
| --- | --- |
| Primera compilación | 2 nodos correctos |
| Tres `syka_edit_source` seguidos de `check` sin espera artificial | 6, 3 y 9 nodos, respectivamente; 88–113 ms |
| Error JSX seguido inmediatamente de `check` | `invalid-input` con `Unexpected token`, sin estadísticas viejas |
| Reparar JSX | 9 nodos correctos |
| Edición manual de opacidad y `check` inmediato | Misma entidad, opacidad 0,7 y Undo disponible |
| Deshacer edición manual | Opacidad visible restaurada a 1 |
| Error JavaScript al montar composición | `invalid-input` con el error real; ninguna aprobación de la vista previa anterior |
| Reparar el montaje | 9 nodos correctos |
| Guardia pendiente controlada, plazo de 35 ms | `busy` y sin estadísticas; prueba de límite, no simulación de un compilador real lento |
| Cancelación del llamador | `canceled` |

Resultados completos: `Pruebas Syka\resultados\check-freshness\results.json`. Capturas: `before-error.png`, `compile-error.png` y `recovered.png`. La tanda final no produjo errores de página.

```powershell
npm run build:main --workspace @diffusionstudio/desktop
$env:SYKA_AUDIT_TARGET = 'freshness'
node .runtime/ui-audit-runner.mjs
Remove-Item Env:SYKA_AUDIT_TARGET
```

Cada ejecución crea su propia carpeta QA. Las fuentes rotas existen sólo durante el caso y la tanda final deja una composición válida. El runner cierra sólo sus procesos. Para activar la transición de revisiones de guardados manuales en una instancia ya abierta hay que reiniciar esa instancia con el main reconstruido; recargar únicamente el renderer no actualiza Electron main.

### Límites

La garantía de revisión inmediata usa el journal de las herramientas de edición y de los guardados manuales de Syka. Un cambio externo sobre un archivo rastreado que rompe el historial devuelve el conflicto en vez de certificar silenciosamente la composición. La notificación de archivos externos ajenos al journal sigue dependiendo del watcher del sistema; no se promete una transacción de todos los archivos del sistema operativo. La barrera se aplica a `check`; no agrega bloqueo global a otros comandos, y el resultado sigue siendo estructural, no una aprobación visual del video.

## Cierre posterior: exportación y contexto para contenido

La misma barrera se incorporó después al inicio del export DAPI, resolviendo la escena sólo cuando la revisión está lista. Se cerró el flujo export → oferta opcional de portada/textos, con contexto en adjunto JSON, mismo chat, cola y conservación de borrador. El informe [POST_EXPORT_CONTENT_QA_2026-10-06.md](POST_EXPORT_CONTENT_QA_2026-10-06.md) detalla 16 casos pasados y los límites de la prueba de modelo interceptada.

Durante esa validación se corrigió una promesa de assets que consultaba un world ya destruido y el canvas negro tras cerrar Configuración o terminar el primer export. Este último era una superficie de Chromium no repintada en pantalla, con el buffer y la escena intactos. El canvas visible conserva una capa compuesta estable y reinicializa su backing store una sola vez al reanudar Engine; no hay readback continuo ni cambios al motor offline. Llamar start cuando ya corre no reinicializa la superficie. Catorce capturas, ocho cierres de Configuración alternando tema, export y resize conservaron la imagen; fuentes sin cambios y cero errores de página. Un proyecto recién creado con texto e imagen PNG pasó de nuevo los 16 casos de post-export: la captura completa del canvas antes/después es idéntica píxel por píxel, con cámara y localTime intactos.
