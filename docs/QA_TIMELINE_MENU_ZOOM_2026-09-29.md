# Menú del clip y zoom del editor — QA local

El zoom del canvas está en `TimelineToolbar`, junto a las herramientas inferiores. El inspector ya no tiene un duplicado. **Ajustar a escena activa** encuadra el video que se está editando; **Ver todo el lienzo** muestra el conjunto de escenas y objetos sueltos.

El clic derecho sobre la barra de un clip abre las acciones del editor, incluyendo **Separar audio**. La búsqueda del clip usa las regiones dibujadas por la timeline, sus transformaciones y el factor de píxeles de la pantalla; no deduce el clip a partir de una fila del DOM.

## Reproducción manual

1. Abrir una copia QA del proyecto, con dos videos con audio en pistas distintas. Seleccionar el primero.
2. En la barra inferior, abrir **Editor / porcentaje**. Probar 50%, 100%, 200%, Acercar, Alejar, Ajustar a escena activa y Ver todo el lienzo. El porcentaje cambia y el canvas responde. Ctrl+0 vuelve a 100%; Ctrl+1 encuadra la escena activa. Si no hay escena activa, ajustar usa el contenido del lienzo.
3. Hacer clic derecho directamente sobre la barra del segundo video, sin seleccionarlo previamente. Debe aparecer **Separar audio**, habilitado. No debe salir el menú genérico de copiar/pegar del navegador.
4. Elegir **Separar audio**. Se crea audio con el mismo recurso, posición, recorte y velocidad; queda silenciado el segundo video. El primer video no cambia.
5. Usar **Deshacer** una vez. Se elimina el audio nuevo y se restablece el mute del segundo video en la misma operación.
6. Cerrar el menú con Escape: conserva la selección. Seleccionar dos clips con Shift+clic. Hacer clic derecho sobre uno de los seleccionados: mantiene la selección múltiple y deshabilita **Separar audio** con la explicación de que necesita un solo clip de video.
7. Hacer clic derecho en un espacio vacío de la timeline: Duplicar, Borrar y Separar audio quedan deshabilitados. No opera accidentalmente sobre una selección anterior.

## Automatización local

`node output/playwright/timeline-menu-zoom/verify.mjs` crea una copia aislada bajo `D:/Syka Media/05 🧩 Proyectos creativos/Syka Clips/Personal/QA-timeline-menu-zoom-*`, usa un perfil Electron propio bajo `F:/Coding Proyects/Syka Clips/diffusion-studio/output/playwright/timeline-menu-zoom`, y ejecuta Vite en el puerto 5196 con HMR desactivado. Cierra su Electron y su servidor al terminar; no reinicia ni cambia el proyecto abierto en la sesión compartida.

La copia parte de `Personal/QA-timeline-2026-09-29`. `report.json` identifica la ruta exacta de la última ejecución. Las capturas PNG, el DOM inicial y el reporte quedan junto al script. La comprobación persiste el resultado y lee `index.tsx`, además de usar botones y menús reales.

Pruebas unitarias: `npx.cmd vitest run --config apps/desktop/vitest.config.ts apps/desktop/test/timeline-context-menu.test.ts apps/desktop/test/timeline-audio-command.test.ts`. Cubren hit-testing con DPR/transformación, orden de regiones, selección del objetivo, multiselección, separación alineada y error de inserción sin mutear el original.

Nota de desarrollo: un refresh de Solid durante una prueba en el Vite compartido puede reemplazar el contexto `EditorApiProvider`. La ejecución final de QA usa HMR desactivado para no mezclar esa actualización de módulos con las acciones del proyecto.

## Resultado del 29/09/2026

- 8/8 pruebas unitarias de los dos archivos focalizados aprobadas.
- Build web aprobado con TypeScript y Vite; permanece el aviso conocido de tamaño de chunks.
- QA Electron real aprobada, sin errores de página: zoom, selección por clic derecho, separación de audio, undo único, Escape sin deseleccionar, multiselección y espacio vacío.
- Proyecto de esa ejecución: `D:/Syka Media/05 🧩 Proyectos creativos/Syka Clips/Personal/QA-timeline-menu-zoom-1790735237311`.
- El proceso Electron aislado y el servidor 5196 finalizaron. No se reinició el runtime compartido.
