# Audio local, composición principal y gestión del agente

## Implementado

- FFmpeg y ffprobe locales en `F:/Coding Proyects/Syka Clips/tools/ffmpeg/bin`. Se reutilizó la instalación existente, sin descargar un servicio ni usar una API.
- `syka_audio_enhance` disponible en el puente Codex: reducción de ruido y normalización; perfil `speech` agrega filtro de graves y compresión. Genera un WAV nuevo en `03 Assets reutilizables/Audio mejorado` del proyecto abierto. No modifica la fuente. El agente puede importar ese resultado y colocarlo en la composición.
- Editor con una composición visible por defecto: la primera escena según el orden del documento. Se conserva el selector de composición y una vista general explícita de todos los lienzos. Las composiciones ocultas no reciben selección/hits. No se borraron escenas ni se trasladaron elementos del proyecto del usuario.
- Los medios arrastrados y las herramientas de dibujo usan la composición visible como destino. El agente recibe `context.visibleComposition` y las instrucciones para agregar ediciones dentro de ella, en lugar de crear otro lienzo.
- Configuración del dashboard: agregar, habilitar/deshabilitar y eliminar MCPs HTTP o stdio. Guardado local en `.runtime/diffusion/agent-settings.json`. Se cargan en una sesión nueva de Codex; no se heredan servidores ajenos de forma implícita.
- Skills: crear, leer, editar e importar una carpeta completa con `SKILL.md` y archivos auxiliares. Ubicación `.runtime/diffusion/codex-runtime/profile/skills`. Ediciones con control de revisión SHA-256 y respaldo en `skill-history`.
- Se mantuvieron las skills personales y del proyecto. No se rediseñó el chat ni el inspector derecho.

## Verificación

- TypeScript de web, desktop y agent-chat pasó. Suite enfocada de configuración/política/transporte/workspace: 16 pruebas, 4 archivos, todas aprobadas.
- Electron aislado con proyecto QA: creación/lectura/edición/importación de skills, conservación de auxiliares, rechazo de una revisión vieja y persistencia de MCPs.
- Canvas: composición principal azul visible y secundaria verde ausente; vista general muestra ambas; selección de secundaria muestra solamente verde. Sin errores del renderer.
- Suscripción real de Codex: un MCP stdio externo ejecutó `bridge_echo` y devolvió el marcador esperado. En la misma sesión se ejecutó `syka_audio_enhance` sobre una grabación real y se produjo un WAV de 3.262.566 bytes preservando el original.
- Evidencia: `output/playwright/agent-settings-scenes/report.json` y `output/playwright/bridge-expanded/audio-mcp-report.json`.
- App real reiniciada en `http://localhost:5188` (Electron 21804). `syka context` confirmó el proyecto `silent-sunset-29-sep` abierto y `visibleComposition.element = index.tsx:32ujik`, nombre `Scene 1`. Captura de la app real: `output/playwright/agent-settings-scenes/diffusion-studio_2026-10-01_19-54-12.png`; una composición visible, medios y subtítulos en la timeline, historial compartido habilitado.

## Límites del resultado

- La prueba de audio confirma ejecución y archivo generado; la calidad perceptiva debe juzgarse escuchando la grabación. FFmpeg procesa audio existente, no genera voces o música.
- La configuración MCP cubre URL y comando/argumentos. No se implementó una interfaz para OAuth, cabeceras secretas o variables de entorno por servidor.
- Instalación local de desarrollo comprobada. El instalador distribuible todavía requiere incorporar los binarios FFmpeg a sus recursos y revisar su redistribución; no se produjo un instalador en este cambio.
- Abrí un chat nuevo después de cambiar los MCPs o las skills para que la sesión arranque con esa configuración.
