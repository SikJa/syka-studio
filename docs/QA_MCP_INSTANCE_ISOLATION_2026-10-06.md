# MCP de cada instancia: hallazgo y corrección

## Qué pasó en la primera edición del proyecto 14

La primera ejecución de `.runtime/run-editorial-agent.mjs` abrió una Electron aislada en `http://127.0.0.1:5248`, pero no asignó `SYKA_MCP_PORT`. La instancia principal ya atendía el puerto MCP 3275. `DapiServer` no pudo disponer de su propio endpoint y el chat arrancó sin MCP; el transcript contiene el aviso exacto `Editor tools unavailable`.

Los tools de archivos sí estaban anunciados, pero `context`, `check` y `capture` no se habían inyectado en ese chat. El agente leyó una referencia obsoleta que decía 3274, creó `scripts/editor-call.mjs`, falló con `ECONNREFUSED`, buscó puertos y acabó usando 3275, el editor principal. Abrió el mismo proyecto 14 allí. Por tanto, esa primera prueba tuvo un fallback manual a otra ventana: no demuestra que el circuito MCP de la instancia aislada funcionara bien. Su edición y capturas siguen siendo evidencia del trabajo efectuado, con esta limitación explícita.

No se interrumpió el turno en curso para investigar. Una lectura independiente del MCP principal confirmó 20 herramientas, entre ellas `context`, `capture` y `check`, y `context.projectDir` apuntó a `Pruebas Syka/14-edicion-referencias`. El editor principal sí tenía herramientas; el fallo fue de aislamiento de la prueba.

## Cambios

- El launcher de QA14 fija `SYKA_MCP_PORT=43278` y comprueba antes de iniciar un chat que el estado de esa ventana esté disponible y anuncie exactamente ese endpoint. Si no, la prueba termina con un error concreto.
- Las instrucciones del chat Codex incluyen la URL real de esa sesión y exigen comprobar `context.projectDir`. Si no hay MCP, declaran que captura, chequeo y export no están verificados; prohíben buscar puertos o usar otra instancia como reemplazo.
- Configuración → MCP obtiene URL y disponibilidad de `DapiServer`, en lugar de mostrar siempre el puerto global. Una colisión identifica el puerto ocupado. Copiar/conectar quedan deshabilitados mientras el servidor propio no esté disponible.
- Registrar un agente externo tras un fallo de conexión no modifica sus archivos. El HTTP de una instancia aislada registra su URL exacta. El proxy stdio existente conserva el endpoint normal; una instancia con puerto propio no lo ofrece como si apuntara a ella.
- La referencia de herramientas corrige 3274 a 3275 como valor por defecto, dejando claro que manda el endpoint de la sesión.

No hay escaneo, elección silenciosa de otro puerto ni conexión automática con otra ventana.

## Validación

- Pruebas locales de `dapi/server.test.ts`: endpoint aislado, catálogo MCP real por HTTP, apagado y colisión real de puerto sin fallback.
- `mcp-install.test.ts`: registro de 43278 y preservación de configuración ajena; registro bloqueado después de un bind fallido, sin escrituras.
- Pruebas Codex: URL concreta y regla de proyecto entregadas al `thread/start`; estado sin conexión explícito. La regresión de memoria de onboarding se comprueba por separado en el mismo suite de transporte.
- 23 tests pasan en los cuatro archivos; TypeScript de desktop y agent-chat pasa.
- Turno real posterior aprobado: `Pruebas Syka/resultados/editorial-tools-real.json`, chat `bab58b2b-69c2-4b7c-a488-03079df305a7`. `syka_onboarding_memory`, `mcp__syka__context`, `mcp__syka__check` y `mcp__syka__capture` terminaron `done`, sin terminal/CDP como reemplazo. `context.projectDir` coincidió con el proyecto 14; el chequeo devolvió cero incidencias y el agente inspeccionó la captura de 3,2 s. Esto verifica las herramientas en ese turno; no borra la limitación de la primera ejecución.

Este documento describe validación local Windows; no afirma verificación en Mac.
