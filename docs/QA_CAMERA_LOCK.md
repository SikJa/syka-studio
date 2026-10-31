# Candado de navegación del lienzo

El botón junto al porcentaje de zoom bloquea y desbloquea la navegación de la vista: rueda, Ctrl/Meta+rueda, arrastre con botón central, Espacio/mano y comandos de zoom del menú o teclado. Un bloqueo iniciado durante un arrastre cancela ese gesto. Las opciones de zoom aparecen deshabilitadas mientras está cerrado.

Es estado local de la sesión del editor (`CameraNavigation`), sin atributo nuevo en el proyecto ni paso en Deshacer. Abrir un editor nuevo comienza desbloqueado. No modifica propiedades de clips ni el motor de captura/exportación. La creación de una escena respeta el bloqueo y evita su enfoque automático.

## Evidencia

`node output/playwright/camera-lock/verify.mjs` crea una copia QA en D, levanta Electron y Vite propios en 5198 y los cierra al finalizar. Perfil, caché y evidencia permanecen en F. No modifica el proyecto de la sesión compartida.

El reporte `output/playwright/camera-lock/report.json` confirma:

- Cámara y fuente idénticas tras rueda, Ctrl+rueda, Ctrl+0, Ctrl+1, acercar, arrastre central y Espacio+arrastre con el candado cerrado.
- Duplicación de un clip operativa con la vista bloqueada.
- Al desbloquear, rueda y zoom funcionan nuevamente.
- Activar el candado interrumpe un pan en curso.
- Cero errores de página en Electron.

Los cuatro tests focales de `apps/web/src/engine/camera.test.ts` y el build web pasaron. No se necesitó un nuevo render MP4 para una preferencia de navegación del editor.
