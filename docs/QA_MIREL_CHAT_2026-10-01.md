# Chat Mirel integrado en Syka — 2026-10-01

## Implementado

Fuente confirmada por el chat **Mirel ERP — Frontend · Continuidad**: composer actual del arbol de trabajo de Mirel, no HEAD de agosto. Se preserva el componente React y se monta como isla explicita dentro del editor Solid; sus estilos estan acotados al chat.

- Composer, ideas, selector de modelos y esfuerzo de razonamiento.
- Catalogo real de Codex: las capacidades vienen de model/list. El esfuerzo llega a turn/start; no es una etiqueta decorativa.
- Seleccion de archivos, carpeta local, pegado de imagen con preview, quitar adjuntos.
- Imagenes del portapapeles guardadas en `03 Assets reutilizables/Adjuntos` del proyecto. No se suben a Mirel.
- Enviar y detener conectados al puente existente; conversaciones e historial preservados.
- Copiar respuestas, seleccion de texto, identificacion del agente y estado de conexion.
- Acceso a ajustes Skills/MCPs, propuestas de busqueda web y generacion de imagen mediante las herramientas existentes de Syka.

## Verificacion

- Build web de produccion: correcto, con advertencias de tamanos de bundle y directivas use client ignoradas por Vite.
- Typecheck escritorio y build agent-host: correctos.
- Pruebas codex-transport, codex-policy y e2e: 23 correctas. Se verifica envio efectivo del esfuerzo.
- Electron aislado, proyecto QA separado del proyecto del usuario: catalogo de 8 modelos, control de esfuerzo, PNG pegado guardado localmente, quitar adjunto, menu de herramientas, respuesta real `SYKA_CHAT_OK` usando la suscripcion y copiarla al portapapeles.
- Cero errores de pagina y cero peticiones `/api/v1/` de Mirel en la prueba final.
- Evidencia: `output/playwright/mirel-chat/report.json` y `chat.png`; script `output/qa-mirel-chat.mjs`.
- En QA aislado el MCP de edicion no ocupa el puerto del editor principal: la respuesta de prueba no utiliza herramientas ni modifica el video. No representa una nueva validacion de edicion ni de generacion de imagen.

## Pendiente explicito

No se ha migrado el shell entero de Mirel. Historial y transcript siguen conectados a Syka y tienen ajustes visuales propios. Dictado Groq del composer, cola/steering, Fast y estadisticas reales de contexto requieren adaptacion; no se simulan como funciones disponibles. Las APIs privadas de dictado/proyectos de Mirel no se utilizan. La reestructuracion completa de la sidebar y el centro visual de skills queda para otra iteracion.

Se preservan las modificaciones previas del proyecto y las composiciones del usuario. No hay despliegue ni publicacion.
