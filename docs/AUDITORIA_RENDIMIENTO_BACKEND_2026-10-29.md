# Auditoría de rendimiento y bugs — 29/10/2026

Alcance: host de agentes (`packages/agent-chat`), proceso principal (`apps/desktop`) y la forma en que la interfaz (`apps/web`) pide datos. Las mediciones usan la configuración y los datos reales de `E:\Syka Studio\Datos`, en solo lectura. Las bibliotecas se midieron sobre una copia temporal de su configuración. No se hicieron turnos con costo, logins ni cambios en la instalación. Antes de esta auditoría ya existían las de [11/10](INSTALLATION_PERFORMANCE_AUDIT_2026-10-11.md), 22/10 y 26/10; acá solo aparece lo nuevo.

## Resumen

Hay tres causas principales de la lentitud. Ninguna estaba cubierta por las auditorías anteriores:

1. **La app consume CPU/GPU sin parar en reposo.** Con Syka abierto 32 minutos, el proceso de GPU usó en promedio ~42 % de un núcleo y la interfaz ~28 %. Una muestra de 10 s dio lo mismo (41 % y 27 %). El motor del editor en reposo ya se había medido en 1,7 %, así que el consumo viene de la interfaz del chat y sus animaciones.
2. **Los chats guardan las capturas como texto base64.** De los 81 MB de historial, **70,3 MB (87 %) son 378 imágenes en línea**. Al abrir un chat se manda todo de una vez: el más grande envía 14 MB y 4.061 elementos, y la lista no está virtualizada.
3. **Los proveedores se vuelven a comprobar por completo cada minuto.** Cada vez que se monta el cuadro de mensaje o se abre el selector, si pasaron más de 60 s, se relanzan todos los CLIs. Esa comprobación tarda unos 41 s, por Hermes.

## Mediciones

| Qué | Resultado | Cómo se midió |
|---|---|---|
| CPU en reposo, proceso GPU | 41–42 % de un núcleo | `Get-Process` sobre la instalación abierta: promedio de 32 min y muestra de 10 s |
| CPU en reposo, interfaz | 27–28 % de un núcleo | Igual |
| RAM | Interfaz 362 MB, principal 176 MB, GPU 117 MB | Igual |
| Historial de chats | 65 chats, 81 MB; 70,3 MB son imágenes base64 | Lectura de `events.jsonl` |
| Abrir el chat más grande | Reconstrucción 493 ms + envío de 14 MB (4.061 elementos, 2.774 de herramientas, máx. 882 KB por elemento) | `ChatStore.readTranscript` + `JSON.stringify` del snapshot |
| Elemento más pesado | 2,3 MB (una generación de imagen) | Igual |
| Comprobación de proveedores | Antigravity 10 s, Codex 10,7 s, Claude 14 s, OpenCode 19 s, Hermes 41 s | `harness.probe` en paralelo con la configuración real |
| Biblioteca, logos página 1 | 1,65 s en frío, ~115 ms en caliente | `resourceLibrary` sobre una copia de la configuración |
| Biblioteca, página 2 y búsquedas | 55–124 ms en caliente | Igual |
| Biblioteca, sonidos y motions | 29 ms y 4 ms en caliente | Igual |
| Bloqueo del proceso principal por la biblioteca | máx. 24 ms | Temporizador de 5 ms durante un listado |
| JavaScript cargado al abrir la interfaz | ~4 MB (index 1,2 MB + transcripción 1,1 MB + mascota 1 MB + gen-ai 0,7 MB, por `modulepreload`) | `index.html` instalado |

## Hallazgos priorizados

### Impacto alto, esfuerzo bajo o medio

| # | Hallazgo | Dónde | Propuesta | Esfuerzo / riesgo |
|---|---|---|---|---|
| 1 | Las capturas y generaciones se guardan como base64 dentro de `events.jsonl`, y se reenvían a la interfaz y al historial del modelo | `protocol.ts:112` (`images?: ToolImage[]`), `store.ts:78` | Guardar cada imagen como archivo en la carpeta del chat (`images/<sha>.jpg`) y referenciarla por ruta. Servirla con un protocolo propio con miniatura. Migrar los chats existentes en segundo plano, con copia de seguridad. | Medio / medio |
| 2 | Abrir un chat manda el historial completo y la lista no está virtualizada | `host.ts:643` (`openChat`) | Enviar los últimos ~100 elementos y pedir más al subir. Recortar la salida de las herramientas en el snapshot y cargarla completa al expandir. Virtualizar con alturas variables. | Medio / bajo |
| 3 | Se vuelven a comprobar **todos** los proveedores si pasaron 60 s | `apps/web/src/agent-chat/store.ts:62,171`, `mirel-composer.tsx:125`, `model-picker.tsx:56`; host `PROBE_MAX_AGE_MS` | Subir la vigencia a 10–15 min. Comprobar solo el proveedor elegido o los que fallaron. Para el resto, usar el catálogo guardado (ya existe `provider-catalogs-v1.json`). | Bajo / bajo |
| 4 | Consumo constante de GPU/CPU en reposo | Interfaz del chat. Los sospechosos, sin confirmar: orbe en canvas a 30 fps mientras está visible (`agent-orb-canvas.tsx`), mascota, luz ambiente, ~20 animaciones CSS `infinite` y 30 usos de `backdrop-filter` | Primero perfilar (ver Plan de pruebas). Después pausar las animaciones cuando no hay actividad, la ventana no tiene foco o hay movimiento reducido, y quitar el blur de los elementos que se animan. | Bajo–medio / bajo |
| 5 | Hermes tarda 41 s en cada comprobación: anuncia 152 modelos y se inicia en frío | `installed-agents.ts`, `acp.ts` | Mantener vivo el proceso ACP entre comprobaciones, o comprobar Hermes solo al elegirlo. Mostrar su catálogo guardado. | Medio / medio |

### Impacto medio

| # | Hallazgo | Dónde | Propuesta |
|---|---|---|---|
| 6 | La interfaz carga ~4 MB de JavaScript al arrancar, incluidas la transcripción y la mascota | Bundle `apps/web` | Cargar transcripción, mascota y gen-ai con `import()` dinámico, solo cuando se usan. |
| 7 | La biblioteca recalcula todo en cada página y en cada tecla: lee la configuración y las anotaciones, hace `realpath` de pósters y componentes y ordena el catálogo completo | `resource-library.ts:70–260` | Cachear la lista ordenada por consulta y versión del índice, y paginar sobre ella. Resolver una sola vez las rutas del catálogo incluido. |
| 8 | El orden con recomendación calcula un SHA-256 en cada comparación del `sort` (N·log N hashes) | `resource-library.ts:242` | Precalcular el puntaje una vez por entrada. |
| 9 | La vista previa de sonidos y motions lee el archivo completo (hasta 24 MB) y lo manda por IPC como data URL base64 | `resource-library.ts:109–111` | Servirlo con un protocolo de archivo con streaming y rangos, en vez de base64. |
| 10 | La vista previa de cada logo vuelve a leer `resource-libraries.json` y las anotaciones de audio (`req.kind` llega vacío) | `resource-library.ts:71,87` | Cachear la configuración por su firma (tamaño + fecha) y saltear las anotaciones en las vistas previas. |
| 11 | La primera página de logos en frío tarda 1,65 s (al reabrir, la medición anterior dio 7,8 s) | `resource-index.ts` | Mostrar el índice guardado al instante y reconciliar en segundo plano, como se hizo con el catálogo de modelos. |

### Bugs y riesgos encontrados

| Estado | Descripción |
|---|---|
| Confirmado | El test `launch-plan` falla: la skill incluida no coincide con su copia. Probable diferencia de saltos de línea o contenido desactualizado. |
| Confirmado | 7 tests (Claude, historial de ediciones, herramientas del proyecto) solo fallan cuando corre la suite completa, por timeout de 5 s. Son inestables bajo carga. |
| Confirmado | `resource-libraries.json` apunta a `Desarrollo\Pruebas Syka\Biblioteca motions`, una carpeta de pruebas, como biblioteca de motions real. |
| Sospechoso | El renombre pendiente de `diffusion-studio` está bloqueado por un proceso que tiene la carpeta abierta. |
| Sospechoso | `agy models` tiene un timeout de 20 s. Con red lenta, Antigravity podría aparecer con error aunque esté conectado. |

## Referencias externas

- **Claude Desktop**: un historial de 121 MB colgaba la app en Windows por imágenes guardadas en línea. Es el mismo problema que el hallazgo 1. [Issue](https://claudeissues.com/issue/85302-apphang-on-windows-when-loading-a-121-mb-conversation-every-inlined-image-is-sto).
- **Claude Code (VS Code)**: imágenes de la cola re-serializadas 16–23 veces en el `.jsonl`. [Issue](https://claudeissues.com/issue/88983-bug-queued-image-prompts-are-re-serialized-into-the-session-transcript-16-23-tim).
- **Cursor**: pedido de una lista de mensajes diferida y virtualizada para chats largos. Corresponde al hallazgo 2. [Foro](https://forum.cursor.com/t/long-agent-chats-keep-full-history-in-renderer-need-lazy-virtualized-message-list-linux-agents-window/168073).
- **Coder**: guarda los adjuntos en una tabla de archivos vinculada al chat, no dentro de los mensajes. Es el modelo para el hallazgo 1. [Código](https://git.dragonfruit.dev/mirror/coder/src/branch/fix/tooltip-trigger-disabled-pointer-events/coderd/chatfiles).
- **Kilo Code**: virtualización que no vuelve a montar las filas ya terminadas. [Release](https://newreleases.io/project/github/Kilo-Org/kilocode/release/v7.7.2).
- **Animaciones CSS infinitas + blur**: en Chromium mantienen el compositor de la GPU trabajando a la frecuencia del monitor. Pausarlas bajó el uso de ~150 % a ~0–3 %. Corresponde al hallazgo 4. [Caso Claude in Chrome](https://claudeissues.com/issue/52826-bug-claude-in-chrome-agent-glow-border-pegs-gpu-at-150-on-120hz-displays), [caso animate-pulse](https://hotter.myaddr.dev/youtube-summaries/TKlOCjLMNtw.html).
- **HyperFrames**: no publica cómo cachea sus miniaturas. Sus notas de versión muestran que Studio solo recarga la preview cuando cambia un archivo que cargó ([v0.8.80](https://newreleases.io/project/github/heygen-com/hyperframes/release/v0.8.80)). Su resolución de medios usa una caché por SHA-256, primero del proyecto y después global ([resumen](https://vibeindex.ai/skills/heygen-com/hyperframes/media-use)). Ambas ideas sirven para los hallazgos 7 y 11.

## Skeletons y estados de carga

| Pantalla | Qué mostrar mientras carga | Con qué datos |
|---|---|---|
| Biblioteca (logos, sonidos, motions) | Grilla de tarjetas skeleton del tamaño final, sin saltos de layout | Índice guardado al instante; reconciliación en segundo plano |
| Historial de chat | Las últimas burbujas reales y skeletons arriba al subir | Página de los últimos ~100 elementos |
| Imágenes de herramientas | Miniatura con el tamaño reservado y después la imagen completa | Archivo en la carpeta del chat (hallazgo 1) |
| Selector de modelos | Ya resuelto con el catálogo guardado. Falta un estado "comprobando" discreto por proveedor | `provider-catalogs-v1.json` |
| Configuración > Modelos e IA | Filas skeleton por proveedor | Catálogo guardado |
| Dashboard de proyectos | Tarjetas skeleton con la miniatura reservada | Lista de proyectos |

Regla: el skeleton no se anima con `infinite` mientras no hay carga real. Se apaga con `prefers-reduced-motion`, para no repetir el problema 4.

## Plan de pruebas

1. **Perfil de reposo (antes de tocar animaciones):** abrir la app con `--remote-debugging-port` desde un acceso de diagnóstico, grabar 15 s de Performance en reposo y anotar qué capas y animaciones están activas. Repetir después del cambio. Objetivo: GPU por debajo de 5 % en reposo.
2. **Chats:** test que abra un chat con 4.000 elementos e imágenes. Medir el tamaño del snapshot (objetivo menor a 500 KB) y el tiempo hasta la primera pantalla. Test de migración: imagen base64 → archivo, con hash igual y backup.
3. **Proveedores:** test de que montar el composer dos veces en 10 min no relance las comprobaciones, y de que un envío solo espere al proveedor elegido (ya cubierto en `provider-probe.test.ts`).
4. **Biblioteca:** repetir este benchmark (frío/caliente, páginas, búsquedas, previews) antes y después. Objetivo: primera página en frío menor a 300 ms con el índice guardado.
5. **Bundle:** comparar el JavaScript inicial antes y después de la carga diferida.
6. **App real:** instalación con backup y verificación manual. La automatización de ventana sigue bloqueada para Syka Studio.

## Para después: Configuración

- Sección "Rendimiento": pausar animaciones, cantidad de previews simultáneas, vigencia de la comprobación de proveedores.
- Sección "Almacenamiento": tamaño del historial por chat, limpieza o migración de imágenes y uso de las cachés.
- Diagnóstico: botón para generar un informe de tiempos (proveedores, biblioteca, arranque) sin datos privados.
- Estado de cada proveedor con la última comprobación y su duración.

## Relevamiento de Configuración, Perfil, Chat y Brand kit (primera pasada)

Solo lectura; no se agregaron opciones.

| Sección | Qué tiene hoy | Problemas encontrados |
|---|---|---|
| General | Carpeta de proyectos, destino de guardado, actualizaciones y accesos rápidos | Las actualizaciones nunca podían funcionar porque el repositorio es privado (corregido el aviso). No hay opciones de rendimiento ni de inicio. |
| Perfil | Nombre y foto locales, y un texto sobre Codex | **Está en inglés** ("Local profile", "Agent connection") y solo menciona Codex, aunque hoy hay seis proveedores. No muestra qué perfil de datos está en uso. |
| Chat | Dos opciones: orientación del esfuerzo y material del composer | Faltan opciones de comportamiento: envío con Enter o con Ctrl+Enter, modelo predeterminado para chats nuevos, recorte del historial, mostrar u ocultar herramientas. |
| Brand kit | La página usa el brand kit del onboarding (`SykaOnboardingSettings`), el mismo que lee el agente | Corrección del 30/10: no hay bug. `settings/brand-kit.tsx` (que guardaba en `studio-settings.json`) es código muerto, no se monta en ninguna página. Conviene borrarlo junto con la acción `save-brand` para que no confunda. |
| Groq y Zernio | Clave y conexiones cifradas | Las credenciales "desaparecían" porque la app se abría con otro perfil (corregido). |

## Orden recomendado

1. Hallazgo 3 (vigencia de las comprobaciones): rápido y de alto impacto.
2. Perfil de reposo y hallazgo 4 (animaciones).
3. Hallazgos 2 y 1 (paginación del chat e imágenes a archivos), juntos.
4. Hallazgos 7–11 (biblioteca) con skeletons.
5. Hallazgos 5 y 6 (Hermes y bundle).
