# Recuperación pasiva de tokens históricos — 2026-10-11

Implementado y aplicado al inventario conservado de `project-cleanup-20261011/remaining.json`: 11 registros, 10 IDs únicos. Los dos registros de Calm Forest tienen el mismo ID y la misma carpeta canónica. No se recrearon proyectos eliminados.

| Proyecto | Tokens nativos recuperados |
| --- | ---: |
| Calm Forest 8 Oct | 19.239.580 |
| Golden Sunset 10 Oct | 16.135.577 |
| Fast River 10 Oct | 11.747.591 |
| Botella verde | 5.770.710 |
| Wild Sunset 11 Oct | 4.208.217 |
| Silent Dream 8 Oct | 3.849.041 |
| Fast Mountain 11 Oct | Sin datos |
| Wild Storm 10 Oct | Sin datos recuperables con esquema verificado |
| Fast Ocean 10 Oct | Sin datos |
| Fast Forest 9 Oct | Sin datos |

Total recuperado: **60.950.716 tokens**, siete sesiones con mediciones en seis proyectos. Golden Sunset tiene dos sesiones medidas. Wild Sunset tiene una sesión medida y otra sin eventos de consumo; el cero por defecto de SQLite no se importó como medición. Cobertura parcial. El modelo histórico queda sin desglosar: el modelo actual de un chat o del índice no demuestra el modelo de todos los tokens anteriores.

## Flujo y límites

`projects.usage` recupera los proyectos visibles antes de devolver el lote. `NativeUsageRecovery` consulta sólo los cursores Codex persistidos en los metadatos del chat, en el SQLite aislado de Syka. Los descendientes requieren tanto una arista nativa `thread_spawn_edges` como un `session_meta.source.subagent.thread_spawn.parent_thread_id` coincidente. Se excluyen identidades reclamadas por otros proyectos, rutas fuera del perfil, enlaces que salen del perfil y carpetas distintas. No hay descendientes adicionales recuperados en este inventario.

Se leen exclusivamente los rollouts vinculados, en streaming, y sus eventos `total_token_usage`. `last_token_usage`, contexto, costos, ceros por defecto y texto de conversación no se contabilizan. Los acumulados comparten exactamente el ID de fuente del adaptador vivo; reimportar o recibir después un acumulado igual no suma otra vez. Un acumulado mayor agrega sólo la diferencia. Los cambios posteriores de modelo conservan sus propios buckets. Los historiales copiados mediante `forked_from_id` se excluyen por falta de una base nativa que permita descontar lo heredado.

Cada lote se serializa. Archivos sin cambios de tamaño/mtime no se releen durante la vida del host. Límites: 128 sesiones por cursor, 512 candidatas por lote, 256 MiB por rollout y 1 GiB leído por lote. El índice usado es `isolated-state/state_5.sqlite`; si falta o cambia a un esquema incompatible, el resultado permanece desconocido. No se escanea el disco ni se consultan historiales ajenos por similitud de carpeta. Tras reiniciar, se releen sólo los archivos vinculados a los proyectos solicitados y se reconcilian con el ledger persistido.

Antigravity CLI conserva la sesión exacta de Wild Storm (`87708b6a-6147-482c-bcf1-20dc5b132f4e`) en `~/.gemini/antigravity-cli/conversations/<id>.db`. Se verificó su `cascade_id` y el esquema: `gen_metadata.data` y otros metadatos son blobs protobuf sin descriptor verificable disponible. La CLI instalada no ofrece un subcomando pasivo de exportación de consumo. No se decodificaron campos por conjetura ni se reanudó una tarea para obtenerlos. Esto no demuestra ausencia de métricas, sólo falta de extracción fiable con las fuentes inspeccionadas. Los proveedores Claude y ACP no tienen cursores asociados a estos proyectos conservados; sus adaptadores de mediciones nuevas permanecen operativos. Los tres proyectos sin chat persistido quedan sin datos.

## Validación y activación

- 55 pruebas aprobadas en seis archivos: recuperación nativa, ledger, WebSocket end-to-end, Claude, transporte Codex y Antigravity CLI. Incluyen acumulados nuevos, reimportación, reinicio, cero real frente a ausencia, alias, distintos proveedores/modelos, descendientes falsos, rutas externas y consulta del dashboard sin abrir un chat ni llamar un harness.
- Typecheck de agent-chat y web y compilación del bundle agent-host aprobados. Graphify incorporó `NativeUsageRecovery` automáticamente; no se usó análisis remoto.
- Importación real con `scripts/recover-project-usage.ts`: consulta repetida e instancia nueva produjeron resúmenes idénticos. Ledger: `../.runtime/diffusion/profile/agent-chat/project-token-usage-v1.json`. Resultado por proyecto: `../.runtime/diffusion/reports/project-cleanup-20261011/recovered-usage.json`.
- Chrome/Playwright con los componentes reales `DashboardProjectCard`, cliente y socket: diez tarjetas, seis medidas y cuatro desconocidas, detalle exacto de los seis totales y recarga sin errores de página. Datos reales recuperados; vista aislada, con copia del ledger y metadatos. Evidencia: `output/playwright/native-project-usage/result.json` y `cards-native-records.png`. El primer intento encontró dos tooltips por una animación de cierre; se corrigió la selección/espera del script y pasó. No se inspeccionó visualmente el dashboard del editor abierto: su endpoint CDP guardado estaba obsoleto.
- Se recargó únicamente el utility process Agent Chat después de comprobar que los once chats estaban idle y que no había hijos de proveedores. El editor principal PID 24168 siguió abierto; el nuevo host PID 19172 escuchó en loopback, puerto 62178. No se cerraron tareas activas ni se ejecutaron turnos reales o pagos.

No se descargaron dependencias, no se crearon instaladores y no se revirtieron cambios ajenos, incluida la limpieza de proyectos y `shell.trashItem(resolve(dir))`.
