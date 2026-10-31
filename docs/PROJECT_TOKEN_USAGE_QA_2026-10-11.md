# Tokens por proyecto — 2026-10-11

Las tarjetas del dashboard muestran el consumo nativo reportado al lado de la fecha de edición. Al pasar el mouse, muestran total exacto, proveedor/modelo y los desgloses disponibles. Sin mediciones aparece `Tokens: sin datos`; un cero recibido del proveedor sí aparece como cero.

## Integración

- Codex app-server: `thread/tokenUsage/updated.tokenUsage.total`, acumulado por thread. El indicador de contexto sigue usando `last` y `modelContextWindow` y no se suma al consumo.
- Codex descendientes: se verifica su linaje con `thread/read` antes de atribuir sus mediciones. Los threads ajenos se excluyen. Si no se conoce el modelo, el detalle lo indica.
- Gemini mediante Antigravity CLI: pasos DONE con IDs estables y reconciliación con `result.result.usage`, que es acumulado por sesión.
- ACP: `session/prompt.usage`, con compatibilidad para `_meta.quota.token_count` de versiones anteriores. Los avisos de ocupación del contexto no se suman como consumo. Si la ruta no entrega métricas, no se estima un número.

Registro local separado del historial: `<agent-chat dataDir>/project-token-usage-v1.json`. Es un archivo compacto con reemplazo atómico y escrituras serializadas. Usa IDs estables de proyecto y sesión, máximos acumulados y deduplicación de mediciones por turno. Renombrar o borrar chats no reinicia el contador. Duplicar un proyecto crea otro ID y no copia su consumo.

La cobertura histórica es parcial. Una sesión retomada puede recuperar un total anterior sin información fiable sobre sus modelos; ese tramo se muestra como modelo sin desglosar. Caché y razonamiento se conservan como campos nativos y no se agregan otra vez al total. El número no representa costo ni saldo de suscripción.

Las tarjetas visibles hacen una consulta en lote. Luego reciben actualizaciones por la conexión existente, incluso para chats no abiertos, y consultan de nuevo tras una reconexión. No se agregaron consultas periódicas ni llamadas al proveedor para medir tokens.

## Verificación

- 72 pruebas únicas aprobadas entre registro, socket real, Codex, Antigravity, ACP, almacenamiento y reducer. Una expectativa demasiado estricta del fixture sobre avisos del chat fue corregida; su prueba se repitió y pasó.
- Socket real con proveedor simulado: dos proyectos en paralelo, push a un cliente sin abrir el chat, duplicados, recuperación al reiniciar el host, reanudación y borrado del chat.
- Normalización de campos nativos, snapshots viejos, cambios de modelo, reconcilación entre pasos y resultado, primer acumulado sin diferencia, cero real, números inválidos e IDs especiales.
- Typecheck de agent-chat y web; compilación del host y build web de escritorio aprobados. El build conserva avisos existentes de `use client` y chunks grandes.
- Python Playwright/Chrome: componentes reales de las tarjetas en claro, oscuro y ancho de 380 px; detalle, actualización en vivo y recarga. Sin errores de página. Mediciones simuladas, sin usar tokens de proveedores.
- Capturas y scripts de la revisión aislada: `.runtime/token-usage-review/`. La revisión automática de aprobación bloqueó el borrado de las dependencias temporales; permanecen 108,9 MiB en `python/` dentro de esa carpeta. No se modificó el Python global ni se descargaron navegadores.

Activación: se recargó únicamente el utility process `Agent Chat`, después de comprobar que no había chats activos. El editor principal quedó abierto (PID 33620); el nuevo host (PID 3428) está escuchando en loopback. No se ejecutó un turno real o pago para validar el consumo del proveedor; su entrega real se verificará en las próximas tareas del usuario.

## Contratos consultados

- Esquema local de Codex CLI 0.159.1, `v2/ThreadTokenUsageUpdatedNotification.json`.
- [Codex app-server](https://learn.chatgpt.com/docs/app-server).
- [Antigravity CLI headless](https://www.antigravity.google/docs/cli/headless/).
- [Gemini CLI: métricas en ACP prompt response](https://github.com/google-gemini/gemini-cli/pull/29549).
