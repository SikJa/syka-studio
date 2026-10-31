# Mapa de código persistente de Syka

Implementación local del 7 de octubre de 2026. El agente consulta Graphify desde
sus herramientas; el host mantiene el índice mientras Syka está abierto y
reconcilia los cambios al volver a iniciar. Es un mapa de código público de la
aplicación, separado de la memoria editorial y de los proyectos de video. No
entrena modelos ni usa extracción semántica, APIs de pago o servicios cloud.

## Uso desde el agente

La herramienta `syka_code_graph` está en `WORKSPACE_TOOLS`:

```json
{"action":"query","query":"EditorExportButton"}
{"action":"relations","nodeId":"apps_web_src_components_sidebar_left_editor_export_button_editorexportbutton","limit":8}
{"action":"status"}
{"action":"search","query":"exportScene","path":"apps/web/src/components/sidebar-left/","limit":8}
```

Cada respuesta incluye generación, fecha, hashes verificados contra los archivos
actuales, cambios pendientes, estado del worker, errores y cobertura. `current`
significa que **los archivos permitidos** coinciden con esa generación al hacer
la consulta. No significa que todo el repositorio esté indexado ni que una
relación AST pruebe comportamiento en ejecución. Las aristas conservan dirección,
ubicación y confianza; referencias sin extremos resueltos se omiten y se informa
su número en el diagnóstico de la última actualización.

Las instrucciones del host indican consultar el grafo primero para localizar
código de Syka sólo en los harnesses que conectan esas herramientas: Codex nativo
y el puente MCP de Claude/ACP. El indicador describe conexión de transporte,
no evidencia de que cada proveedor/modelo ya fue probado. La búsqueda directa
usa texto literal y el mismo alcance público;
no escanea proyectos, credenciales o conversaciones para compensar una ausencia.
Si no hay cobertura, el agente debe indicarlo. Consultas: hasta 20 resultados,
160 caracteres y dos saltos. La herramienta es de lectura: no permite ampliar el
alcance ni modificar código.

## Persistencia y mantenimiento

- `scripts/graphify-scope.json`: lista migrada del selector anterior; mantiene
  directorios, patrones y archivos explícitos. Se agregaron los scripts de esta
  integración. Altas dentro de directorios/patrones permitidos entran solas;
  renombrar fuera del alcance retira el archivo del índice.
- Worker Python local: revisión de metadatos cada 500 ms, hashes completos cada
  15 s y al iniciar; debounce de 1 s, espera máxima de 5 s, reintentos con backoff.
  Las consultas verifican hashes independientemente del último sondeo.
- Sólo se extraen archivos cambiados y sus dependientes inversos/importadores.
  El clustering opera sobre el grafo combinado. Un cambio de alcance o versión
  del extractor permite una reconstrucción completa. No se reanaliza todo en
  cada guardado.
- La versión del pipeline también invalida generaciones antiguas al iniciar;
  las recuperaciones parciales de sintaxis que puedan perder símbolos conservan
  el último grafo íntegro y reintentan cuando el archivo vuelve a ser válido.
- Un bloqueo del sistema operativo serializa actualización manual y automática.
  Dentro del host se comparte el servicio; otras instancias leen el mismo índice
  y toman el relevo si su propietario termina. No se arranca Python por consulta.
- `graphify-out/code-index.json` es el bundle autoritativo: `graphJson`, checksum,
  manifiesto de hashes y generación se publican juntos mediante reemplazo
  atómico. `code-index.previous.json` conserva la versión anterior íntegra.
  Ante fallo de extracción, escritura o cambio durante el análisis se conserva
  el último índice. El proceso se recupera de un lock abandonado tras un cierre.
- El staging contiene sólo fuentes permitidas y configuración sintética de
  resolución; evita buscar workspaces/configuraciones en carpetas superiores.
  No sigue symlinks/junctions. Excluye nombres sensibles, binarios y medios.
- `graph.json` y `source-manifest.json` son copias de compatibilidad. El HTML y
  reporte antiguos siguen siendo snapshots históricos. La vigencia está en la
  herramienta, no en la fecha de apertura del HTML. `graphify-manifest.py` genera
  un inventario opcional vinculado a la generación, sin reextraer código.

El arranque normal de desarrollo pasa explícitamente la raíz del repositorio al
host. La integración está lista para el próximo inicio normal de Syka; la
instancia principal que ya estaba abierta no se reinició durante este trabajo.
Para un host CLI se acepta `--code-graph-root`; una distribución empaquetada
necesita `SYKA_CODE_GRAPH_ROOT` apuntando a una instalación local autorizada del
repo y Graphify. Sin esa configuración la herramienta devuelve `unavailable`;
no intenta indexar la carpeta personal ni instalar dependencias por su cuenta.

Actualización manual (comparte el bloqueo con Syka):

```powershell
powershell -File scripts/refresh-graphify.ps1
```

`-Watch` permite ejecutar el mismo mantenimiento desde terminal. La app usa su
propio ciclo de vida; no hay hooks de Git, tareas programadas ni cambios en las
memorias/configuración global de Codex.

## Validación y límites de evidencia

- **Real, AST y filesystem local:** seis pruebas con fixtures aislados cubren
  modificación, alta, ráfaga de guardados, renombre, borrado, reducción de alcance,
  dependientes, un solo escritor, errores reales de sintaxis, recuperación
  automática, cambio de contenido con el mismo timestamp, corrupción del bundle
  y reapertura con cambios hechos fuera de sesión. También se inyectan fallo de
  extracción y escritura durante análisis para probar conservación del índice.
- **Simulado a nivel de proveedor:** 62 pruebas de herramientas/transporte,
  incluidas consultas con grafo sintético, límites, fuentes privadas, integridad,
  Codex dinámico y MCP real local. Esto no valida turnos de Claude ni ACP.
- **Real, Codex:** un turno con la suscripción existente y el modelo anunciado
  por su catálogo (`gpt-6.1-sol`) pasó por `createAgentHost`, WebSocket y herramientas
  dinámicas de Syka. Encontró `EditorExportButton` y consultó sus relaciones:
  importación desde `sidebar-left.tsx` y llamada desde `EditorTitleBar`, ambas
  `EXTRACTED`. Informó 136 archivos vigentes. Sesión y datos de QA aislados;
  sin endpoint de editor, cambios de código por el agente ni publicación.
- **Real, Electron aislado:** perfil y puertos 5417/9367/3397 propios; se comprobó
  recuperar el índice después de terminar el proceso y abrirlo de nuevo. La
  instancia principal de 5188/9346 se preservó.

Evidencias locales (ignoradas por Git):

- `output/graphify/real-agent.json`
- `output/graphify/runtime-tests.txt` y `tool-tests.txt`
- `output/graphify/app-reopen.json`
- `output/playwright/export-metal/verification.json` y capturas de temas/foco.

Los checks TypeScript de agent-chat, desktop y web pasaron. No se hizo commit,
push ni publicación. La cobertura sigue siendo parcial; algunos archivos de
tests no producen símbolos para Graphify y las referencias a módulos excluidos
no implican cobertura de sus implementaciones.

Se intentó además la suite existente `apps/desktop/test/export-shortcut.test.ts`:
no llegó a ejecutar tests porque su mock de `solid-js` no define `createSignal`,
requerido por `editor-tour-model.ts` al importar `post-export-offer.tsx`. No se
alteraron ese test ni el pipeline para sortearlo; la prueba real de clic se
describe abajo con su límite de simulación.

## Contorno de Exportar

El botón real de la cabecera conserva su componente/acción y mide 28 px de alto.
La modificación está sólo en su CSS: reflejo metálico de bajo costo en el borde,
centro opaco y texto limpio, tokens de acento/tema, hover, foco visible y guardas
de movimiento reducido del sistema y la app. No usa canvas ni un loop JavaScript.

Se verificó en el editor Electron real con proyecto de QA, temas claro/oscuro,
acento alternativo y teclado. El clic llegó una vez a `file:pick-export`; se
simuló la cancelación en ese límite IPC para evitar un diálogo nativo. **No se
exportó un video como parte de esa prueba y no se modificó el pipeline.**

Repetir las verificaciones:

```powershell
.runtime/graphify/Scripts/python.exe scripts/test-graphify-runtime.py
node node_modules/vitest/vitest.mjs run packages/agent-chat/test/code-graph.test.ts packages/agent-chat/test/codex-transport.test.ts packages/agent-chat/test/harness.test.ts packages/agent-chat/test/workspace-tools.test.ts packages/agent-chat/test/external-harnesses.test.ts
node scripts/qa-export-metal-launch.mjs
# Con un proyecto de prueba activo en esa instancia:
node scripts/qa-export-metal.mjs
```

`scripts/qa-code-graph-agent.ts --live` es una prueba explícita de proveedor real;
se compila con esbuild para Node y utiliza el login de suscripción que ya expone
el host, sin registrar credenciales en la evidencia.
