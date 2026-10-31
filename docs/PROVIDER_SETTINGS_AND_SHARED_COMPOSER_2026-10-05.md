# Agentes, configuración y composer compartido

Implementación del pedido y las tres capturas de Sikora, 2026-10-05. Rama `syka/modelos-capacidades`; continúa los adaptadores de `e1c5b98` y las acciones de login de `c2ef37c`.

## Qué estaba incompleto

La pantalla “MCP & CLI” sólo escribía conexiones MCP para agentes externos; no administraba los proveedores del chat. Inicio todavía montaba un textarea y selector diferentes, mientras el editor usaba el composer de Mirel. El menú del editor era absoluto dentro de un panel con `overflow:hidden`, y todos los modelos recibían el mismo logo Codex.

## Cambios

- “Agentes y modelos” lista Codex, Gemini/Antigravity, Claude, Hermes, Cursor, Grok Build y Muse Code, con estado real del host y explicación de las rutas pendientes. Se muestra tanto en la sección de agentes como en Configuración general, mediante un componente compartido.
- Los proveedores externos permiten guardar ejecutable absoluto y argumentos por línea. El host valida el archivo, persiste de forma atómica sin perder otros proveedores y recarga la ruta sin reiniciar la app. Un error conserva la configuración anterior; un archivo de configuración inválido no se sobrescribe. Cambios simultáneos/login/turnos tienen guardas.
- Login explícito con los métodos anunciados por cada adaptador. Configurar una ruta no inicia sesión ni ejecuta inferencia. Codex conserva su conexión existente.
- Inicio monta el mismo `Composer` que el chat: adjuntos, dictado, selección de modelo, esfuerzo y modo rápido según las capacidades anunciadas. La elección se comparte y persiste; cambiar de modelo descarta opciones incompatibles.
- Para adjuntos pegados en Inicio sin proyecto, el destino se resuelve antes de escribirlos; no se forma una ruta desde un directorio vacío.
- Menú en portal fuera del panel, posicionado según espacio disponible, con catálogo desplazable y controles separados. Soporta flechas, Home/End y Escape. Se puede acceder a configuración incluso sin un proveedor listo.
- Logos locales por proveedor: Codex azul, Gemini, Claude Code, Cursor, Grok y Meta para Muse Code. Hermes usa una inicial explícita hasta incorporar un logo verificado. No se inventó una marca ni se carga SVG remoto del agente. Gemini/Grok/Meta se copiaron del catálogo ya incluido en `docs/resources/logos`; conservar su procedencia/licencias.
- Los botones de Enviar/modo rápido permanecen visibles mientras carga la decoración GPU, también en Inicio y en el portal.

Las herramientas MCP para aplicaciones externas se conservan en una sección distinta. Un switch MCP no acredita login ni cuota del chat. Grok Build no se presenta como Grok Bot, y Muse no se presenta como integración MSP terminada.

## Verificación

- **199 tests, 22 archivos** de agent-chat pasan (`--maxWorkers=2`), incluyendo persistencia de rutas, configuración inválida, preservación de proveedores y exclusión de cambios/turnos simultáneos.
- TypeScript de agent-chat y de la app web pasa; bundle del host y build completo web compilan. Vite conserva avisos de `use client` en dependencias y tamaño de chunks; no impiden la compilación.
- Prueba visual en navegador con los componentes reales y un host de cuentas/modelos simulados, separado de la app principal y de DAPI 3275.
- Validado: selector completo dentro del viewport angosto, scroll hasta los proveedores inferiores, primer/último modelo mediante teclado, cambio de esfuerzo, toggle de modo rápido, elección de modelo en Configuración reflejada en Inicio, ruta relativa rechazada, ruta absoluta guardada y conservada al reabrir, login simulado y actualización del catálogo. Los controles de Enviar y modo rápido están visibles en Inicio.
- Evidencia local: `output/playwright/providers/chat-narrow.png`, `home-composer.png`, `settings.png`. Las capturas **no acreditan cuentas reales conectadas**.

## Repetir la preview

`apps/web/qa/providers.html` monta el `DashboardHomeView` real, el composer del chat en un panel con clipping y `ProviderSettings`. `apps/web/qa/provider-host.ts` ofrece un host local de fixtures: el login sólo cambia un estado simulado y los turnos se rechazan. No usarlo como backend de producto.

Desde la raíz de este worktree, compilar `apps/web/qa/provider-host.ts` con esbuild para Node ESM (banner `createRequire`, igual al build del host) a `.runtime/providers-qa-host.mjs`; ejecutarlo y leer su endpoint desde `.runtime/providers-ui-qa/endpoint.json` sin imprimir el token. Iniciar Vite propio en `127.0.0.1:5197`, dentro de `apps/web`, pasando ese endpoint como `VITE_AGENT_CHAT_URL`. Abrir `/qa/providers.html`. Perfil/config/datos de QA quedan en `.runtime/providers-ui-qa`; no usa las cuentas del usuario.

## Integración

Commits de esta entrega:

- `eb451f4`: persistencia y recarga de rutas en el host.
- `8022dec`: configuración compartida, logos, selector sin recorte y QA reproducible.
- `0716b67`: integración del panel de proveedores y composer compartido en las pantallas.

Cambios de backend, UI y documentación se entregan separados después de la captura `dd9f786`. No integrar la captura completa. Los hooks compartidos se limitan a `home-view.tsx`, `mcp-view.tsx`, `syka-agent-settings.tsx` y el nombre de la sección en `pages/dashboard.tsx`; conservar cualquier trabajo posterior del frente de onboarding al aplicar esos cambios.

El principal `diffusion-studio` y la app abierta no se modificaron en esta entrega, de acuerdo con la separación de worktrees. Para verla allí falta integrar estos commits junto con los adaptadores anteriores y configurar los ejecutables en su perfil. El nuevo formulario elimina la necesidad de editar `harnesses.json` a mano. Login y turnos reales continúan pendientes del usuario y de una prueba de proveedor; no hubo consumo de inferencia ni publicación.
