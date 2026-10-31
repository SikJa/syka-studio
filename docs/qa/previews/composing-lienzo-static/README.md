# Pregunta dentro del chat — mockup visual

La pregunta ocupa un espacio del chat existente. El historial sigue visible, el fondo conserva `--background: hsla(0, 0%, 7%, 1)` de Syka y hay una sola instancia del composer compartido. No se instala un flujo de agente ni se llama a un modelo.

La vista abre en reposo para revisar composición, colores y controles. **Probar entrada** habilita el audio con el gesto del usuario y presenta un orbe de 104 px en el lugar de la pregunta. El orbe del encabezado mantiene su posición. La entrada combina escala de 0.91 a 1, opacidad y un desenfoque de 1.5 a 0 px en 340 ms; no hay traslado entre el encabezado y la pregunta. El aviso original de dos notas dura 230 ms y comienza 80 ms después de la aparición. Pregunta y opciones entran con los tokens de `transitions-dev`. Al enviar, el orbe de la pregunta se disuelve en el lugar; la continuación es simulada.

## Componentes y fuentes

- Botón importado directamente del lab: `F:/Coding Proyects/Recursos frontend para sistemas/labs/component-lab/src/components/base/buttons/button.tsx`, variante Board UI secundaria, tamaño pequeño. Adaptación de tokens a Syka: 32 px de altura, radio de 8 px, iconos Lucide de 14 px con acentos de color. No se cambia el lab.
- `apps/web/src/mirel-chat/features/agents/agent-composer.tsx`: composer nativo con archivos y el control nativo de dictado. El dictado necesita la conexión de escritorio y su proveedor configurado; este HTML no establece esa conexión.
- `apps/web/src/mirel-chat/features/agents/agent-identity-orb.tsx`: orbe nativo, estado `composing`.
- `apps/web/src/index.css` y `apps/web/src/agent-chat/mirel-adapter.css`: colores actuales del chat y superficie del composer (`#202022`).
- `transitions-dev/03-notification-badge.md`, `06-modal.md` y `18-texts-reveal.md`: badge, escala con opacidad adaptada a la aparición del orbe y entrada de texto, con guardas de movimiento reducido. El hook `t-modal` solo aporta el movimiento; la pregunta sigue integrada al chat.
- Se consultó la página oficial de presentación de Codex y el paquete local instalado. No se obtuvo una captura de su widget de preguntas; este mockup adapta los componentes del lab a Syka y no afirma ser una copia pixel a pixel de Codex.

## Construcción y salida

`node docs/qa/previews/composing-lienzo-static/build.mjs`

Salida dentro del servidor de previews existente: `../Pruebas Syka/Composing-Lienzo-v2-2026-10-08/mockup/`. `Syka-pregunta-mockup.html` incluye CSS, JS y la fuente, y se puede abrir por separado. Solo la construcción del mockup requiere el lab local.
