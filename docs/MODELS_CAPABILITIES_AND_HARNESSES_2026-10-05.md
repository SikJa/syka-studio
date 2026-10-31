# Modelos, autenticación y arneses — primera entrega

Fecha: 2026-10-05, Argentina. Rama `syka/modelos-capacidades`, base `dd9f7862bc9aabeb1418f0e7d933a69ed07c1115`.

> **Actualización posterior del mismo día:** este archivo describe la primera entrega. La implementación ejecutable, rutas y validación actuales están en [EXTERNAL_HARNESSES_IMPLEMENTATION_2026-10-05.md](EXTERNAL_HARNESSES_IMPLEMENTATION_2026-10-05.md). Se corrigió la recomendación inicial de Gemini CLI: Google trasladó el acceso consumidor Free/Pro/Ultra a **Antigravity**; no usar documentación legacy de Gemini CLI como evidencia de acceso actual a esas suscripciones. Ahora existen adaptadores ACP y Claude Code nativo en esta rama; sus turnos reales siguen pendientes de login y validación.

## Decisión y alcance

Priorizar **login oficial del usuario y su suscripción cuando la ruta lo permita**. La aclaración de Sikora en este chat convierte autenticación en criterio principal de selección. Una API key es una alternativa explícita con facturación propia; un token no acredita ni una suscripción ni permiso para reutilizarla en otro producto. Para modelos locales puede no hacer falta cuenta.

Se implementó un registro puro de capacidades por proveedor, arnés, modelo, endpoint, autenticación y cuenta opaca; traductores de metadata de Codex, ACP v1 y Ollama; y plantillas de rutas investigadas. No se agregó un nuevo arnés ejecutable ni se conectaron cuentas. Los nombres registrados no habilitan un selector funcional por sí solos.

Recomendación corregida: **Antigravity oficial mediante ACP y login propio Google**. [Google anunció la transición del acceso consumidor](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/); Gemini CLI conserva modalidades que deben verificarse por separado. Claude Code como proceso original es otra ruta viable bajo sus condiciones; no sustituirla por Agent SDK + tokens de suscripción. Hermes es una opción de arnés multiproveedor, con perfil independiente y proveedor fijado; no es requisito para usar Claude/Gemini.

## Matriz de acceso

“Declarado” significa documentación/código upstream; ningún proveedor nuevo tuvo un turno real en esta entrega. “Pendiente” no significa que instalar el CLI alcance: falta adaptador, configuración, negociación y prueba.

| Ruta | Autenticación preferida | Soporte declarado | Estado en Syka |
|---|---|---|---|
| Codex / app-server / modelo devuelto por model/list | Cuenta ChatGPT, flujo existente | Texto, herramientas, cancelación, retoma; esfuerzo/fast según metadata | Único arnés ejecutable existente; conservado. No se volvió a consumir cuota para probarlo |
| Claude Code / binario original | Login propio dentro del CLI; suscripción del usuario donde corresponda | Subproceso programático, herramientas y sesiones; sujeto a condiciones del binario | Adaptador pendiente. Sin extraer tokens ni ofrecer OAuth propio |
| Claude Agent SDK | API key propia o proveedor cloud admitido | Loop y herramientas del SDK | Pendiente. Login/cuotas Claude.ai de terceros sin autorización: no habilitado |
| Gemini CLI / ACP legacy | API/empresa según modalidad vigente; consumidor Free/Pro/Ultra trasladado a Antigravity | El código legacy declara ACP, pero no demuestra acceso actual por suscripción | No es la ruta implementada para consumidores; ver entrega Antigravity |
| Hermes / ACP / proveedor explícito | Depende del proveedor; setup oficial en perfil dedicado | ACP + resolución de proveedores, catálogo por credenciales configuradas | Investigación y traducción de metadata solamente. No hereda el Hermes personal |
| Ollama / modelo local / endpoint local | Sin cuenta para ejecución local | Metadata por modelo; herramientas y visión sólo en modelos que las anuncien | Parser de metadata; no transporte de inferencia ni loop de edición |
| Endpoint OpenAI-compatible | Credencial propia según servidor; local cuando corresponda | Compatibilidad parcial por implementación | Desconocido hasta acreditar endpoint/modelo. No equivale a capacidades de OpenAI |

No existe un catálogo universal confiable de “todas las funciones de Claude/Gemini/local”. Un nombre de modelo sin endpoint, autenticación y arnés pierde información esencial. Los modelos concretos se obtienen del inventario de la ruta; no se agregaron nombres comerciales estáticos como si estuvieran disponibles.

## Matriz funcional y evidencia

| Función | Codex actual | Claude CLI/SDK | Gemini ACP fijado | Hermes ACP fijado | Ollama/local |
|---|---|---|---|---|---|
| Texto/transcript existente | Implementado | Declarado | Texto del protocolo | Texto del protocolo | `completion` en metadata |
| Editar/capturar/render | Tools nativas Syka, bridge existente | Requiere conectar tools Syka | MCP HTTP anunciado; falta conexión Syka | Acepta MCP de sesión; revisar negociación HTTP | El modelo puede pedir tools; falta loop y bridge |
| Visión | No inferir de model/list | Acreditar modelo y transporte | Transporte image=true; comprobar modelo | Transporte image=true; comprobar proveedor/modelo | `vision` por modelo |
| Buscar web | Herramienta/ruta del arnés | Herramientas del arnés/SDK | Herramienta/ruta a verificar | Toolset y credenciales a verificar | No inferir del formato OpenAI |
| Generar imágenes | Flag y herramienta existentes; cuenta/cuota sin probar aquí | No inferir de visión | No inferir de bloques de imagen | No inferir de toolset vision | No inferir de vision |
| Audio / transcripción | Servicio aparte; no inferir de texto | Independientes de texto/visión | audio=true anuncia entrada, no calidad/transcripción contratada | No anuncia audio en initialize inspeccionado | No inferir de completion |
| Música / video | Herramienta independiente si configurada | No acreditado en esta investigación | No inferir de audio/image | No inferir de MCP | No inferir de compatibilidad API |
| Esfuerzo / fast | Metadata de cada modelo | Verificar controles exactos del CLI/modelo | Configuración del agente/modelo pendiente | Configuración del modelo/proveedor pendiente | `thinking` no equivale a esfuerzo de Syka |
| Cancelar / retomar | Código existente; cursor conservado | Contrato del adaptador pendiente | ACP cancel + loadSession declarado | ACP cancel + loadSession declarado | Abortar HTTP no acredita cancelación remota ni retoma |

Las herramientas del editor permanecen nativas. Un modelo de conversación y una herramienta de imágenes pueden tener rutas diferentes. La ausencia de generación de imágenes no debe bloquear composición de un fotograma con texto ni render nativo. Tampoco debe autorizar un servicio de imágenes automáticamente.

## Hermes: qué conviene reutilizar y qué no

Código inspeccionado en `NousResearch/hermes-agent@27c02f6326e82b2ba184f5a849f0c5b3a38efb9c`:

- [server.py](https://github.com/NousResearch/hermes-agent/blob/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/acp_adapter/server.py): initialize declara imagen, load/list/resume/fork; catálogo por proveedor/modelo. La aceptación de imágenes por el servidor no prueba visión del backend seleccionado. En la declaración inspeccionada no aparece `mcpCapabilities.http`, aunque el servidor contempla tipos MCP HTTP; no forzar soporte si la negociación no lo anuncia.
- [auth.py](https://github.com/NousResearch/hermes-agent/blob/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/acp_adapter/auth.py): siempre ofrece configuración por terminal y añade el proveedor cuando resuelve credenciales. El acuse de autenticación no demuestra un turno ni saldo.
- [entry.py](https://github.com/NousResearch/hermes-agent/blob/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/acp_adapter/entry.py) y [hermes_constants.py](https://github.com/NousResearch/hermes-agent/blob/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/hermes_constants.py): usan `HERMES_HOME` y pueden cargar entorno desde ese perfil. El código contempla defaults Windows; eso no certifica funcionamiento Windows del conjunto.
- [runtime_provider.py](https://github.com/NousResearch/hermes-agent/blob/27c02f6326e82b2ba184f5a849f0c5b3a38efb9c/hermes_cli/runtime_provider.py): resolutores OAuth específicos de Nous, Codex, xAI y Qwen, además de otros mecanismos; expiración y fuente de credencial forman parte de la resolución. En modo automático algunos errores permiten seguir al próximo proveedor. También hay una ruta opt-in app-server que delega la autenticación al login propio de Codex. La presencia técnica de un resolutor no verifica autorización contractual de cada proveedor.

Plan de aislamiento antes de un proceso real: perfil exclusivo de Syka, proveedor/endpoint/modelo explícitos, sin copiar memoria/skills/secretos globales; auditar entorno heredado y rutas de carga. `HERMES_ACP_SKIP_CONFIGURED_MCP=1` evita descubrimiento MCP global, pero no aísla por sí solo memoria, plugins, permisos o credenciales. Pasar sólo los MCP de la sesión. No se cambió ninguna restricción de terminal ni permiso del usuario.

No adoptar de Hermes el fallback automático para este producto. Un error de autenticación debe conservar identidad y mostrar reconexión, sin cambiar a una cuenta API facturable. ACP resuelve transporte y lifecycle; el ownership de estado, herramientas, permisos y facturación sigue siendo responsabilidad del host/arnés.

## Fuentes primarias y refs

Consultadas el 2026-10-05. Las páginas vivas pueden cambiar; las referencias de código fijan exactamente lo inspeccionado.

1. [Claude Code: legal/compliance](https://code.claude.com/docs/en/legal-and-compliance): distingue ejecución del binario publicado sin modificar, con métodos de autenticación intactos y credencial del usuario, de intermediar credenciales/uso. El login de suscripción debe completarse en el flujo de Anthropic. Esto exige revisar términos aplicables para distribución; no es una autorización general para un proxy OAuth.
2. [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview): describe herramientas, sesiones y ejecución del CLI como subproceso; exige API para login/cuotas ofrecidos por terceros salvo autorización. SDK y binario original son rutas distintas.
3. [Gemini ACP](https://geminicli.com/docs/cli/acp-mode/) y [autenticación](https://geminicli.com/docs/get-started/authentication/). Código: [acpRpcDispatcher.ts](https://github.com/google-gemini/gemini-cli/blob/fb972b2f87fe7d5b06d37eac711490162d98de2c/packages/cli/src/acp/acpRpcDispatcher.ts) y [authentication.mdx](https://github.com/google-gemini/gemini-cli/blob/fb972b2f87fe7d5b06d37eac711490162d98de2c/docs/get-started/authentication.mdx). El dispatcher muestra Google/API/Vertex/gateway, anuncia HTTP e imágenes/audio y puede borrar la credencial cacheada al cambiar método: no llamar authenticate para “probar” sin intención de cambiar/configurar login. El documento ACP tiene referencias de arquitectura que no coinciden completamente con el árbol actual; el handshake real manda, MCP de sesión se negocia según el protocolo.
4. [ACP v1 initialization](https://agentclientprotocol.com/protocol/v1/initialization): versión acordada, capacidades opcionales omitidas equivalen a no soportadas; sesión cancelable básica. Ref upstream resuelta `cae7aca7f07cefd59da2a3cb374933cb623a2959`; el parser implementado sólo acepta v1, no presupone compatibilidad v2.
5. [Hermes ACP](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp/) y archivos fijados arriba.
6. [Ollama compatibilidad OpenAI](https://docs.ollama.com/api/openai-compatibility), [tools](https://docs.ollama.com/capabilities/tool-calling), [visión](https://docs.ollama.com/capabilities/vision). [api/types.go](https://github.com/ollama/ollama/blob/42e911bc3d05798cad729cb474bf62f378cb2e26/api/types.go) define `ShowResponse.capabilities`, `remote_model`, `remote_host`. Una ruta local no debe aceptar silenciosamente metadata de un modelo cloud. Responses compatible no implica retoma stateful, web integrada o generación de imágenes.

## Contrato implementado

- `src/capabilities.ts`: identidades exactas, cuatro estados con motivo/evidencia, observaciones con vencimiento y cuenta opaca, registro sin fallback; selección separada de modelo editor e imágenes/transcripción/música. `EditorToolState` mantiene edición/captura/render fuera de capacidades del modelo.
- `src/capability-observations.ts`: parsers puros de respuestas ACP/Ollama, rechazo de versión desconocida/metadata inválida/cloud para ruta local; intersección de soporte de transporte y modelo. No realiza requests, no arranca procesos ni lee archivos.
- `src/capability-routes.ts`: plantillas investigadas siempre pendientes; distinción CLI/SDK; puente del `HarnessInfo` Codex existente a rutas y observaciones de 60 segundos. No vuelve a lanzar el probe ni accede a credenciales. No otorga visión o imágenes desde model/list.
- `src/index.ts`: exporta estos contratos. No cambió HarnessId, ModelRef, ResumeCursor, persistencia ni el host ejecutable.
- `test/capabilities.test.ts`: pruebas simuladas y casos de regresión del contrato.

`available` significa configuración vigente más soporte acreditado, **no turno real ni garantía de cuota**. `validation` conserva declarado/fixture/probe/turno real. Los fixtures nunca habilitan disponibilidad por sí solos. El host debe producir las observaciones; no aceptar prose del modelo ni entradas del renderer como prueba. `endpoint` es identificador público, `accountSlot` un ID opaco; no guardar URLs con secretos, emails, headers o tokens en este contrato.

La caducidad y cambio de cuenta/modelo/endpoint invalidan observaciones. Desconocido conserva incertidumbre. El catálogo de investigación no ejecuta los proveedores: `adapter: pending` explica trabajo faltante. La selección de servicio de imagen es exacta y explícita; no hay búsqueda de proveedor alternativo.

## Integración posterior, acotada

1. Consumir `codexCapabilityRoutes` sobre el resultado existente de probe y asignar una identidad opaca que cambie al cambiar cuenta; invalidar también al cerrar sesión. No inventar identidad a partir de un email ni reutilizar indefinidamente un slot.
2. Mostrar estado/motivo y nivel de evidencia en diagnóstico; no usar plantillas pendientes como opciones ejecutables. UI y host deben validar la misma ruta.
3. Implementar cliente ACP para Gemini con versión fijada, stdio, timeouts, cancelación, permisos/preguntas y teardown. Login oficial iniciado por la persona, caché/perfil definido explícitamente; no una copia de tokens. Registrar metadata de inicialización y del modelo seleccionado por separado.
4. Adaptar editor MCP HTTP y herramientas de workspace/source compartidas. Hoy parte está acoplada a Codex: falta extraerlas con sus tests sin modificar comportamiento existente. ACP initialize por sí solo no entrega un editor funcional.
5. Añadir cursor nuevo con versión para ACP y pruebas de retoma tras reinicio; conservar lectura de chats Codex/Claude históricos. Nada de migrar el cursor Codex hacia Gemini/Hermes.
6. Sólo después: prueba real elegida por el usuario de login → texto → captura/visión → edición reversible → cancelación → retoma; comprobar error de cuota sin fallback. Para UI/procesos aislar perfil, build, web **y DAPI/MCP 3275**; esta entrega no arrancó una segunda app.

Main/preload/router, package.json/lockfile, selector y lanzamiento permanecen sin cambios. El contenido derivado puede importar los contratos; deberá obtener observaciones reales antes de habilitar generación. Composición nativa de portada permanece independiente.

## Validación y límites

- Dependencias propias del worktree desde lockfile, `npm ci --ignore-scripts`; no enlaces al principal ni scripts de instalación. Npm global tenía un shim roto: se usó el npm incluido con Node. La red del sandbox requirió ejecución ampliada para descargar dependencias y leer GitHub público.
- `node node_modules/typescript/bin/tsc --noEmit -p packages/agent-chat/tsconfig.json`: **pasa**.
- `node node_modules/vitest/vitest.mjs run --root packages/agent-chat`: **21 archivos, 180 tests pasan**. Incluye toda la suite existente y tests nuevos. Las respuestas de capacidades son fixtures: ningún modelo fue llamado por estos tests.
- Casos nuevos: identidad en seis dimensiones; vencimiento/fecha inválida/futuro; sesión ausente; auth no soportada/desconocida; registro duplicado; aislamiento de definiciones; ausencia de fallback; servicio de imagen independiente; ACP omitido/desconocido; transporte vs visión real; Ollama local/cloud; SDK vs CLI; esfuerzo/fast por metadata Codex.
- No hubo login, lectura de auth.json/.env/tokens, inferencia paga, generación, publicación, prueba visual ni activación en producción. No se verificó compatibilidad completa Windows de los arneses nuevos. No hay nuevo adaptador de turnos funcionando todavía.
- Commit de implementación: `643bb71` (`feat(agent-chat): add evidence-based model capability registry`). Integrar sólo commits posteriores a la captura, no la captura completa. Este informe se conserva en un commit separado de documentación.
