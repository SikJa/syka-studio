# Chat Mirel adaptado a Syka — 2026-10-01

## Orb, ajustes de dictado y contexto dentro del composer

- Orb centrado horizontalmente en el encabezado, nombre de conversación debajo.
- Sin ajustes de dictado en el composer. Configuración → Dictado de voz permite cambiar el atajo y consultar/borrar el historial local. El grabador lee esas mismas preferencias y escucha el atajo en captura para funcionar también con el textarea enfocado.
- Contexto movido junto al botón +, dentro del composer. Popup accesible por clic, hover/foco; se elimina la fila inferior vacía. No se fabrica una ventana para sesiones sin datos.
- Se agregó `thread/tokenUsage/updated` al puente Codex, con esquema generado desde el CLI instalado. Se usa `last.totalTokens` (no acumulado histórico) y `modelContextWindow`. Evento `context.updated` persistido, reductor compartido, snapshot y adaptación al composer. Se invalida el valor al iniciar otro turno.
- QA real: `context-settings-report.json`, 16.463 tokens / 258.400, indicador 6%, popup dentro del composer. Orb con desviación horizontal 0 px y título debajo. Atajo cambiado desde Configuración. 28 pruebas de transporte/reductor/host pasan; TypeScript y builds web/desktop pasan. Electron reiniciado con el puente actualizado y proyecto original reabierto sin editarlo.

## Ajuste posterior de navegación y dictado

La última petición reemplaza los accesos anteriores: se quitó el botón Historial del encabezado, el texto de suscripción, Skills y Guía y feedback de la sidebar. La configuración de skills existente se conserva en Ajustes. La identidad visible es Syka con el orb original de Mirel; el selector de modelos conserva el SVG original de Codex de Diffusion. Sidebar de 224 px con tipografía, búsqueda y filas compactas.

Ahora se monta el DictationControl completo de Mirel, con su portal al dictation-slot, waveform original (solo se agregó la directiva React), CSS original sin cambios, tiempo, pausa/reanudación, cancelación, reintento, historial local y atajo. Se reemplazaron las llamadas de Mirel por el estado cifrado y la transcripción Groq de Syka. Cambiar de sesión desmonta y cancela el control.

Prueba actual: `output/playwright/mirel-chat-complete/compact-dictation-report.json`. Electron aislado: sidebar 224 px, orb presente, sin accesos retirados; canvas reacciona al audio de micrófono simulado; pausa/reanudar/cancelar funcionan; llamada real a Groq devuelve texto al borrador. TypeScript y build web pasan; logs de errores del editor principal vacíos. Capturas `sidebar-compact.png` y `dictation-waveform.png`. No se modificó el proyecto del usuario con las pruebas.

## Implementado

- Composer de Mirel con sus animaciones originales, catálogo real de Codex y selector de esfuerzo. Sin Ideas. Menú de adjuntos compacto; scroll sin barra visible. Logo azul de Codex junto a cada modelo y en el botón.
- Componentes originales de identidad, streaming con partículas, thinking, herramientas, selección de texto, respuestas y feedback. Las herramientas conservan detalle, salida e imágenes desplegables.
- Copiar, útil/no útil, feedback con comentario y continuación en una sesión nueva. Feedback guardado localmente; no se envía a Mirel ni se presenta como entrenamiento del modelo.
- Sidebar: búsqueda, Nuevo chat, Programadas, proyectos de conversación, menú de sesión, exportación Markdown, copiar enlace/ID, ventana independiente y Guía y feedback. Skills abre la configuración existente, fuera del composer.
- Cierre de sidebar mediante botón visible, Escape y clic afuera. Mantiene la transición de panel de transitions-dev.
- Proyectos y asignaciones locales; estados de archivo persistidos. No son nuevas carpetas de video.
- `chats.create` crea una sesión vacía persistida sin consumir un turno del modelo.
- Dictado: micrófono → MediaRecorder → conversión local → Groq Whisper Large V3 Turbo existente → borrador. No envía el mensaje automáticamente. Cancela al cambiar de sesión y libera el micrófono. Clave cifrada en el proceso principal.
- Ventana independiente mediante IPC validado, URL local del mismo editor y ID de chat. Puente disponible para esas ventanas; navegación externa bloqueada.
- Programadas locales: crear, pausar, reanudar, ejecutar y cancelar; estado persistido. Ejecución con la suscripción actual, sin duplicar tareas en ventanas secundarias.

## Verificación

Evidencia: `output/playwright/mirel-chat-complete/report.json` y `sidebar-close-report.json`.

- TypeScript web y desktop pasan. Builds web/desktop pasan; Vite conserva advertencias de tamaño del bundle y directivas use-client de dependencias.
- 24 pruebas del host, transporte y política de Codex pasaron, incluida la creación/listado/borrado de una sesión vacía.
- Electron aislado con composición de QA: adjunto PNG pegado guardado en assets locales; respuesta real de la suscripción; copia exacta; feedback guardado; proyecto creado; continuación persistida; copiar ID; ventana independiente.
- Tarea programada ejecutada realmente mediante Codex y terminada con ID de chat.
- Dictado mediante micrófono simulado de Chromium con un WAV de prueba: llamada real a Groq, texto devuelto al borrador. No equivale a validar el micrófono físico del usuario.
- Sin peticiones `/api/v1/` de Mirel y sin errores de consola en la prueba completa. Credenciales cifradas temporales de QA eliminadas al finalizar.
- Corrección posterior verificada: botón y Escape cierran la sidebar; todos los modelos muestran el icono azul con máscara SVG real.
- Editor principal reiniciado y abierto en Silent Sunset 29 Sep. Las ediciones de prueba se realizaron en un proyecto aislado.

## Límites pendientes

- Programadas requieren aplicación abierta y proyecto cargado. No existe aún ejecución con Electron cerrado ni el backend de rutinas de Mirel.
- Claude y Hermes requieren sus propios conectores; no se muestran como proveedores operativos de este puente Codex.
- Modo plan del menú agrega una instrucción al borrador; no se afirma que cambie el modo interno del proveedor.
- Fast, métricas de contexto, cola/steering y otras capacidades de Mirel necesitan adaptación al transporte real si se incorporan.
- Mantener el seguimiento de componentes originales desde el working tree de Mirel; no sustituirlo por el antiguo HEAD. La fuente se confirmó con el chat Mirel ERP — Frontend · Continuidad.
