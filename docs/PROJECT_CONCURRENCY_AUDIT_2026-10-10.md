# Auditoría: proyectos simultáneos y cambio directo de proyecto

Fecha del pedido: 10/10/2026. Alcance: host de chat, sesiones del editor,
enrutamiento de herramientas de preview y menú de proyectos. Sin modificar
el motor ni detener/reiniciar el editor o sus turnos reales.

## Conclusión

Esta sección documenta el estado previo al arreglo. Después del pedido del
usuario se implementó una preview interna con cola por proyecto; ver
[`INTERNAL_PREVIEW_QUEUE_2026-10-10.md`](INTERNAL_PREVIEW_QUEUE_2026-10-10.md).
Los builds se cargan al iniciar main/host. Esta tarea no interrumpió la instancia
que estaba trabajando; después se verificó la cola con dos proyectos de QA en
la nueva instancia abierta. Los detalles de activación figuran en ese documento.

Syka admite varios chats/agentes concurrentes, cada uno con su carpeta y sesión
de proveedor. No ofrece actualmente una preview independiente por cada
proyecto dentro de una misma ventana. Las herramientas del editor comparten
la sesión del proyecto visible. Un agente puede seguir modificando archivos
de A mientras se muestra B, pero no tiene una preview propia de A para
terminar su revisión. Pedir que se reabra A es coherente con esta limitación.

La captura del usuario muestra precisamente ese caso: una revisión de
`fast-river-10-oct` quedó pendiente al cambiar el editor a `wild-storm-10-oct`.
Eso no demuestra que todos los trabajos de ambos agentes se hayan detenido.

## Evidencia del código

| Parte | Evidencia | Implicación |
| --- | --- | --- |
| Host | `packages/agent-chat/src/host/host.ts:96,512,514,567` | Mapa de chats, validación de carpeta y bloqueo por chat. Cada turno se lanza de forma asíncrona; no hay un bloqueo global que impida otro chat. |
| Herramientas de archivos | `packages/agent-chat/src/host/source-tools.ts:38-41` | Carpeta y cola por instancia. La edición de archivos no necesita que su proyecto sea el visible. |
| MCP del editor | `packages/agent-chat/src/host/host.ts:663` | Las sesiones reciben el mismo endpoint de herramientas de esta instancia. |
| Enrutamiento desktop | `apps/desktop/src/dapi/server.ts:120`, `renderer-calls.ts:24,65` | Se envía al renderer seleccionado, sin clave de proyecto. El objeto conserva una sola ventana. |
| Sesión web | `apps/web/src/dapi/session.ts:29`, `api.tsx:78-79` | Una sesión global del editor, publicada al montar y eliminada al desmontar. |
| Navegación | `apps/web/src/pages/project.tsx:50-58` | Cambiar de proyecto remonta los providers del motor; no conserva el mundo anterior para revisión en segundo plano. |
| Contexto/captura | `apps/web/src/dapi/handlers/context.ts:34`, `capture.ts:18` | Contexto y captura usan la sesión abierta. No reciben un proyecto de destino independiente de la UI. |

## Hallazgos

1. **Limitación de concurrencia visual.** Es posible producir archivos en
   paralelo; la revisión mediante herramientas del editor depende del proyecto
   visible. La demora de la captura del usuario tiene una explicación concreta.
2. **Aislamiento incompleto en las herramientas del renderer.** Comprobar la
   carpeta antes de capturar evita errores si el agente lo hace, pero el
   enrutamiento no vincula obligatoriamente cada llamada a su proyecto. No
   afirmar que una captura de B valida A. No se comprobó daño real a archivos.
3. **Más ventanas no son una solución directa.** `RendererCalls` conserva la
   última ventana registrada; otra ventana de la misma instancia necesita
   enrutamiento explícito. La opción `SYKA_MCP_PORT` existente aísla instancias,
   pero no crea previews por proyecto dentro de una instancia.

## Menú agregado

`Syka Studio → Proyectos` despliega los proyectos guardados al pasar el mouse.
Los que trabajan aparecen primero y tienen una ruedita a la derecha con el
acento configurado. Los que esperan respuesta tienen un punto y un nombre
accesible que distingue ese estado. El proyecto visible lleva una marca.
La lista larga tiene scroll y los nombres no desbordan.

El menú consulta resúmenes del host mientras está abierto (máximo cuatro
consultas concurrentes; refresco de cuatro segundos, sin solapar rondas).
Nunca interrumpe turnos ni envía mensajes a los agentes. Antes de navegar
espera el guardado de las ediciones manuales y verifica que el proyecto exista.
Un guardado fallido o una exportación activa impiden cambiar de proyecto.
El menú facilita volver al proyecto cuya revisión está pendiente; no resuelve
por sí mismo la limitación de preview compartida.

## Validación

- TypeScript de web: correcto.
- Host real con proveedor simulado, datos aislados y WebSockets locales:
  dos proyectos estuvieron `running` a la vez, con sesiones/carpeta distintas;
  ambos terminaron incluso después de desconectar al cliente. Se mantuvieron
  los bloqueos de turno duplicado y de carpeta ajena. No se usaron proveedores
  reales ni se contactó el MCP del editor del usuario.
- Vista aislada con los componentes reales del menú: 32 proyectos, hover,
  navegación directa, marca actual, actualización de actividad, scroll,
  nombres largos, acento en oscuro/claro, movimiento reducido y estados vacíos.
- El proceso principal observado conservó PID 14588 y el servidor PID 24688.
  El chat real observado seguía `running` después de integrar el menú.
- No se cambió el proyecto visible del usuario para probar la concurrencia.
  La sesión nativa actual no expone el puerto de depuración 9346; la validación
  visual se hizo en una página de QA separada. No se reinició para habilitarlo.

Evidencias locales: `.runtime/project-concurrency/host-verification.json`,
`menu-verification.json`, `controller-verification.json`, `menu-dark.png` y
`menu-light.png`. Las pruebas simuladas prueban el host y el menú; no prueban
dos revisiones visuales simultáneas con proveedores reales.

## Arreglo estructural identificado en la auditoría

1. Vincular cada sesión de herramientas a un `projectId/cwd` inmutable desde el
   host; validar destino y revisión del source en cada llamada.
2. Mantener o crear un runtime de preview por proyecto, independiente del
   proyecto visible; enrutar check/capture al runtime dueño del proyecto.
3. Serializar las operaciones que compiten por el mismo mundo/captura y limitar
   runtimes/cachés para no duplicar memoria sin control.
4. Probar dos proyectos con fuentes y capturas distinguibles, cambiando de
   pestaña mientras avanzan, y confirmar que nunca se mezclen resultados.

El arreglo posterior usa un único trabajador interno con reparto de turnos,
en lugar de mantener un runtime residente por proyecto. Se probó con 10
proyectos reales de QA y 50 proyectos en la prueba de reparto. La evidencia,
los límites y los puntos todavía no validados figuran en el documento vinculado
arriba. No se introdujo una migración en los proyectos que estaban trabajando.
