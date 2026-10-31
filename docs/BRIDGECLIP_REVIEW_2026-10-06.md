# BridgeClip y entrada de enlaces en Syka

## Estado comprobado

BridgeClip se abrió con `Start-BridgeClip.ps1`, perfil local separado, y conserva una ventana titulada BridgeClip. No se enviaron claves, iniciaron trabajos facturables ni publicaciones.

El package local declara 0.1.19. GitHub releases/latest devuelve v0.1.19, publicada el 27/09/2026. El checkout local y la API de commits/main coinciden en b996820ef80fa324a3ad233bef1aac5cc6936804 (01/10/2026). No hace falta actualizar el checkout. La versión publicada y main no contienen necesariamente las mismas funciones; el commit posterior agregó chat con Claude Code, Codex y OpenRouter y mejoró el panel de webcam.

Fuentes: https://github.com/bridge-mind/bridgeclip/releases/tag/v0.1.19 y https://github.com/bridge-mind/bridgeclip/commit/b996820ef80fa324a3ad233bef1aac5cc6936804

## Qué podemos aprovechar

- Ingesta local, YouTube y Twitch VOD; descarga con yt-dlp y procesamiento local FFmpeg.
- Trabajos con progreso, cancelación y recuperación de errores; intervalos de origen startSeconds/endSeconds.
- Selección de momentos por transcripción, recorte de silencios, encuadre vertical/horizontal y variantes de captions.
- Revisión de candidatos y decisiones de edición; biblioteca con procedencia y resultados.
- Herramientas MCP para conversar con el pipeline, manteniendo operaciones y estados visibles.

El servicio video_downloader rechaza emisiones activas, próximas y todavía procesándose; acepta grabaciones terminadas. Capturar un directo mientras ocurre requiere otro flujo de grabación por segmentos. No es una función disponible por pegar el enlace.

El chat acepta suscripciones Claude/ChatGPT, pero start_clip_job sigue usando crédito OpenRouter para transcripción y planificación. No implica que los trabajos completos entren en la suscripción. Syka puede estudiar un flujo propio con su Groq conectado y el proveedor del chat; todavía no está construido ni validado.

## Flujo propuesto para nuestro composer inicial

1. Pegar un enlace y escribir qué clips se quieren. Al enviar, identificar el video y verificar disponibilidad, duración y espacio requerido.
2. Descargar mediante un trabajo cancelable, mostrando progreso en el mismo chat. Conservar el original y el enlace de procedencia en el proyecto.
3. Transcribir con la conexión elegida y generar candidatos con rangos de tiempo y explicación. Mostrar cualquier costo antes de ejecutar llamadas facturables nuevas.
4. Construir cortes, encuadres, subtítulos, audio y motions como entidades nativas Diffusion. Conservar rangos del original y mapa temporal; evitar sustituir el montaje por un MP4 quemado.
5. Abrir el mismo proyecto editable para revisión, corrección por notas, historial y export.

Actualmente el composer inicial manda texto/adjuntos a startChat; no tiene un trabajo de descarga de enlaces conectado. No se añadió un downloader en este encargo de revisión. Para implementarlo faltan una herramienta de ingesta, almacenamiento de trabajos/procedencia, adaptación de candidatos al source nativo y una prueba con un enlace real. La licencia MIT permite reutilización del código preservando su aviso de licencia/copyright; dependencias y recursos tienen sus propias condiciones.

## Interfaz terminada en este encargo

Inicio usa el nombre visible del perfil y saludos según la hora local, con variantes estables durante la composición. El perfil principal se guardó como Sika, conservando su foto. Orbe composing de 64 px encima del saludo; entrada con Transitions.dev y respeto de movimiento reducido.

Movimiento reemplaza el select nativo por el Select compartido con portal/modal, colores del tema y apertura/cierre de 250/150 ms. QA Electron comprobó oscuro, claro, selección persistente, Escape sin cerrar Configuración y nombre después de recargar. Esto no equivale a adaptar todo el editor al modo claro.

Evidencia: `Pruebas Syka/resultados/home-appearance-qa.json`, `inicio-sika.png`, `movimiento-menu-claro.png`, `notas-chat-circuito.json`.
