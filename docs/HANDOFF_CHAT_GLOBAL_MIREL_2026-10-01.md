# Handoff del chat global de Mirel para Syka Clips

Revisión de solo lectura del código: 1 de octubre de 2026.

## Fuente que hay que usar

Raíz absoluta: `F:\Agencia\Mirel\Mirel ERP - Integration`.

Usar los archivos actuales del árbol de trabajo, incluyendo los modificados y no versionados. HEAD es `9d5e01b` (30 de agosto); checkout de ese commit NO incluye la versión actual del composer. Solo encontré un `agent-composer.tsx` fuente fuera de artefactos/backups en el árbol de Mirel.

Fechas de modificación observadas (solo referencia de archivos, no fechas de deploy): composer TSX 8 de septiembre; composer CSS 2 de septiembre; shell 16 de septiembre; integración conectada 29 de septiembre. No se verificó el release activo de producción en esta revisión.

## Componentes canónicos y rutas exactas

| Responsabilidad | Ruta absoluta |
| --- | --- |
| Entrada de las páginas de agentes | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-pages.tsx` |
| Controlador de conversaciones, estados, eventos y operaciones | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\connected-agent-chat.tsx` |
| Shell compartido y composición visual | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-chat-shell.tsx` |
| Composer y selector de modelo/esfuerzo integrados | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-composer.tsx` |
| CSS del composer | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-composer.css` |
| CSS del shell, transcript y enlaces | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-workspace.css` |
| Variantes full/side/compact/floating | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\agent-chat-contract.ts` |
| Contratos de composer, mensajes y eventos | `F:\Agencia\Mirel\Mirel ERP - Integration\packages\contracts\src\chat.ts` |
| Estados de runs, aprobaciones y aclaraciones | `F:\Agencia\Mirel\Mirel ERP - Integration\packages\contracts\src\agents.ts` |
| Cliente HTTP/SSE de referencia (no trasladar su backend) | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\api\agent-chat.ts` |
| Tokens, temas y fuentes | `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\styles\foundation.css` |

Cadena normal: `AgentPage → AgentWorkspace → ConnectedAgentChat → AgentChatShell → AgentComposer`. Los paneles contextuales reutilizan esos componentes; no tienen otro composer reducido. `AgentPage` puede montar `AgentWebSearchPreview` con flags DEV: esa preview no es la fuente de integración real.

## Estado del composer actual

- Editor controlado con crecimiento hasta cinco filas por defecto y luego scroll interno. Enter envía, Shift+Enter conserva el salto; respeta composición IME. Escape y click fuera cierran menús.
- Toolbar separada del editor: agregar a la izquierda; modelo, dictado y envío/cancelación a la derecha.
- El selector NO es un archivo independiente: está en `agent-composer.tsx`, aproximadamente desde la línea 385. Incluye modelos en radiogroup, descripción/check del seleccionado, slider discreto de esfuerzo y panel Avanzado para Fast.
- Modelos y esfuerzos vienen del runtime; no hay que portar una lista fija de etiquetas. Los cambios llaman callbacks y la integración guarda el estado en el backend.
- `max` y `ultra` activan el efecto CRTWarp; los otros ids no. El fallback de posición del slider busca `medium` pero no inventa un cambio de configuración del runtime.
- Contexto conocido: anillo y porcentaje con desglose de tokens. Sin datos: muestra `—`, no 0%. El porcentaje se limita a 0–100.
- Fast está condicionado a `fastAvailable`; las leyendas visuales “1,5×” y consumo no son una medición de rendimiento de Codex. En Syka deben corresponder a una capacidad real del puente.
- En ejecución, sin borrador listo muestra detener; con contenido y `allowWhileWorking` permite cola o redirección. Reconoce borradores `/steer`, `/background`, `/bg`, `/btw` como instrucciones. La semántica final la decide el controlador.
- Cola encima del composer: ver mensajes, editar, quitar, redirigir y desactivar cola. La cola de Mirel vive en estado React del controlador; no se verificó persistencia de la cola tras recargar.
- Menú de agregar permite acciones parametrizadas; no garantiza que una herramienta se haya habilitado en el backend. Sugerencias “Ideas” solo aparecen cuando se proporcionan.

## Adjuntos, imágenes y portapapeles

Rutas bajo `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\features\agents\`:

- `agent-attachment-policy.ts`: validación/deduplicación; 30 archivos, 25 MiB por archivo, 250 MiB por mensaje. Imágenes PNG/JPEG/GIF/WebP, PDF, DOC/DOCX, XLS/XLSX y CSV. `accept` muestra `image/*` pero la validación es más acotada.
- `agent-image-lightbox.tsx`: visor de imágenes compartido; el composer muestra miniaturas removibles y lo abre.
- `agent-attachment-cover-flow.tsx`: adjuntos del transcript.
- `agent-chat-primitives.tsx`: overlay de drop, carga y helper de autoscroll.

Selección por input `multiple`; drag/drop sobre el panel de conversación en `agent-chat-shell.tsx` (handlers desde línea 426). El rótulo “Archivos y carpetas” no equivale a selección real de directorios: el input revisado no tiene `webkitdirectory`.

No encontré `onPaste` ni `clipboardData` en los componentes de chat/agentes revisados. El pegado de texto es nativo; pegar imágenes NO debe darse por implementado. En Syka conservar/añadir un handler que traduzca ClipboardEvent a File[] y use el mismo pipeline de adjuntos, evitando enviar dos veces el mismo archivo.

El controlador de Mirel crea conversación si falta, prepara previews con Object URLs, sube archivos, recibe `assetRef`, bloquea envío de archivos sin subir, consulta estado de procesamiento y elimina almacenamiento remoto al quitar. Para Codex sustituir esa parte por rutas locales/identificadores del puente y entradas de imagen reales; la miniatura por sí sola no entrega la imagen al modelo.

## Shell, historial y representación

Otros archivos dentro de la misma carpeta de agentes:

- `agent-rich-text.tsx`: renderer propio de Markdown (listas, tablas, código, citas, enlaces), iconos de plataforma. Depende de `apps/web/src/shared/social-platform-selector.tsx` y su CSS. No es react-markdown.
- `agent-particle-stream.tsx` / `.css`: streaming visual, renderiza rich text y respeta movimiento reducido.
- `agent-task-rows.tsx` / `.css`: progreso/lista de tareas y resumen de cambios.
- `agent-thinking-trace.tsx`, `agent-web-search-trace.tsx`: razonamiento/actividad/herramientas/búsquedas.
- `agent-approval-card.tsx`, `agent-clarification-card.tsx`: decisiones humanas y preguntas.
- `agent-identity-orb.tsx` / `.css`: identidad y orbes de respuesta con thinking-orbs.
- `proximity-sidebar.tsx`: navegación por secciones de transcript.
- `agent-projects.tsx` / `.css`: proyectos, mover/archivar/restaurar conversaciones y preferencias de agrupación/orden/estado/inbox/colapsado/fijados/secciones.
- `agent-skill-hub.tsx`, `agent-skill-notification.tsx`: interfaz de skills y revisión. Mantener capacidades reales o adaptar a Syka, no exponer operaciones de Mirel.
- `agent-catalog.ts`: identidad/colores del agente; sustituir por identidad de Syka.
- `agent-activity-store.ts`: coordinación de trabajo entre chats; la restricción por agente de Mirel no debe imponerse automáticamente a sesiones Codex independientes.

Selección flotante: `F:\Agencia\Mirel\Mirel ERP - Integration\apps\web\src\components\selection-actions.tsx` y `.css`. Describe/cambia/acorta/tono/gramática y texto personalizado generan borrador; no son ediciones automáticas del mensaje persistido.

Historial: búsqueda, nuevo chat, proyectos, menú contextual, exportar Markdown, branch, feedback y chat de Guía y feedback. Las preferencias de vista viven en localStorage. `useAgentProjects` hace fetch DIRECTO a `/api/v1/agents/:agentKey/projects` incluso al montar el shell: este acoplamiento hay que extraer o sustituir antes de reutilizarlo sin API Mirel.

El transcript mantiene autoscroll si el usuario está cerca del final y muestra salto al último mensaje cuando se aleja. Las acciones de respuesta incluyen copiar/feedback/branch. No basta portar solo composer si se busca toda la experiencia de chat.

## Contratos para el adaptador Codex existente

`AgentComposerProps` comienza en la línea 103 de `agent-composer.tsx`; `AgentChatShellProps` en la 74 de `agent-chat-shell.tsx`.

Forma mínima del estado de runtime de referencia:

```ts
interface ComposerRuntime {
  modelId: string | null;
  models: Array<{
    id: string; model: string; provider: string; label: string;
    description?: string; supportsFast: boolean;
  }>;
  reasoningEffort: string | null;
  reasoningEfforts: string[];
  fast: boolean;
  fastAvailable: boolean;
  contextUsage: { usedTokens: number; maxTokens: number } | null;
}
```

Adaptar catálogo real de modelos/efforts de Codex; seleccionar modelo/esfuerzo debe actualizar la ejecución real, no solo el estado visible. Deshabilitar selector durante una ejecución según el contrato actual. Fast solo si el puente implementa la capacidad.

Operaciones del adaptador: listar/crear/abrir sesiones; enviar texto+adjuntos; cancelar; aplicar modelo/esfuerzo; observar eventos; mapear uso de contexto; approvals/preguntas/herramientas; manejar errores y estado final. Mantener el backend Codex por suscripción que ya funciona en Syka.

Referencia de eventos Mirel (`packages/contracts/src/chat.ts`): `run`, `delta`, `message`, `activity`, `approval`, `clarification`, `error`; cada evento lleva `sequence` y `runId`. Actividad: `id`, `kind` status/tool, `state` started/progress/completed/failed, `label`, `summary?`, `durationSeconds?`, `webSearch?`.

Referencia de robustez de `api/agent-chat.ts`: POST messages, header `x-mirel-run-id`, filtrado por run/secuencia, replay de eventos si se corta SSE, lectura final autoritativa. Son detalles de Mirel; en Electron mapear los eventos IPC/Codex existentes conservando aislamiento por sesión, reconciliación y estado terminal. No copiar URLs `/api/v1/agents` ni el puente Hermes.

La integración evita completions tardías al cambiar agente/desmontar y elimina mensajes optimistas si falla la reconciliación autoritativa. Para Syka mantener esas garantías por sesión/thread.

## Dictado: acoplamiento que necesita adaptación

`dictation-control.tsx`, `dictation-control.css`, `dictation-waveform.tsx` en la carpeta de agentes. Usa getUserMedia/MediaRecorder, límite 5 minutos, historial local de 30 entradas, atajo configurable (default Alt+Shift+V), retry/cancel.

Hace GET/POST directo a `/api/v1/dictation` y espera identidad/capacidad/texto de la API privada. El prop `dictationContext` monta ese componente específico. Para mantener la transcripción actual de Syka hay que adaptar su transporte, no trasladar el endpoint. El prop alternativo `voice` aporta toggle, pero no sustituye por sí solo toda la UI de dictado.

## Dependencias y CSS

Mirel usa React 19 + ReactDOM, TypeScript y Vite. Dependencias visuales relevantes declaradas: `lucide-react ^0.563.0`, `@remixicon/react ^4.9.0`, `metal-fx ^1.0.4`, `three ^0.185.1`, `thinking-orbs ^0.3.1`. Otras globales: Astryx core/theme-neutral, motion, SWR, recharts, react-day-picker; no instalar todas por defecto para portar el composer.

`metal-fx` se usa mediante componentes React; CRTWarp (`apps/web/src/components/crt-warp.tsx` y `.css`) usa Three.js y React. `apps/web/src/shared/use-metal-appearance.ts` observa `html[data-theme]`, `html[data-motion]` y prefers-reduced-motion.

Fuentes: Instrument Sans para UI, DM Mono para detalles; Bodoni Moda pertenece al tema global, no es necesaria para el composer. Extraer tokens de `foundation.css` (primeras ~76 líneas) y estilos del chat a un ámbito Syka, no importar toda foundation sin revisar porque también cambia layout y otras páginas.

Tokens consumidos incluyen `--text`, `--text-soft`, `--muted`, `--muted-2`, `--line`, `--line-strong`, `--surface`, `--surface-2`, `--surface-3`, `--surface-hover`, `--amber`, `--agent-accent`; respetar tema claro/oscuro y movimiento reducido. Portales de selección/proyectos/revisión requieren trasladar sus capas completas para evitar el bug de quedar por debajo del chat flotante.

## Reutilización en SolidJS

Estos TSX NO son plug-and-play con Solid: usan hooks React, createPortal de ReactDOM, lazy/Suspense y librerías React. Recomiendo portar la capa visual a Solid conservando clases/CSS y callbacks; alternativamente montar una isla React explícita con root/unmount y adaptador IPC. Elegir una estrategia antes de copiar archivos; no mezclar JSX React en componentes Solid.

Separar UI, transporte y capacidades. Implementar primero composer+selector+adjuntos/envío/cancelación reales sobre el puente de Syka, después transcript/actividad/historial. Exponer únicamente controles cuyo contrato Codex ya esté resuelto; no mostrar catálogos o approvals ficticios.

## Evidencia y límites

- Revisión del árbol local y de tests/documentos existentes. No ejecuté tests/build/browser ni accedí a producción para este handoff.
- Pruebas de referencia: `apps/web/src/features/agents/agent-composer.test.tsx`, `connected-agent-chat.test.tsx`, `agent-rich-text.test.tsx`, `agent-task-rows.test.tsx`, `agent-chat-contract.test.ts`; `apps/web/src/components/selection-actions.test.tsx`.
- Documentación histórica: `docs/CHAT_UI_STANDARD_2026-08-30.md`, `docs/CHAT_FLOATING_PARITY_2026-09-16.md`. La primera contiene restricciones que el código posterior superó (por ejemplo, actualmente hay Skill Hub); usar código actual como fuente de verdad de UI. La validación del 16/9 documenta paridad de selección/menús/flotante, no certifica todas las operaciones remotas.
- Handoff es la única escritura realizada. No se cambió código de Mirel, no se levantaron servicios y no se desplegó nada.

