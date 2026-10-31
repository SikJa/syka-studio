# Persistencia conversacional y Graphify — 2026-10-05

Entrega local en `syka/memoria-onboarding`, posterior a base `d92978e`. No integrada ni activada en la aplicación principal. Ninguna instancia de Electron, cuenta, publicación, transcripción o generación pagada iniciada.

## Implementación comprobada

`8019ae7`: adaptador `packages/agent-chat/src/host/onboarding-memory.ts`, reutiliza ProjectPreferences y BrandKitStore, revisiones y escritura atómica. Lee defaults del host y snapshots portables del proyecto, conserva accepted/proposed/skipped/unknown, guarda respuestas y correcciones explícitas, rechaza fuentes documentales como aprobación y credenciales reconocibles. Nunca guarda transcript, secretos deliberadamente ni razonamiento. Valida proyecto y evita enlaces en rutas de memoria. Las decisiones explícitas sobre kit prevalecen sobre snapshot/default; un kit eliminado produce error recuperable.

`8fb4c93`: hooks compartidos separados: WorkspaceTools expone `syka_onboarding_memory`, editorial-instructions agrega la política común y agent-chat pasa SYKA_ONBOARDING_DIR desde userData/brand-kits al utility process. No se modificó codex.ts, protocolo ni harness. El principal debe integrar estos tres puntos con Modelos. La política es común, no una variante por proveedor. Lectura por turno mediante herramienta; el arnés debe exponer WorkspaceTools. No se afirma extracción automática infalible de lenguaje natural: el agente registra una respuesta explícita mediante la herramienta.

El tool requiere `relevant` (lista vacía para ediciones mecánicas), devuelve sólo la próxima pregunta pertinente y contexto aprobado, junto a estados resueltos. Propuestas no pasan a accepted. Referencias/kit son datos citados, no instrucciones privilegiadas ni autorización externa. Asignar y administrar kits continúa en Configuración existente.

## Verificación local

15/15 tests pasan: 9 originales de Onboarding y 6 del adaptador. Incluyen escritura y reapertura reales en temp, nuevo WorkspaceTools consumiendo memoria, cambio de proyecto, revisiones obsoletas, omitir/no sé, corrección, propuesta/documento/credencial, snapshots y recuperación de archivo corrupto. Además 12 comprobaciones directas de disco pasaron. TypeScript estricto del adaptador y dependencias locales pasa; bundle esbuild pasa. No se ejecutó una conversación con proveedor real ni QA visual de Electron; no se declara despliegue.

QA propio: `.runtime/qa`, vitest 4.0.0 con Vite 7.1.12. El primer intento con Vite 7.3.6 fallaba antes de ejecutar tests (getBuiltins); versión compatible fijada y ejecución posterior verde. `node_modules/vitest` apunta únicamente al runtime QA de este mismo worktree.

Comando: `node .runtime/qa/node_modules/vitest/vitest.mjs run --config .runtime/qa/vitest.config.mjs`.

## Graphify real

Fuente oficial verificada con agent-reach/GitHub CLI: https://github.com/Graphify-Labs/graphify ; release v0.9.76 publicada 2026-10-04; metadata PyPI https://pypi.org/project/graphifyy/0.9.76/ coincide. Licencia declarada Apache-2.0. CLI real `graphify 0.9.76`. Python 3.12.13 propio y paquete en `.runtime/graphify`; uv cache y Python también dentro de `.runtime`. No se modificó Hermes, PATH ni perfiles globales.

Se revisó skill-installer; el upstream distribuye skill-codex.md y sidecars, no un directorio instalable con SKILL.md, por lo que se utilizó el registrador oficial `graphify install --project --platform codex`. Skill en `.codex/skills/graphify/SKILL.md`, disponible para siguientes turnos. No había AGENTS local previo: se dejó uno acotado al corpus. Se retiró el hook no-op generado por el instalador; no quedan hooks, strict, watchers ni cloud.

Grafo inicial: `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`; 461 nodos, 1113 aristas, 13 comunidades. Sólo 36 fuentes públicas únicas permitidas; la primera actualización contó una entrada duplicada del adaptador en la lista, sin duplicar el archivo. Se usó staging de código y `extract --code-only --no-cluster`, luego `cluster-only --no-label`. Sin semántica/API/backend pagado.

Consultas reales guardadas en `graphify-out/verified-queries.json`: ProjectPreferences/onboardingMemory, BrandKitStore, startAgentChat/WorkspaceTools, GroqSettings y publicationStatus. Publicación sólo tiene contrato de estado en esta captura; falta refrescar al integrar Zernio. Aristas inferidas no son preferencias aprobadas. HTML generado, no inspeccionado visualmente.

`graphify-out/routes-manifest.json` registra rutas, fuente oficial, fecha UTC, revisión, runtime, exclusiones y comandos. `source-manifest.json` registra hashes. Actualización manual: `powershell -File scripts/refresh-graphify.ps1`, seguida de `.runtime/graphify/Scripts/python.exe scripts/graphify-manifest.py`. Ejecutar desde la raíz del worktree. El principal unido NECESITA refresco: este grafo no representa ramas aún no integradas.

## Límites

No hay entrenamiento de pesos, almacenamiento global de memoria ni store nuevo. La atribución source:user depende de que el agente respete el contrato, no autentica criptográficamente una aprobación. La persistencia usa la cola del host y revisiones existentes; no se promete arbitraje entre dos procesos de host concurrentes. La memoria dañada falla sin borrarse. Las preferencias se incorporan cuando el agente llama a la herramienta, no por el documento de rutas ni por Graphify.
