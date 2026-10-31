# Selector y catálogos de modelos — 05/10/2026

Configuración → Modelos e IA → Modelos visibles permite mostrar/ocultar Codex, Gemini/Antigravity, Claude, Hermes, Cursor y Grok. Muse continúa desactivado. Dentro de Hermes hay controles por proveedor de routing, incluidos OpenRouter, suscripción ChatGPT/Codex y endpoints personalizados como 9Router. Se agrupan por los IDs anunciados por Hermes, no por una lista fija de marcas.

Las preferencias se guardan en el store local existente (`agentChat.modelVisibility`). Ocultar no desconecta, no elimina credenciales ni historial y no modifica el catálogo del host. Los chats existentes conservan su modelo y su nombre visible, aunque su catálogo esté oculto. Los nuevos chats eligen sólo entre modelos visibles; si el default de un proveedor está oculto, se usa su primera opción visible. Los controles permanecen accesibles desde configuración aunque se oculte todo.

En esta instalación se ocultó OpenRouter por el pedido del usuario. QA nativo: Hermes anuncia 108 modelos, 59 de OpenRouter; quedan 49 de Hermes y 68 opciones en el menú completo. Ocultar/restaurar, conservar la selección y persistencia en almacenamiento verificados; 0 errores del renderer. Seis pruebas de agrupación, filtros, datos persistidos y endpoints personalizados. TypeScript y build web pasan. Evidencia local: `output/playwright/model-visibility-verification.json`, `model-visibility.png`, `filtered-model-menu.png`.

## 9Router: configuración no equivale a inferencia validada

9Router local 0.5.45 sigue escuchando en 20128. GET de `/v1/models` respondió y anuncia, entre otros, `ag/claude-opus-4-6-thinking` y `ag/claude-sonnet-4-6`; no anuncia Opus 5.5 en esa respuesta. Hermes ya ofrece la ruta `custom:9router:…`. No se agregó un endpoint redundante ni se modificaron perfiles, cuentas o claves. No se envió ningún prompt a 9Router ni a Claude: el usuario aclaró que el test de 9Router había fallado y que Claude se probará después.

El proyecto 9Router transforma solicitudes OpenAI compatibles a las APIs del proveedor. Su ejecutor Antigravity utiliza OAuth Bearer y el backend de generación del IDE, mientras Syka utiliza el conector ACP oficial. Son rutas distintas y no implican el mismo catálogo. El catálogo de 9Router incluye IDs definidos por su adaptador; por sí solo no verifica que el modelo responda o que haya cuota.

Fuentes de implementación pública consultadas: https://github.com/decolua/9router/blob/master/open-sse/executors/antigravity.js y https://github.com/decolua/9router/blob/master/open-sse/providers/registry/antigravity.js. El upstream actual no se presentó como la versión instalada: el binario local es 0.5.45. Antigravity ACP 1.2.1 y una prueba aislada de 1.3.0 anunciaron sólo los mismos 11 modelos Gemini; no se inventaron IDs de Opus.
