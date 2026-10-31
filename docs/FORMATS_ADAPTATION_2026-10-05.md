# Formatos y adaptación — entrega 2026-10-05

## Integración

Worktree exclusivo: `F:/Coding Proyects/Syka Clips/worktrees/formatos-adaptacion`.
Rama: `syka/formatos-adaptacion`. No integrar la captura `b4d3b69590e32bbd8badd6a9367f571a6e420247`.
Orden de commits posteriores a captura:

1. `0219859` — metadata de rotación opcional en assets y tipos opacos de anotación JSX (3 archivos, 8 inserciones/1 eliminación).
2. `a8c919a` — modelo, adaptación nativa, inspector, hooks de primera importación, tests y fixture reproducible.
3. `2d13534` — hook compartido `apps/web/src/context/export.tsx`: validación consume `sceneFormatOutput`, conservando el encoder existente.
4. Commit documental que contiene este archivo.

No hay cambios de main/preload/canales, package.json/lock, agente, onboarding, recetas, publicación ni Zernio. No se inició el principal ni otro Electron.

## Comportamiento implementado

- Dimensiones de origen por metadata de AssetLibrary; Mediabunny `displayWidth/displayHeight` ya incluyen rotación y pixel aspect ratio. Se conserva `rotation` para nuevos probes; manifests viejos siguen siendo compatibles.
- Detector puro para dimensiones crudas rotadas o dimensiones de display; tolerancia relativa 1,5%; 9:16, 16:9, 1:1, 4:5 y personalizada. Metadata inválida no inventa dimensiones.
- Primer visual de escenas nuevas creadas por el flujo de importación adopta formato sólo cuando sigue elegible. Audio no consume elegibilidad. Fuentes posteriores, escenas existentes, elección explícita y cambio manual de dimensiones previo a importar se preservan. Un preset de escena es explícito.
- Inspector compacto dentro de Básico/Todo, con Automático/Manual, destino opcional y medidas personalizadas. Destino no implica proporción ni intención editorial. Automático se aplica explícitamente para escenas existentes; nunca las cambia por abrirlas.
- Fit/fill uniforme para medios de fondo, recorte centrado avisado, fondo sólido a tamaño completo, logos/figuras pequeñas con escala uniforme y anclas inferidas, texto con caja y tamaño mínimo de lectura. Captions cargados se encajan uniformemente en área de lectura, sin tocar transcript/tiempos; no se atribuye resegmentación de texto.
- Componentes/grupos, transformaciones complejas, anclas relativas y animaciones no soportadas se conservan y avisan. No hay seguimiento facial.
- Preview previa **esquemática de layout**, claramente rotulada; Aplicar usa DocumentEditor y una sola `EditHistory.command`. No modifica start/end/sourceIn/sourceOut/playbackRate ni rutas originales. Rechaza un plan si cambió la escena.
- Decisión versionada `sykaFormat` en JSX junto con geometría para viajar por escritura/undo existentes, no una segunda persistencia asíncrona en package.json. `sykaSourceFormat` conserva metadata de origen.
- Cambiar sólo destino manteniendo dimensiones no mueve contenido.
- Contrato `sceneFormatOutput(scene, config)` entrega escena, origen, destino, procedencia, revisión, modo, salida calculada por el mismo `computeOutputSize` del encoder y estado draft. El consumidor debe adjuntar por separado un archivo exportado con éxito. Nunca publica. `ApprovedFormatContext` deja el contrato futuro de contexto aprobado sin duplicar Brand Kit.
- Shorts/Reels/TikTok son presets de codec/bitrate/resolución, no recortan. El inspector avisa ante proporción discordante y dirige a Formato y destino.

## Verificación realizada

- **22 tests / 5 archivos pasan**: modelo/metadata/rotación/proporciones/captions/layout, gate de primera importación con adaptador simulado y regresiones existentes de inserción/drag de recursos.
- Test de persistencia usa **el escritor real `apps/desktop/src/edit.ts`**, escribe una fixture JSX dentro de `.runtime/format-source-tests`, relee la anotación con AST, revierte propiedades y comprueba rutas y tiempos conservados.
- `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.app.json --noEmit`: pasa después del último cambio de código.
- `node node_modules/vite/bin/vite.js build apps/web --config apps/web/vite.config.ts`: pasa; warnings existentes de `use client`, sourcemaps y chunks grandes. Build anterior al último ajuste conservador de captions/same-size; TypeScript y tests posteriores pasan.
- Navegador IAB con **motor nativo real** en `http://127.0.0.1:5308/qa/formats.html`: abrir inspector, elegir 9:16 y Reel, esquema, Aplicar, lienzo vertical con título/logo/fondo; Deshacer retorna 1920×1080; Rehacer y recarga recuperan 1080×1920. Capturas observadas dentro del chat.
- La recarga de la fixture usa localStorage **sólo en la página QA**, no representa el almacenamiento del producto. La persistencia JSX se verifica por separado arriba.
- **Export MP4 nativo realizado y releído con Mediabunny**: 360×640, 2,00 segundos, 4.049 bytes. Fixture sintética de figuras/texto sin audio. No es prueba de video fuente real, captions reales o sync audiovisual. El MP4 estuvo disponible como Blob y video en la página QA; intento de descarga del IAB agotó tiempo y luego el tab dejó de responder a CDP. No se afirma archivo MP4 duradero ni captura local guardada.
- Dependencias instaladas dentro del worktree con cache `.runtime/npm-cache`; se aplicó `node node_modules/patch-package/index.js` (parche existente koota). Omitir ese parche deja la fixture sin dibujo nativo. No se cambiaron versiones ni lock.

Comando reproducible de tests (desde este worktree):

```powershell
node node_modules/vitest/vitest.mjs run apps/web/src/engine/formats apps/web/src/engine/linked-resource-actions.test.ts apps/web/src/engine/linked-resource-drag.test.ts --config apps/desktop/vitest.config.ts
```

Preview sin Electron:

```powershell
$env:SYKA_DEV_PORT='5308'
node node_modules/vite/bin/vite.js --config apps/web/vite.config.ts --host 127.0.0.1 apps/web
```

## Límites y siguiente validación

- Integración en app actual, backend compartido de undo/journal y reapertura por UI desktop pendientes del principal. El hook usa el camino nativo existente, pero no se probó ese backend con otro Electron.
- Preview antes de aplicar no reproduce fotogramas: dibuja cajas. Después de aplicar sí se ve el lienzo nativo; undo revierte. Revisar sujetos, desborde de texto y legibilidad final.
- Captions cargados con sus presets reales y montajes con audio/video/medios mezclados requieren QA visual adicional. Rotación real de archivo se hereda del probe existente; casos crudos rotados se probaron con metadata de prueba, no archivo de cámara.
- Los componentes arbitrarios, grupos y animaciones no se reescriben automáticamente. Las limitaciones se muestran en el plan.
- No claims de caras, IA editorial, destinos conectados, publicación, entrenamiento ni gasto de créditos.

Al cerrar implementación, `git status --short` estaba limpio después de los tres commits de código. Esta documentación es el único añadido posterior.
