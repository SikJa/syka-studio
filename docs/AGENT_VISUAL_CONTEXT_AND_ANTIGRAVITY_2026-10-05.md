# Chat contextual, pantalla completa y Antigravity — 05/10/2026

## Qué se entregó

- Inicio y composer del dashboard en español. La invitación a conectar agentes se calcula con el estado real de los proveedores; tener MCPs registrados no equivale a tener un agente conectado. Groq y Zernio tienen accesos individuales y enlaces oficiales para obtener sus claves. Los avisos desaparecen al configurar la integración y volver de Configuración; los errores de consulta no se presentan como una desconexión confirmada.
- Chat compacto debajo del video en pantalla completa, con la misma conversación, modelo, adjuntos, cola y borrador. «Ver conversación» permite desplegar el historial. El selector de modelos se monta dentro del elemento de pantalla completa. Salir devuelve el chat a su ubicación habitual.
- «Usar con el agente» para logos, sonidos, referencias de motion y presets. Agrega contexto al borrador sin enviarlo automáticamente ni insertar recursos a la fuerza. Conserva el texto escrito. Incluye archivo o preset, escena, tiempo y elementos seleccionados.
- Actualización posterior: esos recursos también se pueden arrastrar al composer o al panel del chat. Logos/sonidos/motions conservan su archivo como adjunto local y el contexto de la selección; los presets pasan su ID nativo. Los gestos de biblioteca se resuelven con su token interno y los presets con el catálogo conocido. No se leen rutas arbitrarias desde `text/plain`, no se importan archivos a la timeline y no se envía el mensaje automáticamente.
- «Consultar selección con el agente» utiliza la selección existente. La actualización posterior agregó un modo de señalar componentes nativos y otro de capturar una región, ambos con preparación de contexto en el borrador.
- Antigravity CLI oficial detectada automáticamente, catálogo consultado en vivo y conexión al MCP local del editor. ACP sigue disponible para instalaciones/chats anteriores, con su propio cursor; un historial ACP no se reanuda como una conversación de CLI.

## Antigravity: por qué el selector anterior no mostraba Claude

La cuenta de Google, los modelos visibles en la aplicación, el catálogo ACP y el catálogo de la CLI son cosas distintas. En este equipo, ACP anunciaba 11 modelos Gemini. La CLI oficial 1.2.17 anunció 18 modelos, incluidos Opus 5.5 y Sonnet 5.5 con variantes low/medium/high. Syka muestra ese catálogo real; no agrega modelos a mano ni sustituye uno que falle.

El paquete [pi-antigravity-acp-provider](https://github.com/zacbemis/pi-antigravity-acp-provider) conecta Pi con el servidor ACP oficial, pero no amplía por sí mismo los modelos que anuncia ese servidor. Su instalación no resolvía esa diferencia. Se implementó un adaptador propio sobre el protocolo documentado de la CLI, sin copiar OAuth privado ni importar tokens de navegador.

La CLI está instalada localmente en `.runtime/diffusion/providers/antigravity-cli/agy.exe`, fuera del código distribuible. El runtime la detecta allí o mediante `agy` en PATH. Para otra computadora, la guía de Configuración apunta a la [instalación oficial](https://antigravity.google/docs/cli/install). No se creó un instalador de Syka ni se incluyó el ejecutable de Google en el repositorio.

[La documentación de modelos](https://antigravity.google/docs/models) condiciona Claude a los planes/cuentas habilitados por Google. Que funcione en esta cuenta no garantiza disponibilidad para todos los usuarios.

### Transporte y permisos

El adaptador utiliza entrada/salida NDJSON, modelo explícito y cursor de conversación de la [CLI headless oficial](https://www.antigravity.google/docs/cli/headless/). Confirma el resultado final; un `SUCCESS` con respuesta vacía se considera fallo. Los errores de herramientas se reflejan como errores, no como tareas completadas.

Por turno se agregan entradas MCP de nombre corto y aleatorio a `.agents/mcp_config.json`, preservando los servidores propios del proyecto. Se conectan la documentación/herramientas de archivos del proyecto y, cuando está disponible, el MCP del editor. Se retiran al terminar el turno.

La CLI headless negaba las llamadas MCP por defecto. Se otorgan reglas temporales `mcp(nombre_de_esta_sesion/*)` en la configuración oficial de permisos, limitadas a los servidores locales de Syka. Se preservan las reglas personales allow/ask/deny y se retiran únicamente las reglas agregadas por este turno. No se habilita un wildcard global ni se usa `--dangerously-skip-permissions`. Las reglas explícitas ask/deny de Google siguen teniendo prioridad. Un cierre abrupto del proceso puede impedir el cleanup de entradas temporales; no se afirma recuperación automática de ese caso.

Referencias: [configuración MCP oficial](https://antigravity.google/docs/mcp/), [permisos oficiales](https://antigravity.google/docs/permissions/).

Limitaciones actuales: la CLI recibe texto/contexto; no se inventa soporte binario para adjuntos. La inserción durante un turno requiere soporte nativo del proveedor: Codex y Hermes tienen implementación específica; esta CLI conserva mensajes en cola para el siguiente turno. Los modelos y límites de la cuenta se consultan, no se garantizan.

## Ventanas arrastrables: panel implementado y ventana nativa pendiente

Se implementó un panel flotante dentro de Syka con su mismo montaje y estado, sin crear una segunda sesión ni otro editor. Clic derecho en la cabecera permite desacoplar/acoplar; la cabecera se arrastra y la esquina cambia el tamaño. Posición y tamaño persisten, se limitan al viewport y el tamaño se puede ajustar con teclado. La animación de acople/desacople usa `transitions-dev` y respeta movimiento reducido. «Restablecer ubicación» dedicado sigue pendiente.

La ventana nativa separada exige más trabajo: actualmente `APP_OPEN_CHAT_WINDOW` abre una segunda ventana con ruta `chatWindow=1`, pero el renderer no consume ese flag para montar una vista sólo de chat. Por eso no se presenta como una función terminada. Debe existir un renderer de chat dedicado que comparta el host, y las operaciones del video deben dirigirse al editor dueño del proyecto. Clonar el editor entero puede duplicar escritores, biblioteca y estado del lienzo.

En una ventana nativa la cabecera utiliza `app-region: drag`, y los controles `no-drag`; un panel dentro de la página utiliza eventos pointer y `setPointerCapture`. Son mecanismos distintos. Fuentes: [Electron](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions), [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).

El panel flotante y pantalla completa se implementaron y probaron. Una ventana separada del sistema operativo sigue pendiente. Ver [el cierre posterior](FLOATING_CHAT_VISUAL_TARGETS_AND_MODEL_VISIBILITY_2026-10-05.md) para el comportamiento entregado y su QA.

## Selección visual nativa: cómo resolverla bien

El video del editor se dibuja en un canvas; un selector DOM de HTML no puede identificar una tarjeta o una palabra dentro de ese dibujo. El motor ya ofrece hit testing mediante límites y transformación inversa, selección y entrada en contenedores. Hay que reutilizar eso, no superponer un selector HTML ficticio.

Contrato inicial investigado; la actualización posterior implementó el picker geométrico, selector de padres, captura de región y snapshot SHA del árbol autoral. Las acciones dedicadas por palabra de captions siguen pendientes:

1. Capturar escena y momento del video; pausar o fijar ese momento durante la selección.
2. Resaltar el objetivo y permitir entrar en un grupo/tarjeta para elegir un hijo. Mostrar nombre y tipo, no un ID numérico opaco.
3. Preparar `Source` y `Key`, escena, tiempo, contexto de grupo/loop y revisión observada. El nuevo picker agrega el SHA del árbol autoral y valida el contexto antes de adjuntar. Las ediciones de source existentes conservan su control de hash.
4. Ofrecer «Preguntar», «Cambiar» y «Usar como referencia». Pedir la modificación cuando no esté indicada; mantener Deshacer.
5. Revalidar la identidad antes de editar. Un elemento de un loop puede compartir source con todas sus instancias; se debe resolver si el cambio afecta una instancia o la receta completa.

Para captions se necesita además ID de cue/palabra y rango de transcripción. Para un botón que está grabado dentro de un MP4 sólo existe región + tiempo: no es un botón editable de Syka. El agente puede analizarlo, recortar o superponer; no debe prometer editar su HTML original.

La edición por transcripción debe conservar el original y su correspondencia temporal. El ejemplo de [Premiere Text-Based Editing](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/overview-of-text-based-editing.html) sirve para separar texto de contenido, corte y captions finales; no convierte cualquier texto visible en transcripción editable.

## Inventario de zonas y acciones para el agente

«Propuesto» significa que se investigó y definió el contrato; no que se programó el botón.

| Zona | Contexto necesario | Acción útil | Estado |
|---|---|---|---|
| Lienzo: selección actual | Source, Key, loop, escena, tiempo | Preguntar o modificar lo seleccionado | Botón implementado |
| Tarjeta/grupo anidado | Ruta de hijos, bounds, source, revisión | Señalar hijo o conjunto completo | Picker y selector de padres implementados |
| Texto nativo | Source, texto, estilo, selección | Reescribir, mejorar jerarquía, animar | Picker implementado; instrucciones libres en diálogo |
| Captions | Cue/palabra, timestamps, archivo transcript | Corregir, restilizar, reagrupar | Contrato específico propuesto |
| Video grabado | Archivo, tiempo y región | Analizar o recrear una referencia | Captura de región implementada; no edita píxeles como componentes |
| Timeline: clip | Source, in/out, pista, playhead | Ajustar corte, ritmo o volumen | Acción contextual propuesta |
| Timeline: rango | Inicio/fin, clips afectados | Revisar sólo este momento | Acción contextual propuesta |
| Keyframes | Propiedad, valores, easing, rango | Mejorar fluidez de un movimiento | Acción contextual propuesta |
| Inspector | Elemento, propiedad, valor actual | Explicar o ajustar una propiedad | Acción contextual propuesta |
| Logos | Ruta original, marca y variante | Integrar el logo sin inventarlo | «Usar con el agente» implementado |
| Sonidos | Ruta, categoría, momento/selección | Proponer ubicación y volumen | «Usar con el agente» implementado |
| Música/capas | Archivo, BPM/duración/licencia | Proponer cama musical y mezcla | Misma acción de sonidos; sincronía avanzada propuesta |
| Motions de referencia | Ruta del video y contexto | Watch local y recreación editable | «Usar con el agente» implementado |
| Presets de texto/animación/efecto/transición | ID, tipo y objetivo | Aplicar o adaptar una receta | «Usar con el agente» implementado |
| Media importada | Ruta/id, metadatos, rango | Analizar este recurso | Acción dedicada propuesta |
| Skills y mis flujos | ID, receta y parámetros | Usar, explicar o adaptar | Acciones existentes; referencias más ricas propuestas |
| Chat: texto subrayado | Mensaje original + fragmento | Preguntar o convertir a instrucción | Función existente; mantener coherencia con nuevo contexto |
| Archivos generados | Ruta, tipo y proyecto | Revisar o reutilizar resultado | Acciones existentes; targets más precisos propuestos |
| Brand Kit | Marca, tipografía, variantes y perfil de estilo | Usar una referencia de marca | Configuración existente; acción contextual propuesta |
| Exportación | Escena, formato, destino y validación | Revisar antes de exportar | Acción contextual propuesta |
| Publicaciones | Borrador, cuenta, canal, pieza | Preparar texto/portada, pedir aprobación | Frente Zernio separado; no publica desde estos botones |

La biblioteca tiene dos intenciones legítimas: insertar manualmente y pasar una referencia al agente. Se conservaron ambas, con un botón explícito para la segunda. Para contenido instalable, «Instalar» sólo corresponde a un paquete identificado, compatible y con licencia; no a un video de referencia ni a cualquier miniatura.

### Orden para continuar

1. Panel flotante dentro del editor: entregado y verificado.
2. Modo de señalar tarjetas, grupos, textos y elementos nativos de captions: entregado. Contrato específico por palabra/cue pendiente.
3. Menús contextuales de clip, rango e inspector reutilizando un único contrato de referencia.
4. Adaptación de recipes/Brand Kit: explicar y editar una receta a partir de ejemplos, sin otro asistente ni otro perfil de cuenta.
5. Ventana de chat dedicada y coordinación entre ventanas, después de verificar quién es dueño del proyecto.

## Verificación y límites de evidencia

- Backend: 27 archivos de tests, 228 tests aprobados. Incluyen resultado vacío, fallos, interrupción, preservación de configuración MCP/permisos y cola de mensajes.
- TypeScript de web y agent-chat: aprobado. Build web y bundle del host: aprobados. Persisten avisos del bundler sobre `use client` y tamaño de chunks; no son fallos de compilación.
- Prueba de cuenta real: Opus devolvió `CONEXION_OK`; no constituye una edición completa.
- Prueba real de herramientas: Sonnet leyó `reference/jsx/rect.md` por MCP y respondió `cornerRadius`, `MCP_OK`.
- Prueba dentro del chat visible de Syka: Sonnet leyó la misma referencia, devolvió `SONNET_OK`, el host quedó idle y no hubo errores de página. Evidencia: `output/playwright/fullscreen-antigravity-result.json`.
- Pantalla completa: borrador conservado al entrar/salir, composer compacto visible y selector de modelos verificado dentro del elemento fullscreen. Captura: `output/playwright/fullscreen-composer.png`.
- Biblioteca de logos: clic real en «Usar con el agente», referencia agregada al borrador con ruta y tiempo, texto previo conservado y ningún mensaje enviado. Evidencia: `output/playwright/reference-actions-result.json`.
- Arrastre posterior: tarjetas reales de logos, sonidos, motions y presets soltadas sobre el composer; preset soltado también sobre el panel de chat. Borrador conservado, tres archivos como adjuntos locales y preset como contexto, sin enviar mensajes ni errores de página. Se utilizó una carpeta local temporal de entregables cuando la biblioteca de motions estaba vacía y se retiró al finalizar. TypeScript y build web aprobados después de los cambios. Evidencia: `output/playwright/library-chat-drag-result.json` y `output/playwright/library-chat-drag.png`.
- Selección inicial: clic real sobre una fila de timeline y contexto Source/elementos en el borrador. El QA posterior también verificó el nuevo picker, un texto nativo, capturas guardadas y preservación del borrador: `output/playwright/floating-visual-targets-result.json`.
- Dashboard con esta configuración: agentes y Groq ya conectados no mostraron invitación. Zernio siguió apareciendo porque el estado público no informó una conexión configurada. No se generaron claves ni se publicaron videos.
- No se hizo una nueva edición completa de video con Antigravity en esta entrega. No se atribuyen las pruebas Codex anteriores a Sonnet.
