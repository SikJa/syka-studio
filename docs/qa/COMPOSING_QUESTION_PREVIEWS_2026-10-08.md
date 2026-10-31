# Pregunta de motion: cuatro previews de composing

## Alcance

Cuatro prototipos interactivos para evaluar cómo el orbe avisa y abre una pregunta obligatoria dentro del chat. Reutilizan `AgentIdentityOrb` y el estado `SYKA_ORB_STATE = composing` de Syka, con Inter incluida en la aplicación. No modifican el chat de producción, los proveedores, el motor Diffusion ni la política del agente.

1. **Foco:** el orbe concentra la atención en el centro y presenta la pregunta debajo.
2. **Órbita:** trayectoria circular y badge de una pregunta pendiente; se detiene antes de responder.
3. **Acople:** el orbe sube desde el composer y se acopla a un panel de pregunta.
4. **Lienzo:** todo el panel del chat se convierte en el espacio para responder.

Las cuatro muestran pensamiento, aviso, espera, elección y retorno al chat. La espera no tiene timeout ni respuesta automática. Las alternativas y la continuación son una simulación explícita: no se genera ningún video ni se llama a un proveedor.

## Entregables

Directorio: `F:/Coding Proyects/Syka Clips/Pruebas Syka/Composing-pregunta-4-previews-2026-10-08`.

- `index.html`: selector interactivo de las cuatro propuestas.
- `preview-portable.html`: un único HTML con CSS, JavaScript y fuente incluidos. No necesita un servidor ni los otros archivos.
- `gallery.html`: cuatro propuestas interactivas en una grilla de dos columnas.
- `Syka-composing-4-previews.mp4`: comparación simultánea de las cuatro entradas, respuestas y salidas, 1920×1010, H.264, 30 fps, 9,333 s, sin audio.
- `01-Foco.mp4`, `02-Orbita.mp4`, `03-Acople.mp4`, `04-Lienzo.mp4`: grabaciones individuales para ver cada propuesta con más tamaño.
- `comparison-question.png`, `gallery-question.png` y cuatro `0N-question.png`: capturas de las propuestas esperando respuesta.
- `verification.json` y `comparison-verification.json`: evidencia de interacción, portabilidad y export.

Comparativo en Drive: [Syka - Composing - Cuatro previews.mp4](https://drive.google.com/file/d/1MQ6n4p4BlZkD_CyBJZbAU3JI4IGNkMbh/view).

## Comprobaciones realizadas

Chrome real, perfil efímero, cuatro propuestas y ancho móvil de 390 px:

- El canvas del orbe cambia entre capturas con movimiento normal.
- El fondo del chat tiene `inert`; composer, sesión, adjuntos y envío están deshabilitados mientras la pregunta está pendiente.
- Escape no cierra la pregunta; Tab y Shift+Tab mantienen el foco dentro de la pregunta.
- El botón de continuar exige una opción, delegación explícita o texto libre no vacío.
- Después de responder, el fondo deja de estar inerte y el composer recupera el foco.
- Con movimiento reducido, el canvas queda pausado y sigue funcionando la respuesta.
- No hubo errores JavaScript; los botones y pies de la pregunta quedan dentro del panel en las cuatro propuestas y en móvil.
- El HTML portátil se copió solo a un directorio temporal vacío y se abrió por `file:`. Inter cargó, el canvas se animó y la respuesta desbloqueó el chat; cero requests fallidas.
- El comparativo se inspeccionó visualmente, se comprobó con ffprobe y se decodificó. La apreciación estética final corresponde al usuario.

## Reproducir

Desde `F:/Coding Proyects/Syka Clips/diffusion-studio`:

```powershell
node docs/qa/previews/composing-question/build.mjs
node docs/qa/previews/composing-question/serve.mjs 'F:\Coding Proyects\Syka Clips\Pruebas Syka\Composing-pregunta-4-previews-2026-10-08' 5331
```

Abrir `http://127.0.0.1:5331/`. Alternativamente, abrir `preview-portable.html` directamente en Chrome. Los controles para cambiar propuesta y repetir son herramientas de comparación externas al panel del chat.

## Prompt y siguiente integración

El formato y el ejemplo completo están en `docs/research/SUPERPROMPT_MOTION_V2_2026-10-08.md`: contrato JSON para datos validables y documento creativo extenso generado del mismo plan. Incluye referencias con procedencia, copy, jerarquía tipográfica, storyboard, coreografía de entrada/lectura/salida, música, cues, capacidades nativas y revisión.

Antes de activar esta función hace falta elegir la presentación, implementar el contrato y el ciclo de pregunta/respuesta en el host de Syka, y validar turnos reales de los proveedores habilitados. El requisito de preguntar debe pertenecer al host para conservarlo al cambiar de modelo. Estas previews no prueban esa integración.
