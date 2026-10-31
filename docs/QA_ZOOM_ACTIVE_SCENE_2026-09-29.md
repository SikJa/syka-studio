# Ajustar la escena activa

El comando que antes se llamaba **Ajustar a contenido** encuadraba todo el lienzo. Una escena hermana grande podía reducir el video activo hasta convertirlo en una miniatura.

El menú inferior ahora distingue:

- **Ajustar a escena activa** — Ctrl+1. Usa el marco de la escena activa; si no hay una, usa el contenido del lienzo.
- **Ver todo el lienzo** — sin atajo. Mantiene la vista general de todas las escenas y objetos sueltos.

Los comandos comparten la cámara del editor. Escape cierra este menú sin limpiar la selección del clip. El ajuste conserva la política existente de no ampliar por encima del 100%.

## Reproducción

1. Abrir una copia QA con una escena activa de 640×360, un elemento hijo de 1920×1080 fuera de ese cuadro y otra escena negra de 1920×1080 situada en `x=-718`, `y=-154`.
2. Elegir **Ver todo el lienzo**: el encuadre incluye el conjunto grande.
3. Elegir **Ajustar a escena activa**: el video de 640×360 queda centrado y legible. Las dimensiones de la otra escena no reducen su zoom.
4. Volver a ver todo el lienzo y usar Ctrl+1. La matriz de cámara debe coincidir con la del ajuste por menú.
5. Abrir el menú y cerrar con Escape. El clip conserva su selección.

## Verificación automatizada

Ejecutar `node output/playwright/zoom-active-scene/verify.mjs` desde la raíz del repositorio. Crea una copia de `QA-timeline-2026-09-29` bajo el contrato de medios en D, levanta su propio Electron oculto y Vite en 5197 con HMR desactivado, y los cierra al terminar. Los perfiles, caché y evidencia quedan bajo `output/playwright/zoom-active-scene` en F.

El reporte verifica la matriz persistida en `index.tsx`, el centrado contra las dimensiones reales del canvas, los píxeles renderizados para detectar una pantalla negra, el atajo y el cierre del menú. No modifica el proyecto que esté abierto en la sesión compartida.

## Resultado local

QA Electron aprobada sin errores de página. Con un canvas de 970×639:

- Lienzo completo: cámara `[0.42, 0, 0, 0.42, 382.91, 156.66]`.
- Escena activa por menú y Ctrl+1: `[1, 0, 0, 1, 165, 139.5]`; el marco 640×360 queda centrado exactamente.
- Muestreo central del canvas: 38.231 de 38.400 píxeles coloridos; el video no quedó tapado por la escena negra.
- Escape cerró el menú sin quitar `selected` del video.
- Build web aprobado; permanece el aviso conocido de tamaño de chunks.

Proyecto aislado: `D:/Syka Media/05 🧩 Proyectos creativos/Syka Clips/Personal/QA-zoom-active-scene-1790736208892`. `output/playwright/zoom-active-scene/report.json` contiene la evidencia y las capturas están en la misma carpeta. El proceso Electron y el servidor 5197 finalizaron.
