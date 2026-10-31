# Editor y revisión de El Mago — 2026-10-02

## Implementado en Syka Clips

- Navegación del lienzo bloqueada por defecto. El encuadre inicial conserva la composición principal y se reajusta al redimensionar la vista bloqueada.
- Transporte debajo del preview: inicio, cuadro anterior/siguiente, reproducir/pausar y velocidad de preview 0.5×/1×/1.5×/2×/4×. No modifica velocidad de clips ni exportaciones.
- Tools y reasoning se muestran sólo durante la tarea actual (incluida una pausa por pregunta). Al terminar, el transcript muestra los mensajes y resultados; el registro durable de actividad se conserva.
- Sidebar del editor sin cambios de tamaño, según la última indicación.

Validación: TypeScript web sin errores; seis pruebas en camera.test y transcript-visibility.test; Electron aislado con dos escenas confirmó bloqueo inicial, controles, selección de velocidad y bloqueo de rueda, sin errores de consola. Evidencia: `output/playwright/transport-defaults/report.json`, `preview.png`. Una primera ejecución falló por optimización inicial de Vite; la repetición pasó.

## El Mago: análisis, sin integración

Ampliación de lectura material: existe el perfil `C:/Users/Sikora/AppData/Local/hermes/profiles/el-mago/skills`. Se leyeron sus SKILL.md reales, incluidos el workflow versión 1.1.0, Reel vertical, YouTube longform y captions. No confundir los archivos instalados con el inventario efectivo habilitado de Hermes. El workflow obliga a inspeccionar el proyecto real, cargar sólo skills pertinentes, preservar fuentes y hashes, usar D:/Syka Media para originales/finales/assets y mantener versiones/rollback. Longform conserva casi todo el discurso, evita recortes agresivos, usa captions selectivos y exige comparar el audio A/B. Captions conserva transcript crudo y revisado, timings de palabras, remapea después de cortes y verifica límites/duración/sincronía.

Fuentes locales: Syka Creator System/docs/handoffs/SYKA_INTEGRATION_CURRENT_STATE.md; docs/creative-system/EL_MAGO_SKILLS_RUNTIME_2026-08-14.md; EL_MAGO_STUDIO_V2_2026-08-13.md; PROJECT_PLAN_V3.md.

Código verificado: apps/api/src/agents/elen-creative-project-chat-service.ts enruta module=mago al perfil `el-mago` y exige consultar su inventario y cargar el workflow; existen mago-audiovisual-workflow-service.ts y mago-workspace-mcp.ts. Creator Core sigue en apps/api/.data/creator-core.sqlite.

El handoff de agosto declara 40 skills (31 locales + 9 Hermes). Esa cifra es histórica, no un inventario vivo confirmado hoy. Contratos centrales: syka-el-mago-project-workflow, sikora-caption-pipeline, sikora-remotion-base-composition y sikora-render-workflow. Especializaciones relevantes: Reel, YouTube largo, thumbnails, motion y audio/music/media. Opcionales ComfyUI/TouchDesigner requieren verificar su runtime por separado.

ProjectPlan V3 es su estado canónico: fuentes/provenance, cortes por frames, transcript y captions, audio/motion, revisiones, preview/render/export y rollback. Su adaptación futura a Diffusion requiere traducir operaciones y estado: las instrucciones para Remotion no deben copiarse suponiendo compatibilidad del motor.

Se consultó el chat existente `Integración Syka — Continuidad limpia` (01a02f94-ad9c-7271-8180-0aa9c9943d23), con autorización del usuario y pedido de lectura. Su informe previo coincide con los contratos. No se importaron skills ni se modificó Creator System.

## Proyectos/chats de Codex

Lectura de state_5.sqlite: nueve proyectos locales, incluidos Syka Creator System y Syka Clips, con sus project_roots. Los chats de Creator System siguen presentes y el chat de Integración puede leerse mediante la herramienta de Codex. No hay evidencia de eliminación de esos datos.

list_projects no devuelve proyectos locales, sólo siete de ChatGPT. local-projects del estado global está vacío y la migración a app-server está marcada como realizada; no alcanza para determinar el fallo de listado. Se activó agrupación por proyecto, pero el listado siguió sin devolver los locales. Recuperación visual pendiente; no se reescribió la DB ni el estado global de la app en ejecución.

Inspección posterior de accesibilidad: la ventana local está en vista de actividad (`Cerrar vista de actividad`), que sustituye la lista normal. El código instalado confirma el atajo nativo `Ctrl+Alt+U` (`togglePriorityFilter`). La automatización de clic falló por geometría no disponible y la captura WGC por RPC 0x800706BE. Al intentar el atajo, el controlador rechazó entrada por interacción del usuario; luego la ventana quedó minimizada. No se confirmó la salida de esa vista ni se declara restauración visual lograda.

Selector de velocidad refinado: botón único con etiqueta y chevron integrados, menú de opciones con selección visible y animación scoped basada en transitions-dev; respeta reduced motion. TypeScript pasó y Electron aislado verificó selección 2×, play/pausa y conservación de velocidad.
