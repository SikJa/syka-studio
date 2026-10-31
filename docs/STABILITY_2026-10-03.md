# Estabilización de Syka Clips — 2026-10-03

## Resultado

Corregidos los menús de chats, proyectos y organización de la sidebar. La revisión automatizada amplia terminó con 270 pruebas correctas en 47 archivos. Los chequeos de tipos de web, desktop y agent-chat y la compilación web terminaron correctamente.

## Correcciones

- Los desplegables se renderizan en un portal fuera de la sidebar animada. Antes, su posición relativa a la ventana se alteraba por el transform del contenedor. Ahora se ajustan a los bordes disponibles y abren hacia arriba cuando corresponde.
- El selector de proyecto del chat usa una lista oscura integrada, con estado actual, proyectos disponibles y asignación real. Conserva las acciones existentes del menú.
- Menús de proyectos y organización comparten posicionamiento, cierre al hacer clic afuera, navegación por teclado y restauración del foco. Solo puede quedar uno abierto; cerrar la sidebar también los desmonta. Escape dentro del menú o un modal no cierra accidentalmente la sidebar.
- Corregida la agrupación en una sola lista: se comparaba un valor distinto del utilizado por la configuración. Fijar un proyecto ahora también lo mueve al inicio.
- Las preferencias dañadas se normalizan. Un catálogo de proyectos inválido produce un error visible en lugar de convertirse silenciosamente en una lista vacía que pueda sobrescribir datos. Las actualizaciones leen el último estado persistido y se sincronizan entre ventanas mediante eventos storage.
- Los fallos al crear un chat o copiar aparecen como errores visibles y no quedan como promesas rechazadas sin manejar.
- Nuevo chat permanece visible mientras la decoración MetalFx espera su primer frame; la animación gráfica se conserva.

## Verificación

Comando de regresión ejecutado desde diffusion-studio:

```powershell
npx vitest run --config apps/desktop/vitest.config.ts apps/desktop/src apps/desktop/test packages/agent-chat/test apps/web/src/agent-chat apps/web/src/engine/camera.test.ts apps/web/src/components/dashboard/glossary-model.test.ts --maxWorkers=3
```

Resultado: 270/270 pruebas, 47 archivos. Cobertura de historial y Deshacer, timeline, puente de herramientas, proyectos, chat, skills y componentes del editor. Las integraciones externas de estos tests usan sus dobles de prueba; no equivalen a una ejecución real de edición por el modelo.

También pasaron npm run check para los workspaces @diffusionstudio/web, @diffusionstudio/desktop y @diffusionstudio/agent-chat. La última compilación web terminó en 23.04 s. Log: ../.runtime/diffusion/stability-build-2026-10-03.log.

La prueba visual aislada /qa/chat-menus.html monta los componentes reales con datos ficticios y namespace qa-menus-stability. Se verificaron asignación entre proyectos, apertura cerca del borde inferior, lista única, edición de proyecto, Escape/foco, un único menú, cierre de sidebar, errores visibles, fijación, persistencia al recargar y sincronización entre dos ventanas. La consola de la pasada final no mostró errores.

Captura: ../.runtime/diffusion/qa/stability-2026-10-03/menu-proyecto.jpg. Es evidencia del componente en QA, no del catálogo del usuario.

## Ajustes de pruebas

Una expectativa antigua de codex-media contradice la política nativa actual de shell/unified_exec y se actualizó sin cambiar permisos del runtime. Una prueba de compilación fría del historial excedía 5 s incluso aislada; se dio un límite de 20 s solo a ese caso, conservando las verificaciones de historial/Deshacer. Dos requests nuevos de tests enviaban chatId null donde el protocolo espera omitirlo; se corrigieron los tests.

## Alcance y pendientes

Se preservaron los cambios existentes y las composiciones del usuario. Esta revisión no ejecutó skills sobre sus videos ni envió solicitudes nuevas al proveedor; tampoco entrenó el modelo ni desplegó cambios.

Queda una advertencia de tamaño de bundles: el principal ronda 2.98 MB minificado y la decoración CRT 511 KB. La compilación funciona; dividir cargas es una mejora de rendimiento pendiente. La próxima etapa debe validar skills y procesos con tareas reales de edición y resultados esperados antes de hablar de entrenamiento. Esta revisión cubre las regresiones comprobadas, no garantiza ausencia de todos los bugs posibles.
