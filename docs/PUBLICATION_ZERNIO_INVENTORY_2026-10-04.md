# Syka Clips — inventario y plan de publicación con Zernio

Fecha de auditoría inicial: 04/10/2026, America/Buenos_Aires. Este documento conserva el estado de preparación previo a implementar. El estado posterior y su evidencia están en [PUBLICATION_ZERNIO_IMPLEMENTATION_2026-10-05.md](PUBLICATION_ZERNIO_IMPLEMENTATION_2026-10-05.md). Los ejemplos de las fuentes con fechas futuras no son operaciones realizadas.

## 1. Estado y frontera comprobados

- Worktree exclusivo: `F:/Coding Proyects/Syka Clips/worktrees/publicacion-zernio`.
- Rama comprobada: `syka/publicacion-zernio`; HEAD/base de comparación: `ee55302acec47dd282c6446e72efb7369d080dcf`.
- `git status --short` inicial vacío; 3.669 archivos versionados. La preservación del principal está registrada en el state.json de continuidad; no se repitió una auditoría de hashes del principal en este encargo.
- Leídos: documento de frentes paralelos, PROJECT_CONTEXT de la carpeta contenedora, SERVICE_MAP_SYKA del worktree y state.json. Este último todavía tenía `threadId: null` al leerlo: no sirve para inferir que este chat no exista.
- Búsqueda de `zernio|Zernio` en `apps` y `packages`: sin coincidencias. No hay integración de publicación encontrada en esta base.
- Existe export local, con selección/escritura del archivo en `apps/desktop/src/main.ts` (handlers `FILE_PICK_EXPORT`, `FILE_WRITE_OPEN/CHUNK/CLOSE/ABORT`). No se produjo un export en esta auditoría.
- Patrón de credenciales reutilizable conceptualmente: `apps/desktop/src/syka-groq.ts`, Electron safeStorage, secreto fuera del renderer, sin fallback en texto plano. No se leyeron ni copiaron secretos.
- El puente IPC tipado vive en `apps/desktop/src/main-channels.ts`; no se inventará un segundo protocolo paralelo.
- El agente embebido no hereda los conectores del Codex desktop, según SERVICE_MAP_SYKA. El DAPI mantiene `MCP_PORT = 3275` en `packages/dapi/src/mcp.ts`.

No se modificaron editor, timeline, render, chat, skills, bibliotecas ni proyectos; tampoco Bridgeclip o el checkout principal. No hubo instalación, arranque de UI, detención de servicios, commit, merge ni publicación.

## 2. Conexión real observada, limitada al escritorio

El conector existente `Zernio · MCP directo` respondió correctamente a `accounts_list({})`. Se verificaron dos cuentas y se consultó su health individual: ambas devolvieron `healthy`, `canPost: true`, sin permisos requeridos faltantes. Plataforma, username e ID coincidieron con la conexión esperada en la continuidad privada. Se omiten identificadores y nombres personales de este documento versionable: no son defaults del producto ni fixtures públicos.

Esto prueba el binding social del MCP accesible en este chat. No prueba el titular de facturación, saldo, cuotas restantes, una API key disponible en Syka, ni uploads/publicaciones exitosos. No se inspeccionaron contenidos privados ni se conectaron/reemplazaron cuentas. El health es una lectura temporal que debe renovarse antes de una operación futura.

## 3. Capacidades documentadas y consecuencias

| Área | Contrato oficial consultado | Decisión propuesta para Syka |
|---|---|---|
| API | Base `https://zernio.com/api/v1`; autenticación Bearer con clave propia. [Quickstart](https://docs.zernio.com/) | Cliente HTTP en Electron main; secreto cifrado por usuario. Ninguna clave incluida en el repositorio. |
| MCP | Servidor `https://mcp.zernio.com/mcp`; OAuth para clientes compatibles o Bearer API key. Catálogo ampliable mediante descubrimiento. [MCP](https://docs.zernio.com/mcp) | Alternativa futura para agentes; el login del escritorio no se traslada al agente embebido. No hace falta para el primer adaptador del producto. |
| Cuentas | `GET /accounts`, perfiles y health. OAuth social empieza por `/connect/{platform}` con profileId; puede requerir selección de página/canal. Scopes por área, incluido `posting`. [Conexión](https://docs.zernio.com/guides/connecting-accounts) | Primero listar cuentas existentes con la credencial elegida. No iniciar OAuth por consultar estado. Agregar/reconectar cuentas queda fuera del primer corte. |
| Upload | `POST /media/presign` con filename/contentType/size; devuelve uploadUrl, publicUrl y expiresIn. PUT de bytes al storage, sin Bearer de Zernio. Hasta 5 GB; MIME explícito, no octet-stream. URL firmada normalmente válida una hora. [Presign](https://docs.zernio.com/media/get-media-presigned-url) | Streaming del archivo autorizado, progreso y cancelación. No mandar rutas locales como media URL ni cargar todo el MP4 en memoria. |
| Retención | Upload temporal: siete días; crear/actualizar un post que referencia la URL copia el medio a almacenamiento permanente. Se pueden programar posts para semanas o meses después. [Media](https://docs.zernio.com/guides/media-uploads) | No heredar el tope de programación de 6½ días de Bridgeclip. Validar que el upload siga vigente cuando se crea o actualiza el post. |
| Crear | `POST /posts`: content, mediaItems y platforms con accountId; modos isDraft, publishNow o scheduledFor. isDraft tiene prioridad; una fecha pasada puede publicar inmediatamente. [Crear post](https://docs.zernio.com/posts/create-post) | Modos excluyentes en nuestro contrato. Borrador local por defecto, sin red; borrador remoto será una acción diferente si se incorpora. Revalidar fecha inmediatamente antes del POST. |
| Horario | ISO con Z/offset representa un instante; sin offset depende de timezone y su default es UTC. Respuesta en UTC. [Horarios](https://docs.zernio.com/guides/timezones) | Persistir instante UTC y zona IANA elegida; mostrar fecha/hora/zona y comprobar el horario devuelto. No depender de la zona del proceso. |
| Reintentos | Idempotency-Key por post lógico, ventana documentada de 24 horas; replay devuelve el post original. `409 idempotency_conflict` requiere esperar Retry-After; deduplicación de contenido es un conflicto distinto. [Idempotencia](https://docs.zernio.com/guides/idempotency) | Guardar clave y payload antes de enviar; no generar otro post ante timeout. Fuera de ventana, reconciliar y pedir decisión explícita. |
| Seguimiento | `GET /posts/{postId}`; estados draft, scheduled, publishing, published, partial, failed, cancelled; resultados por destino. publishNow puede responder `207` con fallos aunque HTTP sea 2xx. También existen webhooks. [Ciclo](https://docs.zernio.com/guides/post-lifecycle) | Inspeccionar estado y errores por cuenta, no sólo response.ok. Primera versión con polling acotado mientras la app está abierta y recuperación al iniciar. |
| Límites | Guía actual: 60/600/1.200 peticiones por minuto según cuentas conectadas; límites de velocidad y diarios adicionales. Headers de cuota y Retry-After. [Rate limits](https://docs.zernio.com/guides/rate-limits) | Leer límites reales de respuesta, backoff con jitter y presupuesto compartido. No inferir saldo ni capacidad por el listado de cuentas. |

No se hicieron llamadas autenticadas a la API REST desde Syka. La investigación documental no es validación end-to-end. Webhooks requerirían infraestructura receptora y verificación de su contrato: no se configuran aquí. La programación aceptada por Zernio pertenece al proveedor; no depende de mantener la app abierta. El seguimiento local sí se retoma al abrirla.

### Primeros destinos propuestos

Empezar con un único destino elegido por operación; proponer YouTube como primera vertical y luego Instagram Reels. No seleccionar automáticamente una cuenta por ser la primera de la lista.

- YouTube: video obligatorio; título, descripción y visibilidad explícitos; revisión de madeForKids y declaración de contenido sintético cuando corresponda. La guía indica hasta 15 minutos en canales no verificados y 12 horas en verificados; Shorts hasta 3 minutos. El máximo de la plataforma no elimina el límite de 5 GB del upload de Zernio. Ver [YouTube](https://docs.zernio.com/platforms/youtube).
- Instagram: la guía consultada lista Reels de 3–90 segundos, 300 MB y formato vertical; requisitos cambian por tipo de publicación. No extrapolar a Stories/feed. Ver [Instagram](https://docs.zernio.com/platforms/instagram).

Son reglas documentadas, no pruebas con las cuentas leídas. Mantener validadores por destino/versionados y revalidar documentación al implementar; evitar importar toda la tabla histórica de Bridgeclip.

## 4. Bridgeclip: referencia de sólo lectura

Raíz revisada: `F:/Coding Proyects/Syka Clips/bridgeclip`. Su LICENSE declara MIT, copyright BridgeMind LLC; si se reutiliza código se debe conservar atribución. No se copió implementación en este encargo.

| Archivo relativo a Bridgeclip | Qué aporta / cuidado al adaptar |
|---|---|
| `src/shared/zernio.ts` | Tipos de cuentas, perfiles, health, stale y errores. `canPost` desconocido no equivale a comprobado. |
| `src/shared/zernio-posts.ts` | Validación de captions/media, modos y estados. Su scheduleWindow liga horario a siete días de upload menos margen: contradice la retención permanente documentada actualmente. |
| `src/main/zernio/client.ts` | REST, saneamiento de errores, rate-limit, cuentas, presign y posts. createPost envía x-request-id; comentario de replay de unos cinco minutos. Nuevo adaptador debe usar Idempotency-Key persistente. |
| `src/main/zernio/service.ts` | Sincronización, caché, health y flujo de conexión. No transportar creación de perfiles/reconexión automática al primer corte. |
| `src/main/zernio/posts-upload.ts` | Streaming, longitud/MIME, progreso, abort, deadlines, rechazo de redirects y resolución a direcciones públicas. Evita enviar Authorization al storage. |
| `src/main/zernio/posts.ts` | Journal previo a envío, comprobación de payload, reserva de persistencia y recuperación; ventana local REQUEST_REPLAY_SAFE_MS de cuatro minutos. La limpieza genérica de requestId ante 4xx necesita distinguir el actual 409 de idempotencia en curso. |
| `src/main/zernio/posts-store.ts`, `workspace-cache.ts` | Historial por binding, validación de registros y persistencia; no mezclar historial cuando cambia la credencial/cuenta. |
| `src/main/zernio/posts-payload.ts`, `callback-server.ts` | Separación de payload y callback OAuth; referencias para futura revisión puntual, no componentes declarados portados. |

Tests inspeccionados: `tests/zernio/client.test.cjs` (mocks, parsing, errores, cuota), `posts-store.test.cjs` (carreras de carga/refresco y acciones concurrentes), `audit-zernio.test.cjs` (journal y enlaces simbólicos, metadatos generados) y soporte `mock-zernio.cjs`. También se inventariaron suites de posts, conexión, callbacks y automatizaciones. **No se ejecutaron**; sus fixtures locales no acreditan capacidades actuales del proveedor. No importar automatizaciones, FFmpeg, store React ni arquitectura completa del producto anterior.

## 5. Contrato y flujo propuestos

`Export existente → destino explícito → copy y borrador local → revisión de operación → upload → enviar/programar → estado persistente`.

El editor sólo entrega una referencia a un archivo terminado con metadata disponible. Publicación comprueba existencia y acceso desde main; obtiene tamaño, MIME, duración y dimensiones cuando sea posible. Un campo desconocido no se transforma en cero. No vuelve a renderizar ni altera el video. Primera entrada mediante selector de export existente, para evitar tocar el motor; un botón posterior del editor sólo entregaría esa misma referencia.

Modelo sugerido, todavía no implementado:

```ts
type PublicationDraft = {
  id: string; revision: number; bindingId: string;
  export: { path: string; sha256: string; size: number; mime: string };
  target: { accountId: string; platform: string; profileId?: string };
  copy: { text: string; title?: string };
  platformOptions: Record<string, unknown>;
  timing: { mode: 'now' } | { mode: 'schedule'; atUtc: string; timezone: string };
};
```

Persistir además metadata técnica, snapshot de identidad legible, revisión aprobada, phase local, idempotencyKey, payloadHash, upload/publicUrl y fecha, externalPostId opcional, estado bruto conocido del proveedor, resultados por destino, error saneado, retryAfterAt y lastCheckedAt. Guardar en userData/publication por binding, fuera del repo y de los proyectos de video. Borrador local carece de externalPostId; `submitting_unknown` es estado local, no estado inventado de Zernio.

Antes de enviar: validar revisión y hash del archivo, cuenta/health actuales, límites, horario y capacidad de persistencia. Cambio de archivo, copy, destino o fecha invalida la revisión anterior. Tras upload, repetir validación de fecha: si quedó atrás, detenerse para elegir otra, nunca convertir schedule a now. Propuesta de margen local de cinco minutos, ajustable y rotulado como política Syka.

Escribir journal atómicamente antes del efecto remoto; conservar binding, payload y clave tras timeout/crash. No repetir automáticamente una publicación cuyo resultado sea desconocido ni reenviar destinos ya publicados. Diferenciar conflicto de contenido, idempotencia en curso, auth, cuota, media y falta de red. Un estado no reconocido se conserva como desconocido para inspección; no se transforma en éxito. Al reiniciar, recuperar trabajos y reconciliar IDs conocidos antes de ofrecer reintentos.

## 6. Secuencia de implementación y aceptación

1. **Dominio y persistencia local.** Módulos nuevos bajo `apps/desktop/src/publication/`: types, store, validation, service y adaptador simulado. Tests de CAS, escritura atómica, recuperación, separación de binding y archivo cambiado. Sin llamadas externas.
2. **Credencial y lectura.** Vault propio con safeStorage y estado sin secreto; cliente REST con timeouts/saneamiento; accounts/health explícitos. Pruebas con fixtures sin datos personales. Lectura real sólo con credencial que el usuario configure para Syka; no extraerla del desktop.
3. **Flujo visible de borrador.** Pantalla pequeña bajo `apps/web/src/components/publication/` (ubicación propuesta), selección de export/cuenta y copy editable, revisión de video/destino/horario. Hooks IPC tipados mínimos. Borrador funciona offline; la lista cacheada indica antigüedad.
4. **Upload y envío robusto.** Streaming, cancelación, journal/idempotencia, 207/409/429/5xx, timeout y crash. Mock HTTP cubre respuesta perdida, horario vencido durante upload y reintento sin duplicación. Guardar borrador nunca debe disparar upload/POST.
5. **Seguimiento.** Estado por destino, enlace remoto y error accionable; polling con backoff, pausa offline y reconciliación al reiniciar. Reprogramar/cancelar/reintentar son acciones posteriores explícitas, con semántica revisada por endpoint.
6. **Validación real acotada.** Sólo después de que Sikora elija archivo, cuenta, copy, visibilidad y enviar/programar. Registrar postId y comprobar resultado remoto; una publicación privada/no listada también es una escritura real que debe elegir el usuario. No hay tal operación autorizada en este inventario.

Puntos compartidos a revisar por separado: `apps/desktop/src/main.ts`, `main-channels.ts`, preload si el puente lo exige, rutas/dashboard web y package/package-lock únicamente si hace falta una dependencia. Proponer diffs pequeños; no integrar la captura completa ni modificar estos puntos en esta etapa. API REST con fetch permite evaluar el primer corte sin introducir SDK automáticamente.

Para futura QA visual: runtime/profile/media/build/dependencias propios, web 5298 y DAPI/MCP realmente aislado antes de arrancar. Cambiar sólo el puerto web no alcanza. No usar launcher, perfil o servicios del principal. Installer/onboarding, multipost, colas recurrentes, analytics, inbox y webhooks quedan fuera del primer corte.

## 7. Evidencia y pendientes

Verificado aquí: rama/HEAD/limpieza inicial, inventario de archivos y código, documentación oficial y tres lecturas MCP exitosas (lista y dos health). No hubo tests ejecutados, build ni validación visual porque el único entregable es este documento. Los comandos de lectura web por Jina y comprobación de actualización de agent-reach no pudieron completar por red; la documentación se recuperó con el navegador de investigación. No se instaló ni actualizó herramienta alguna.

Pendientes antes de la integración real: credencial propia en Syka, contrato de identidad/binding del adaptador, decisión concreta de primer destino, metadata del export elegido, validación del comportamiento remoto de uploads/retención y estados, y aislamiento de DAPI para QA. Ninguno impide empezar por dominio y borradores simulados cuando se continúe el desarrollo.
