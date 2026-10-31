# Auditoría del puente Codex de Syka

## Alcance y evidencia

Se comparó el catálogo DAPI del checkout actual y el tools/list real del servidor local de Syka con la configuración del Codex integrado. Evidencia reproducible: `output/bridge-audit-2026-10-01.mjs` y `.json`. No se ejecutó un turno de modelo, una transcripción, descarga de modelos, export ni publicación para esta auditoría. El listado del servidor prueba disponibilidad registrada, no que todas las funciones estén validadas de extremo a extremo. No se cambiaron permisos ni conexiones.

## Catálogo MCP: 18 herramientas, 9 expuestas al chat

| Herramienta | Chat Codex | Estado y consecuencia |
| --- | --- | --- |
| context | Sí | Contexto básico, tiempo, fuentes, generaciones y máscaras; no lista completa de assets/pistas/selección. |
| check | Sí | Verificación estructural local. |
| capture | Sí | Fotogramas de la composición. |
| fonts | Sí | Fuentes locales. |
| media_probe | Sí | Metadatos técnicos. |
| media_grab | Sí | Fotogramas del medio original. |
| media_filmstrip | Sí | Contact sheet del original. |
| media_waveform | Sí | Forma de onda, sin comprensión semántica del audio. |
| media_transcribe | Sí | Groq propio, separado de la suscripción Codex. |
| export | No | Funciona desde UI/CLI; el chat no puede terminar este paso por sí mismo. |
| screenshot | No | El chat puede ver escenas con capture pero no toda la interfaz. |
| logs | No | Falta diagnóstico de consola desde el chat. |
| media_segment | No | SAM2 local disponible en código, pero no invocable por Codex; necesita pesos y hardware compatibles. No validado en esta auditoría. |
| open | No | No puede abrir/crear otro proyecto por MCP; trabaja sobre el proyecto seleccionado. |
| media_listen | No | Handler desactivado: falta un proveedor de comprensión de audio, no sólo activar un permiso. |
| models, voices | No | Catálogos cloud desactivados, devuelven vacíos. |
| report | No | Handler todavía publica issues en diffusionstudio/editor mediante gh; no habilitar como diagnóstico local. |

Fuente: packages/dapi/src/catalog.ts y packages/agent-chat/src/host/codex.ts (SYKA_MCP_TOOLS/appServerArgs). Los modelos generativos no corresponden a herramientas MCP independientes en este catálogo: parte de su interfaz es generate.*/transform.* en JSX, bloqueada por el adaptador local.

## Herramientas propias y edición

El chat recibe 10 herramientas dinámicas adicionales: seis de fuente/referencia/transcripción/deshacer, tres de navegador público y una de resultados de imágenes. Puede modificar propiedades/nodos admitidos por el motor a través de syka_edit_source; no existe una lista que limite esa herramienta a cortes o subtítulos. Sí existen restricciones funcionales:

- Sólo archivos existentes TS/TSX/JS/JSX/JSON, hasta 256 KiB; no creación, listado/búsqueda de fuentes, carpetas o edición multifichero atómica.
- Sin herramienta propia para enumerar/importar/reorganizar assets. Puede referenciar medios conocidos por src; no puede leer assets.yml con syka_read_source porque YAML no está admitido.
- La referencia incluida es legible ahora con syka_read_reference, pero sólo Markdown. Los ejemplos .tsx/.js externos al proyecto no son legibles mediante esa herramienta.
- Deshacer compartido cubre fuente; no cubre assets/export/movimientos de archivos.
- El glosario se aplica desde UI/nuevas transcripciones; el chat no dispone de herramientas de CRUD del glosario.

## Capacidades Codex

Autenticación forzada ChatGPT, sin fallback API. Búsqueda web live habilitada. Imagen nativa habilitada y adaptador de persistencia implementado; disponibilidad efectiva depende de las herramientas que la cuenta/runtime entreguen y de que entregue bytes o archivo dentro del proyecto. El adaptador rechaza savedPath externo. No asumir idénticas herramientas a Codex Desktop.

BrowserTools: navegador público aislado, abrir/leer/capturar; sin clicks, formularios, cuentas privadas, uploads/downloads ni navegación en el navegador personal. Computer-use/browser-use nativos desactivados. Shell/unified_exec desactivados: no puede instalar librerías ni ejecutar scripts/CLI arbitrarios desde el chat. Apps/plugins/MCP externos/subagentes/hooks/memorias y descubrimiento automático de skills desactivados; las skills editor/watch se pueden consultar como documentos, no hay instalación/ejecución automática de skills personales.

La sesión se cierra después de 10 minutos inactiva; al reconstruirse el contexto conserva hasta 20 mensajes usuario/asistente, cada uno hasta 2.000 caracteres y 16.000 caracteres combinados, sin resultados de herramientas. No es continuidad completa del chat. No se alteran los límites del plan del usuario; son límites del adaptador y del runtime.

## Inconsistencias detectadas

INSTRUCTIONS.md y el error CLOUD_DISABLED todavía dicen que el puente de imagen Codex no existe, aunque GeneratedImages y el flag image_generation ya están implementados. Es información obsoleta, no prueba de generación exitosa. editor.md recomienda screenshot/logs/SAM2/export que el allowlist del chat no expone. Parte de la documentación upstream también puede describir proveedores desconectados. Esto induce respuestas contradictorias y elección de herramientas imposibles.

## Orden recomendado, pendiente de implementación

1. Exponer screenshot/logs locales y corregir instrucciones/capability map para coincidir con las herramientas realmente expuestas.
2. Export solicitado por el usuario con salida nueva en 02 Finales; evitar overwrite de masters y trabajos duplicados.
3. Herramientas estructuradas de contexto/selección/listado/importación de assets y creación/listado de fuentes con historial.
4. SAM2: validar descarga/hardware/preview/cancelación y recién después conectarlo al chat.
5. Continuidad mediante brief persistente y lectura guiada de skills/referencias. Integraciones futuras de proveedores separadas de la suscripción.

No conviene habilitar todo el catálogo a ciegas: report hace una escritura externa y media_listen/modelos/voices no se recuperan con una simple opción.
