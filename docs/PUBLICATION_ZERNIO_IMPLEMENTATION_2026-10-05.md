# Publicación con Zernio — implementación local y evidencia

Fecha: 05/10/2026, America/Buenos_Aires. Implementado en el worktree `worktrees/publicacion-zernio`, rama `syka/publicacion-zernio`, sobre `ee55302acec47dd282c6446e72efb7369d080dcf`. No se integró en el checkout principal ni se creó un instalador. El [inventario anterior](PUBLICATION_ZERNIO_INVENTORY_2026-10-04.md) conserva la auditoría inicial.

## Resultado visible

Configuración → Zernio ofrece inicio de sesión y API key. Cada conexión tiene su nombre, identidad verificada, cuentas sociales, estado y última verificación. Guardar una clave sólo la cifra localmente; **Verificar** lee identidad, cuentas y health. La autorización OAuth abre el navegador únicamente al tocar **Conectar con Zernio**. Quitar una conexión elimina su credencial local y conserva borradores e historial; la revocación del permiso remoto se gestiona desde Zernio.

Publicaciones permite seleccionar un video exportado, guardar texto y destino localmente, elegir enviar ahora o programar, revisar la operación y confirmar. Los destinos implementados son YouTube e Instagram Reels, uno por borrador. Se pueden mantener varias conexiones y varios borradores para distintos destinos. No selecciona la primera cuenta automáticamente.

Usa los componentes existentes del dashboard, sus superficies, tipografía, colores, tamaños, campos, botones y modales. La transición de panel proviene de `transitions-dev`, con desplazamiento de 12 px y desactivación por `prefers-reduced-motion`. No modifica timeline, motor de render, chat, bibliotecas ni proyectos existentes. BridgeClip se abrió como referencia en su perfil separado; no se cambió su código ni se portó su UI React. Su licencia MIT y copyright BridgeMind LLC siguen en la referencia original.

## Conexión y API

- `oauth.ts` usa el SDK MCP que el proyecto ya tenía para discovery, registro dinámico, PKCE y callback aleatorio en `127.0.0.1`. State, código y verifier permanecen en Electron main. Sólo acepta destinos OAuth oficiales, rechaza redirects de red y limita el login a diez minutos.
- Scopes solicitados: `accounts:read posts:read posts:write`. Tokens, client registration y refresh token se cifran con Electron `safeStorage`; la renovación conserva o rota el refresh token sin abrir otro navegador silenciosamente.
- `client.ts` mantiene un adaptador REST en main para ambos métodos, con Bearer, timeouts, respuestas acotadas, errores saneados y espera por `Retry-After`. `GET /auth/verify` establece la identidad; si cambia, exige una conexión nueva.
- No se extrae la credencial del conector de Codex ni se agrega automáticamente Zernio al agente embebido. El login pertenece a esta aplicación y su perfil.

La [configuración oficial MCP](https://docs.zernio.com/mcp/setup) documenta OAuth 2.1, PKCE, registro abierto y API key. La compatibilidad del token con REST se contrastó con `/v1/auth/verify` en el [OpenAPI oficial](https://docs.zernio.com/api/openapi) y con el [handler del SDK oficial](https://github.com/zernio-dev/zernio-python/blob/main/src/late/mcp/routes.py), que reconoce ambos tipos de Bearer y pasa la credencial al cliente REST. Esto documenta el contrato; la aceptación del login de Syka con una cuenta real sigue pendiente.

## Varias conexiones y free tier

Cada conexión recibe un UUID nuevo y conserva sus propios secretos, identidad y destinos. Cambiar de conexión en un borrador exige elegir nuevamente la cuenta social. Una cuenta social con permiso desconocido o negativo no queda habilitada para enviar. Se admiten hasta 50 conexiones y 500 borradores en el almacén local: son límites de Syka.

Según los [precios oficiales consultados](https://docs.zernio.com/pricing), las primeras dos cuentas sociales del equipo son gratuitas, incluyendo propietario y miembros; los perfiles no multiplican ese cupo. Varias conexiones de clientes o identidades se pueden organizar aquí, pero la UI no promete un cupo acumulado ni calcula saldo. No incluye creación o rotación automática de cuentas para evitar límites. Los [términos actuales](https://zernio.com/tos), sección 3, prohíben eludirlos. Los límites y la facturación se consultan por cada cuenta en Zernio.

## Persistencia y envío

`userData/providers/zernio/state.json` guarda conexiones sin secretos, borradores e historial; cada credencial tiene su archivo cifrado independiente. Un escritor serializado aplica revisiones, sincroniza el temporal a disco y reemplaza el JSON atómicamente. Un archivo corrupto se conserva y reporta. No existe fallback de credenciales en texto plano.

El selector nativo entrega el archivo a main. Allí se comprueban tamaño, extensión, hash SHA-256, duración, dimensiones y codec mediante Mediabunny. Guardar un borrador no sube bytes ni crea un post. En el envío se comprueban nuevamente revisión, identidad, health y hash. El PUT transmite un stream con Content-Length y MIME; el Bearer de Zernio nunca va al storage. Se restringen hosts, DNS público y redirects, y se permite cancelar mientras sube. La pantalla muestra la fase; no ofrece porcentaje de bytes.

Se guarda el payload exacto y `Idempotency-Key` **antes** del POST. La respuesta perdida, un 5xx o un 409 ambiguo conservan la operación para un reintento explícito con la misma clave. No se reenvía automáticamente al reiniciar. Tras 24 horas se bloquea el replay y se pide comprobar el resultado en Zernio. Un 400 definitivo permite corregir el borrador. HTTP 207 conserva los errores por destino; no se interpreta como publicación exitosa por ser 2xx. Un post confirmado no se vuelve a crear desde ese borrador.

La programación persiste UTC y zona IANA del equipo. El formulario bloquea fechas vacías, y main exige al menos cinco minutos de margen antes y después del upload: es política local de Syka. El modal muestra la hora en la zona almacenada. Los uploads temporales duran siete días; referenciarlos en un post conserva el medio permanentemente, por lo que no se heredó el tope de 6½ días de BridgeClip. Ver [uploads](https://docs.zernio.com/guides/media-uploads) e [idempotencia](https://docs.zernio.com/guides/idempotency).

YouTube tiene título, descripción, visibilidad, madeForKids y declaración de contenido sintético; comienza en Privado. Para programar una salida pública hay que elegir Público. El comportamiento de subida anticipada y liberación pertenece a [YouTube/Zernio](https://docs.zernio.com/platforms/youtube). Reels valida MP4/MOV, H.264, 9:16, 3–90 s, 300 MB y caption de 2.200 caracteres según la [guía actual de Instagram](https://docs.zernio.com/platforms/instagram). Un video crea un Reel sin `contentType: reel`; el payload usa `shareToFeed: true`.

El estado remoto se actualiza manualmente o con polling del post seleccionado mientras la vista está abierta. La consulta automática aumenta la espera tras errores hasta cinco minutos, pausa offline y no genera toasts repetidos. La programación confirmada corre en el proveedor; no exige que Electron permanezca abierto. No hay webhooks, cancelación/reprogramación remota, multipost en una sola operación ni nuevas plataformas en este corte.

## Verificación

| Comprobación | Evidencia / alcance |
|---|---|
| Tipos desktop y web | `tsc --noEmit` y build web pasan. |
| Build escritorio | Main, preload, agent-host y native terminan con salida 0; main se reconstruyó tras los ajustes finales. |
| Build web | Vite termina con salida 0. Emitió advertencias de `use client` en Mirel/framer-motion y de chunks grandes. |
| Tests desktop | 32 suites; 190 tests, incluyendo 22 de publicación. Todos con fixtures locales; no prueban publicaciones reales. |
| OAuth | Fixture de discovery/DCR, callback HTTP real en loopback, rechazo de state incorrecto, PKCE, cifrado y rotación/deduplicación del refresh. No hubo consentimiento real. |
| UI configuración | Guardar clave ficticia, limpiar input, quitar conexión, navegar las dos opciones, y movimiento reducido sin errores JS. |
| Electron + borrador | Selector nativo simulado entrega un MP4 sintético a los handlers reales. Main lee 360×640, cuatro segundos y H.264; guarda texto/horario, bloquea fecha vacía y conserva todo tras cerrar y arrancar Electron. `safeStorage` real cifra la clave ficticia. La conexión de prueba se elimina al terminar. |
| Red de QA | Cero llamadas a Zernio en la prueba nativa; el harness las bloquea. No se subió, publicó ni programó contenido real. |

Evidencia local ignorada por Git: `.runtime/publication/qa/ui-verification.json`, `offline-verification.json`, `settings-oauth.png`, `settings-key-local.png`, `draft-offline.png` y `draft-after-restart.png`. Las claves de prueba son ficticias y no son defaults del producto.

## Ejecutar y revisar

Desde este worktree:

```powershell
node scripts/dev-publication.mjs
```

Usa runtime/perfil/proyectos propios bajo `.runtime/publication`, web **5298** y MCP local **3298**. El hook `SYKA_MCP_PORT` conserva el valor normal 3275 cuando no se configura. El editor principal siguió en 5188/3275 con sus mismos procesos durante la QA. No se usó su launcher ni su perfil.

Para repetir la verificación, `scripts/qa-publication-ui.mjs` requiere arrancar esta instancia con `SYKA_QA_CDP_PORT=9338`. `scripts/qa-publication-offline.mjs` arranca y cierra su propio perfil temporal con MCP 3300 y usa Vite 5298. Ambos usan Playwright desde `SYKA_PLAYWRIGHT_PATH` o una instalación local de ese paquete. El segundo necesita un fixture sintético previo:

```powershell
ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=0x181818:s=360x640:r=15:d=4" -f lavfi -i "sine=frequency=440:duration=4" -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart -y .runtime/publication/qa/syka-publication-fixture.mp4
node scripts/qa-publication-offline.mjs
```

El código nuevo vive en `apps/desktop/src/publication/` y `apps/web/src/components/publication/`. Los hooks compartidos son pequeños: canal IPC, registro main, navegación/settings y puerto de QA. Dependencias agregadas al workspace desktop: Mediabunny (misma versión resuelta que la existente para evitar módulos duplicados) y Undici para streaming/DNS del storage.

Pendiente de validación real: iniciar sesión o configurar una clave propia en **Configuración → Zernio**, verificar cuentas, elegir archivo/destino/texto/visibilidad y confirmar una operación concreta desde Publicaciones. Hasta entonces el estado es **implementación y QA local**, sin despliegue ni publicación real.
