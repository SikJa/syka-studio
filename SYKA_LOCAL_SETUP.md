# Syka Clips local — 2026-09-29

## Arranque

Desde `F:\Coding Proyects\Syka Clips`, ejecutar `./Start-Syka-Clips.ps1` (o `./Start-Syka-Diffusion.ps1`). Nueva base en `diffusion-studio`; implementación Remotion anterior en `studio` conservada. Windows/Electron primero; la UI nativa de Diffusion usa **SolidJS + TypeScript**, no React. Se conserva para reutilizar el editor completo.

UI dev: http://localhost:5188. MCP exclusivo Syka: http://127.0.0.1:3275/mcp. Nombre de registro `syka`; CLI propia `node apps/cli/dist/index.js`. No modifica automáticamente el MCP original ni configuraciones de otros clientes. No ejecutar el script dev upstream que recupera puertos por la fuerza.

Perfil, cachés, logs, Node/Electron de este checkout y temporales quedan en F. Los ejecutables Node/Codex existentes se usan sin mover sus instalaciones. El puente usa la autenticación externa oficial experimental de Codex app-server, validada con CLI0.159. El login Codex oficial existente en C se consulta sin modificarlo; credenciales sólo en memoria en el puente, sin copiar `auth.json`. Los datos nuevos del app-server se aíslan en F.

Medios/proyectos: `D:\Syka Media\05 🧩 Proyectos creativos\Syka Clips\Personal`. Exportación del editor y MCP por defecto a `02 Finales`. Los proyectos nuevos desde dashboard crean carpetas de preservación y descartables V2; el manifiesto completo y adaptador al servicio CreativeMediaStorage de El Mago siguen pendientes. Se conserva el formato nativo de Diffusion (`index.tsx`, package.json, assets.yml, cache); no se convirtió la timeline al formato Remotion.

## Servicios

Sin cuenta Diffusion, backend hosted, billing, créditos, planes, telemetría o actualizador upstream. Chat y edición usan Codex con cuenta ChatGPT; API-key auth y fallback externo rechazados. La app conserva chat/timeline/assets/inspector.

En Ajustes/General se configura Groq propio opcional, Whisper Large V3 Turbo. Clave cifrada por safeStorage; el renderer no la recibe de vuelta. Estado/guardar clave no hace llamadas. Falta clave y validación de una transcripción real; pruebas unitarias usan mocks.

Imagegen de Codex desktop, escucha semántica, generación de video/voz/música y transformaciones cloud no están conectadas. Codex puede razonar con fotogramas/transcripciones; no decir que oye audio directamente. Ver docs/SERVICE_MAP_SYKA.md.

## Cómo funciona el motor

La composición editable es fuente JSX: Solid y Babel la compilan, el reconciliador crea entidades Koota con tiempos, capas, texto y audio. La timeline y el inspector modifican esas mismas propiedades y las escriben en el código. Guardar/reabrir conserva el documento; errores de compilación preservan el último render válido.

Mediabunny decodifica medios localmente. El motor compone imágenes/textos con canvas y GPU, mezcla audio y el encoder usa WebCodecs/Mediabunny para producir el archivo local. Preview, captura y export usan la misma escena. No depende de Remotion ni de un render remoto. FFmpeg sólo se usó fuera del producto para verificar codec/duración/nivel de audio del resultado de QA.

## Evidencia verificada

- Build desktop/main/preload/agent-host y build web producción.
- Composición sintética 640x360: video H.264 + AAC mono + texto + shape, duración4s, sin problemas estructurales en check.
- Capturas en 0.5/2/3.5s; audio del MP4 preserva nivel medio -21.1dB del original. Export H.264/AAC1920x1080 duración4.010667s.
- Export OGG/Opus4s, prueba de lectura de ruta D con espacio/emoji y reapertura después de reiniciar.
- Groq ausente: error claro antes de materializar/convertir, sin red.
- Registro externo Syka y shims independientes del original; tests de configuración y Groq pasan.

Distribución: base MPL2.0 y modificaciones bajo MPL; skillsMIT y dependencias con sus licencias propias. Assets de marca upstream excluidos del bundle. Todavía no hay release, firma, avisos completos de terceros ni prueba de installer en PC limpia.

## Edición y recuperación del agente

El app-server oficial registra herramientas dinámicas Syka para leer, reemplazar y deshacer fuente. Sólo archivos de autoría TS/TSX/JS/JSX/JSON existentes en el proyecto; máximo256KiB. Resuelve symlinks/junctions, impide salir del proyecto y protege medios/carpetas ocultas. Cada escritura exige SHA256 actual; si cambió a mano falla antes de sobrescribir. Conserva versión e ID recuperable bajo `90 Descartable/Trabajo temporal/.syka-history`. Pedir “deshacé ese cambio” usa ese historial; no confundirlo con una garantía de integración de todas las ediciones de agente en el stack Ctrl+Z de la timeline.

Prueba real con suscripción Codex CLI0.159/modelogpt-6.1-sol: cambió un título en el proyecto D, lo deshizo y aplicó nuevamente. Hash del auth.json oficial sin cambios, ningún auth.json nuevo en F. Herramientas genéricas del ejecutor Windows no se habilitaron con acceso total.

Prueba posterior del mismo modelo/suscripción: `check` completó con cero issues y `capture` devolvió un fotograma como imagen al agente. Registro acotado MCP `syka`: sólo herramientas de inspección local autoaprobadas. `media_transcribe` se configura en UI/Groq; export se opera por el editor o CLI. El chat no habilita aún export/transcribe/generación/reporting como llamadas autónomas. No decir que ya existe un flujo completo de clipping automático.

Comprobantes locales: `.runtime/diffusion/qa-agent-mcp-report.json` (edit/undo) y `qa-agent-mcp-inspection-report.json` (check/capture). Prueba adaptada a CodexCLI mínimo0.159, API auth externa experimental; nuevas versiones necesitan revalidación.
