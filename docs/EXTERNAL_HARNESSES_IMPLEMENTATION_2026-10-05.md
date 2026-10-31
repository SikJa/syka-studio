# Integraciones autenticadas y rutas de ejecutables

Fecha: 2026-10-05. Rama `syka/modelos-capacidades`, posterior a la captura `dd9f7862bc9aabeb1418f0e7d933a69ed07c1115`. Esta entrega continúa y corrige el informe inicial de capacidades.

## Resultado

Implementados un cliente ACP v1 y un adaptador del binario original de Claude Code, con descubrimiento, login explícito, texto, herramientas locales, permisos, cancelación y retoma. El selector muestra los modelos devueltos por cada agente y permite iniciar sus métodos de login compatibles. Codex sigue primero y conserva su ruta existente.

La implementación está en este worktree: **no se activó en el editor principal**. Los programas oficiales Antigravity y Claude respondieron a comprobaciones pasivas en perfiles vacíos y requieren login. Los turnos completos se probaron con procesos fixture; todavía no se verificaron cuota, inferencia real, captura/visión ni edición real mediante estos proveedores.

Commits de esta entrega: `e1c5b98` (host/adaptadores/tests) y `c2ef37c` (acciones de login del selector). El informe va en un commit de documentación separado. Integrar estos commits posteriores a la captura, no mergear la captura completa.

## Lista solicitada y disponibilidad

| Producto/ruta | Acceso e integración | Evidencia y pendiente |
|---|---|---|
| Gemini mediante Antigravity | Servidor ACP oficial de Google, autenticación anunciada por el agente; opciones personales/empresa compatibles en UI | Binario Windows 1.3.0 comprobado; estado `signed-out`. Falta login y turno real |
| Gemini 3.8 Flash | Aparece en el catálogo publicado de Antigravity | El selector usará el ID devuelto por la cuenta, sin inventarlo ni habilitarlo por documentación |
| Gemini 4 Argon | Anunciado por Google; acceso inicial limitado y expansión planificada | No se agrega un modelo ficticio al selector. Cuando aparezca en el catálogo ACP, se descubre sin codificar otro nombre; sus nuevas capacidades requieren validación |
| Claude Code | Binario original sin modificar, `auth login`; configuración propia de Syka | Versión 2.1.289 comprobada; estado `signed-out`. Se ofrece el modelo predeterminado del CLI, sin catálogo inventado. Falta login y turno real |
| Hermes | Adaptador ACP configurable y perfil `HERMES_HOME` propio | Código upstream investigado; sin instalación ni sesión real en esta entrega. Setup de terminal manual pendiente; la UI no simula un terminal |
| Cursor | Adaptador ACP configurable; upstream documenta `agent acp` | Sin binario/handshake local. El paquete Windows publica un `.cmd`: hay que resolver su ejecutable real o Node + entrypoint antes de configurarlo |
| Grok Bot, xAI | Producto solicitado incluido en la investigación | No tiene integración implementada aquí. **Grok Build** es otra ruta: el CLI de desarrollo publica ACP y tiene slot `grok`, etiquetado Grok Build; no sustituye Grok Bot |
| Muse AI / Muse Code | Login propio documentado para Muse Code; protocolo MSP y SDK públicos | Adaptador MSP nativo pendiente. Un slot ACP genérico admite un puente compatible explícitamente instalado; eso no acredita integración de Muse. El puente comunitario investigado no fue instalado |
| Ollama/local | Registro/parser de capacidades de la primera entrega | Sin transporte de inferencia ni loop de herramientas local nuevo |

“1299” queda fuera por aclaración del usuario. No se confundió xAI con Groq.

## Paths y perfiles

El host lee `harnesses.json` en el directorio padre de `runtimeDir`; por defecto, junto a `codex-runtime`. Sólo admite un array con `id`, `command` y `args`. No acepta campos de credenciales ni de perfil personal. Los perfiles se crean en `harness-profiles/<id>` junto al archivo.

- `command` debe ser absoluto, existir y resolver a un archivo mediante `realpath`.
- Se rechazan shims `.cmd`, `.bat` y `.ps1`; no se usa shell ni búsqueda alternativa en `PATH`.
- Para CLIs JavaScript: ejecutable Node absoluto y entrypoint `.js/.mjs/.cjs` absoluto y existente en `args`.
- Un archivo llamado `claude.exe` no alcanza: el probe exige identidad/version de Claude Code. ACP exige v1 e identidad del agente correspondiente.
- Un path malo deshabilita esa ruta con diagnóstico; no bloquea Codex ni cambia a otro proveedor.
- Configuración se carga al iniciar el host; tras cambiarla hay que reiniciar ese host. Refrescar el selector sólo repite los probes.

Configuración local preparada, ignorada por Git:

`F:\Coding Proyects\Syka Clips\worktrees\modelos-capacidades\.runtime\harnesses.json`

Ejecutables comprobados:

```text
F:\Coding Proyects\Syka Clips\worktrees\modelos-capacidades\.runtime\providers\antigravity\1.3.0\agy_acp_server.exe
F:\Coding Proyects\Syka Clips\worktrees\modelos-capacidades\.runtime\providers\claude\node_modules\@anthropic-ai\claude-code-win32-x64\claude.exe
```

Para usar esa configuración en una futura prueba aislada, `runtimeDir` debe ser el `codex-runtime` dentro de ese `.runtime`; los perfiles serán `.runtime/harness-profiles/antigravity` y `.runtime/harness-profiles/claude`. Los probes de esta entrega usaron otros perfiles vacíos `.runtime/profiles/*-check` para separar evidencia y login futuro.

**No distribuir esos paths personales ni copiar perfiles autenticados a otro checkout.** Los binarios descargados no están versionados ni incorporados al empaquetado del editor. Cada instalación debe configurar sus propios paths. La distribución/instalación automática es trabajo posterior.

Se detectó que `C:\Users\Sikora\.local\bin\claude.exe` respondía como **Bun 1.3.14**. No se modificó esa instalación: se preparó el binario oficial independiente indicado arriba.

## Autenticación y comportamiento

El probe no llama `authenticate`. El usuario inicia el login desde “Conectar” en el selector; el programa oficial abre su flujo. La app valida el método anunciado, impide otro login/turno simultáneo y vuelve a comprobar el estado después. Cerrar el host cancela el proceso de login. No se copian tokens personales ni se construye un OAuth propio.

Los procesos reciben homes, directorios de configuración y temporales propios. El entorno no hereda claves de proveedores ni overrides de endpoints. Claude usa `CLAUDE_CONFIG_DIR`; Hermes, `HERMES_HOME` y `HERMES_ACP_SKIP_CONFIGURED_MCP=1`. Esa variable evita MCP globales de Hermes, pero no demuestra aislamiento total de todos sus plugins/configuraciones; revisar el proveedor explícito y el perfil al instalarlo.

Los logins exitosos iniciados desde Syka cambian un identificador local sin secretos que invalida cursores del login anterior. No se cruza historial entre proveedores/perfiles ni se convierte una sesión histórica Claude en la del nuevo perfil. Cambios de cuenta hechos por fuera de Syka no están detectados por este identificador: usar perfil nuevo/chat nuevo al cambiarla externamente.

Las rutas de API siguen siendo opciones propias de los programas oficiales, pero la UI de esta entrega no administra claves. No se heredan claves para convertir silenciosamente un login en facturación API. La app no implementa fallback entre proveedores; un arnés multiproveedor como Hermes todavía puede tener reglas internas que deben fijarse explícitamente en su configuración.

## Herramientas y protocolo

- ACP: JSON-RPC por stdio, v1, catálogo vivo, selección de modelo, texto incremental, herramientas y permisos por sus IDs exactos. Retoma sólo si el agente declara `loadSession`. Sin soporte negociado de esfuerzo/fast, se rechazan esos controles.
- Cancelación ACP: petición nativa y terminación del árbol si no responde en tres segundos. Un transporte muerto se reabre desde su propio cursor al siguiente turno; si el proveedor no permite retomarlo, se informa sin reemplazar el historial.
- Claude: `--print --output-format stream-json --verbose`, `--strict-mcp-config`, `--permission-prompt-tool`, `--session-id/--resume`. Se transmiten mensajes completos del stream; no se promete delta de cada token. `AskUserQuestion` vuelve a la UI de preguntas y conserva respuestas múltiples.
- MCP: herramientas compartidas de workspace/source en servidor efímero local con URL aleatoria; el DAPI del editor se pasa como MCP aparte. Sólo se admite endpoint local. ACP recibe HTTP cuando lo anuncia; si no, un proxy stdio local compatible. No se abre otro DAPI 3275.
- Este bridge no incorpora automáticamente todas las herramientas especiales de Codex (por ejemplo su navegador). No se declara paridad completa de herramientas, visión ni generación multimedia. Las herramientas locales existentes conservan sus propios controles; el login no es un sandbox de seguridad.

## Fuentes y versiones

Fuentes primarias consultadas el 2026-10-05:

- [Transición de Gemini CLI a Antigravity](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/): corrige la recomendación inicial; acceso consumidor trasladado desde el 18 de junio. [Extensiones](https://antigravity.google/docs/ide/extensions), [autenticación ACP en Zed](https://antigravity.google/docs/ide/extensions/zed/) y [modelos](https://antigravity.google/docs/models).
- [Anuncio Gemini 4 Argon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/): anuncio no equivale a disponibilidad de esta cuenta.
- [Registro ACP oficial](https://github.com/agentclientprotocol/registry/tree/c1ff2a7d97b9690b1edbfc107bfbf856634ead3a): Antigravity 1.3.0, editor Google LLC. Archivo [Windows oficial](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.3.0-windows-x86_64.zip), SHA256 `65215E0688681FA3116E048A9EAB27EF53AF1BBD6F3DA3F1C52BD4911D8B17F9`; conserva `localharness_external.exe` junto al servidor.
- [Claude CLI](https://code.claude.com/docs/en/cli-reference), [uso del binario y autenticación](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview). Instalación aislada de `@anthropic-ai/claude-code@2.1.289`, scripts de instalación deshabilitados. No se usó el puente `claude-agent-acp`, basado en Agent SDK (`a44c486019e98ad478c549c4902e7092f1418d0b`).
- [Hermes ACP](https://github.com/NousResearch/hermes-agent/tree/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/acp_adapter): protocolo/setup y limitaciones descritas en el primer informe.
- [Cursor ACP](https://cursor.com/docs/cli/acp): `agent acp`, login `cursor_login`; registro inspeccionado anuncia versión `2026.10.01`.
- [Grok Bot](https://docs.x.ai/grok-bot/overview), [inicio](https://docs.x.ai/grok-bot/get-started), [Grok Build CLI](https://docs.x.ai/build/cli/reference). Registro ACP: `@xai-official/grok@1.0.49`, argumentos `agent stdio`; [repo fijado](https://github.com/xai-org/grok-build/tree/2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8).
- [Muse Code autenticación](https://dev.meta.ai/docs/muse-code/auth) y [SDK MSP](https://meta-models.github.io/muse-code-sdk/), repo `meta-models/muse-code-sdk@bb44be3d36de46d2411bd9eaa4aee99006092546`. La presencia de API keys puede tener prioridad sobre login; no inferir cuota desde una sesión. Puente comunitario investigado, no instalado: `BrokkAi/muse-acp@875d276d08a7966775bf84a0fda0a21a217207b1`.

## Validación y siguiente paso

- Suite `vitest run --root packages/agent-chat --maxWorkers=2`: **22 archivos, 197 tests pasan**. Una ejecución concurrente con compilaciones agotó el timeout de cinco segundos de dos tests existentes; la ejecución final limitada a dos workers pasó sin alterar esos tests ni sus timeouts.
- TypeScript `--noEmit` de `packages/agent-chat/tsconfig.json` y `apps/web/tsconfig.app.json`: pasan.
- `build:agent-host` del workspace desktop: pasa. No se hizo empaquetado/distribución ni prueba visual del selector en una segunda app.
- Tras los probes no quedaron procesos oficiales ejecutándose bajo `.runtime/providers` de este worktree.

La evidencia pasiva se guardó localmente en `.runtime/evidence/antigravity-passive.json` y `claude-passive.json`, sin tokens ni datos de cuenta. Los tests ejercitan procesos reales con proveedores simulados: selección, futuro modelo, versión incompatible, falso ejecutable, perfiles distintos, permisos/preguntas, retoma, cancelación forzada, MCP HTTP/stdio y lifecycle del login. No prueban aceptación remota de la cuenta.

Para cerrar validación de producto falta completar el login oficial en la app aislada, comprobar el modelo/acceso que anuncia esa cuenta y ejecutar texto → herramienta reversible → cancelación → retoma. Captura/visión requiere su propia prueba. No se arrancó otra app, se publicaron cambios ni se consumió inferencia paga en esta entrega.
