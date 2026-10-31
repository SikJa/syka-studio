# Zoom, menú de clips, glosario y preview

## Implementado

- El control Editor/zoom está en la barra inferior de herramientas. «Ajustar a escena activa» (Ctrl+1) encuadra la escena que se está editando: otras escenas y objetos exteriores ya no achican el preview. «Ver todo el lienzo» conserva la vista general; sin escena activa, el ajuste usa esa vista. Conserva escala, acercar/alejar y 50/100/200%.
- Candado junto al porcentaje: bloquea zoom y desplazamiento del lienzo, incluidos rueda, arrastre y atajos; sigue permitiendo editar clips. Estado de la sesión, sin cambiar el proyecto/export ni agregar historial. QA real y límites en `QA_CAMERA_LOCK.md`.
- El clic derecho sobre la timeline identifica el clip bajo el puntero; incluye Separar audio, preserva multiselección y muestra por qué una acción no está disponible. Escape conserva la selección. Audio y silencio del video comparten un paso de Deshacer.
- Configuración → Glosario, accesible desde dashboard y menú del editor: términos preferidos, variantes, búsqueda, edición, borrado y activación. Persistencia local en F, guardado atómico y protección de cambios concurrentes. Groq recibe hasta 200 bytes de términos; la corrección local aplica variantes a nuevas transcripciones/captions conservando tiempos reales. Las transcripciones existentes no se regeneran automáticamente.
- La escena activa se dibuja al frente en el lienzo de edición, sin reordenar el proyecto ni cambiar el orden de exportación. La resolución de medios espera la carga de biblioteca y admite archivos existentes en la raíz del proyecto.
- Los medios ausentes muestran un aviso sobre el canvas y una acción Reenlazar con selector de archivo. Se persiste la biblioteca antes de escribir el src; la modificación de fuente se deshace desde el historial compartido.

## Causa del preview del proyecto del usuario

Había una escena vacía negra superpuesta a la activa. Además, el video importado de 1920×1080 quedó desplazado (-710, -180) dentro de una escena de 640×360: el recorte mostraba el panel oscuro de la propia grabación, dejando la cara afuera. El decoder y el dibujo de ese video funcionaban. La comparación del recorte dio cero diferencias respecto del fotograma esperado.

Se probó el encaje solamente del clip `dxhl7m` a 640×360, posición (0, 0), y la cámara del editor mediante SourceTools y SHA de fuente verificado. Entrada compartida de Deshacer `7ec1dd00-42ea-4187-8d58-2a5b9ef253f7`. Después, durante las pruebas manuales del usuario, el proyecto volvió a presentar el tamaño y desplazamiento originales; no se reaplicó esa modificación. Ajustar el zoom cambia la vista, no el encuadre ni el tamaño del clip dentro del video.

Las referencias viejas `assets/syka-test-source.mp4` y `syka-test-source.mp4` apuntan a archivos que ya no están en este proyecto. No se sustituyeron automáticamente por otro archivo. El aviso permite reenlazarlas.

## Verificación

- Suite desktop: 143 tests; resolución de biblioteca: 1 test adicional. Tests de menú/audio y modelo de glosario focalizados. TypeScript desktop, web, assets y runtime.
- Electron aislado: zoom y atajos; clic derecho sobre clip alternativo, trim/velocidad, separación y undo; multiselección, Escape y canvas vacío. Reporte `output/playwright/timeline-menu-zoom/report.json`.
- Regresión de ajuste con escena activa de 640×360, escena negra hermana de 1920×1080 y objeto exterior: escena centrada, ajuste estable y Ctrl+1 idéntico al menú. Vista general 42%, escena activa 100% en viewport 970×639; video visible, Escape conserva selección y cero errores de página. Reporte `output/playwright/zoom-active-scene/report.json`; 3 tests focales cubren cambio de escena, fallback sin activa y vista general explícita.
- Electron aislado: altas/variantes/búsqueda/edición/toggle/borrado, errores y conflicto de revisión; glosario persistente tras reiniciar. Reporte workspace `.runtime/diffusion/qa-ui/glossary/report.json`.
- Copia del proyecto del usuario: preview visible; selector real reenlaza una fuente sin tocar la otra y un Undo la restaura. Reporte workspace `.runtime/diffusion/qa-ui/preview/after.json`. Los errores de fuente faltante registrados son esperados.
- Seek 0, 0.633, 2 y 3 segundos: fotogramas completos. Preview y captura offline de la escena difieren menos de 0.78/255 de media por downsampling. Reporte workspace `.runtime/diffusion/qa-ui/preview-fit/after.json`.

No se hizo una llamada real a Groq ni una nueva exportación MP4 completa. Se verificaron requests simulados, corrección, caché y capturas del motor real. Remotion Studio se detuvo por pedido del usuario.
