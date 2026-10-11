# Orbe animado del README

`readme-orb-dark.webp` y `readme-orb-light.webp` exportan el motor original del orbe de Syka: el mismo `MODE_DRAWS` que usa `AgentOrbCanvas` para `AgentIdentityOrb` en su variante `hero`. Conservan el preset 64, el estado `composing` y la velocidad 0.45.

Los WebP animados miden 128 × 128 píxeles, tienen 895 cuadros a 15 fps y repiten el ciclo completo de aproximadamente 59,67 segundos. Se muestran a 116 × 116 en los tres README. Conservan la transparencia del canvas; el elemento `picture` selecciona la paleta nativa clara u oscura, sin un rectángulo de fondo. Se muestrea el mismo ciclo a 15 fps para reducir el peso sin cambiar su velocidad.

Para regenerar: `node scripts/render-readme-orb.mjs`. Requiere las dependencias de desarrollo, FFmpeg y Chromium disponible para Playwright. Se puede indicar su ejecutable mediante `SYKA_ASSET_BROWSER`. La captura usa un navegador independiente y un servidor local efímero.

La codificación WebP sin pérdida conserva los colores y la transparencia originales, con un solo hilo por encoder para limitar el uso de recursos.

Los botones de descarga se generan con `node scripts/render-readme-download.mjs`: SVG vectorial con reflejos animados, texto legible y una variante sin el reflejo móvil cuando se solicita reducir el movimiento.

El motor `thinking-orbs` conserva su [aviso MIT](LICENSE.thinking-orbs.txt). Los componentes de integración y la identidad de Syka mantienen las licencias y los créditos del repositorio.
