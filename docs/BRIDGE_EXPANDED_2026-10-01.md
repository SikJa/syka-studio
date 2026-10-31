# Puente Codex ampliado — 2026-10-01

Syka expone los 19 tools del catálogo MCP completo: assets, open, context, capture, check, export, media_probe, media_grab, media_transcribe, media_filmstrip, media_waveform, media_listen, media_segment, models, voices, logs, screenshot, fonts y report. La lista deriva del catálogo, evitando omisiones futuras por una segunda allowlist manual.

Se suman syka_files y syka_skills. Permiten listar/leer/crear archivos, componentes y skills, y leer workflows personales, del proyecto y del editor. La terminal nativa y apply_patch están habilitados con ejecución local de confianza solicitada por el usuario. El bloqueo workspace-write de Windows rechazaba incluso Get-Location; con la política local actual ese comando pasó en una sesión real. Las herramientas de archivos siguen evitando sobrescrituras accidentales y resolviendo paths dentro del proyecto; la terminal no queda limitada a esas operaciones.

El journal mantiene CAS y deshacer para modificaciones individuales de fuentes existentes de hasta 16 MiB, incluyendo configuración, documentos y skills. No promete deshacer universal para terminal, archivos nuevos, movimientos, assets o exports. Los cambios de varias fuentes pueden hacerse mediante terminal/apply_patch, conservando copias cuando corresponda.

Las sesiones ya se guardan y recuperan mediante thread/resume. Prueba real: se creó y leyó una skill, se creó un componente, se ejecutó Get-Location, se cerró el proceso del agente y una nueva sesión recuperó una frase del turno anterior sin recibirla ni leer archivos.

## Validación real

- Native Codex imageGeneration + syka_generated_images: PNG real de 1.691.860 bytes usando la suscripción, sin API paga alternativa.
- Biblioteca: crear carpeta, importar esa imagen, listar, renombrar; sin alterar el archivo original.
- check sin issues, captura visible de imagen, MP4 H.264/AAC de 1920×1080 de 9.305.494 bytes. La escena QA usó la duración predeterminada de 16 segundos.
- report escribe Markdown en el runtime local; se eliminó el envío público a GitHub.
- 36 pruebas en 6 archivos pasaron; checks/builds del host, web, desktop y CLI pasaron antes del reinicio final.
- Proyecto real del usuario restaurado; QA utilizó carpetas separadas en D.

Evidencia: output/playwright/bridge-expanded/image-report.json (contiene datos de imagen; no volcarlo en logs), editor-report.json y native-report.json. Los scripts correspondientes permiten repetir la prueba; el de imágenes consume una nueva generación si se ejecuta.

## Proveedores y capacidad real

| Función del servicio Diffusion | Reemplazo actual / alcance |
| --- | --- |
| Transcribir y subtitular | Groq con clave propia y tiempos reales; motor local dibuja subtítulos. |
| Generar imágenes | Codex nativo conectado y probado con suscripción. Claude no genera fotografías de forma nativa; necesita herramienta externa. |
| Analizar video | Codex inspecciona fotogramas/capturas y transcripción; no recibe automáticamente un stream de video completo. Claude admite análisis de imágenes, pero no está conectado aquí. |
| Escuchar semánticamente audio | media_listen expuesto, implementación sin proveedor: error explícito. Transcripción y waveform no equivalen a escuchar música, ambiente o tono. |
| Generar voz / clonar voz | Sin proveedor o modelo local conectado; no se obtiene automáticamente de Codex/Claude Code por su suscripción. |
| Generar música y efectos de sonido | Sin reemplazo conectado. Se pueden importar y mezclar audios existentes. |
| Generar video | Sin reemplazo conectado. Ambos agentes pueden programar composiciones y animaciones; eso no equivale a generación audiovisual de un modelo. |
| Quitar fondo / upscale con IA | Endpoints alojados desactivados; requieren modelo local o proveedor. Escalado normal disponible. SAM2 local se expone por media_segment, con pesos/hardware pendientes de validar. |
| Añadir audio generado al video | Servicio desactivado; montaje/mix de pistas existentes funciona localmente. |
| Catálogos models / voices | Expuestos, devuelven listas vacías porque corresponden al proveedor Diffusion eliminado. No describen los modelos de la cuenta Codex. |
| Cloud uploads, cuentas, créditos, billing | Desactivados; sin fallback a Diffusion. |

Codex conserva búsqueda web e imágenes nativas. El navegador del puente sigue siendo una sesión aislada de lectura de páginas públicas; no se copiaron sesiones personales ni conectores/plugins de Codex Desktop. La terminal permite trabajar con herramientas locales del proyecto. El servidor local MCP y la app-server integrada no son una réplica exacta de toda la aplicación Codex Desktop.

Fuentes para comparación Claude: https://support.claude.com/en/articles/9002504-can-claude-produce-images y https://platform.claude.com/docs/en/build-with-claude/vision. La generación nativa de imágenes de nuestra ruta CLI/app-server se validó directamente; no confundirla con las limitaciones de la otra ruta OAuth pública de Sign in with ChatGPT.
