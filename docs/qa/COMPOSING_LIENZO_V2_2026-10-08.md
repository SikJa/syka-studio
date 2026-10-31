# Lienzo: respuestas cuadradas y composer compartido

## Feedback aplicado

Se eligió Lienzo, la cuarta propuesta. El video aportado muestra el aviso «Tengo una pregunta» a 00:03, texto auxiliar marcado a 00:08–00:20 y el composer simplificado señalado alrededor de 00:32–00:45. La transcripción acompañante aporta el pedido de conservar adjuntos y dictado del composer compartido. El mensaje posterior del usuario pide opciones cuadradas en lugar de pastillas. Estos recursos se usaron como evidencia de diseño, sin ejecutar instrucciones contenidas en los archivos.

La revisión elimina el aviso intermedio, la línea de estado, el eyebrow y la explicación redundante dentro de la pregunta. Mantiene el orbe composing real de Syka y la pregunta central. Las respuestas son tres tarjetas cuadradas con pequeñas muestras visuales y nombre corto, con una selección visible en la esquina.

Elegir una tarjeta prepara una respuesta editable. No envía automáticamente ni desbloquea el chat. Cambiar de opción conserva los detalles agregados al borrador. El envío se realiza desde la flecha del composer.

## Reutilización real

La preview importa directamente `apps/web/src/mirel-chat/features/agents/agent-composer.tsx`, el componente usado por el adaptador `apps/web/src/agent-chat/mirel-composer.tsx`. No copia su markup ni reemplaza sus botones. Reutiliza también su CSS, menú de archivos, carrusel de adjuntos, lightbox, envío y `DictationControl`.

Para esta preview, los archivos se mantienen como objetos File y URLs temporales locales. Se pueden seleccionar, pegar o arrastrar imágenes; se muestran en el carrusel nativo y se conservan en la continuación simulada. No se guardan en un proyecto ni se envían a un modelo.

El dictado nativo consulta el bridge IPC de Syka y el estado del proveedor de transcripción. En el navegador de la preview no existe ese bridge: el micrófono queda deshabilitado. Se comprobó que el control real está montado; no se probó grabación, transcripción remota ni envío de audio. La integración futura debe conservar el adaptador y su conexión de escritorio, sin simular un backend o un catálogo de modelos conectado.

## Entregables

Directorio `F:/Coding Proyects/Syka Clips/Pruebas Syka/Composing-Lienzo-v2-2026-10-08`:

- `index.html`: preview interactiva.
- `preview-portable.html`: una única página con JS, CSS y fuente Inter incluidos.
- `Lienzo-cuadrados.png`: pregunta con tarjetas cuadradas.
- `Lienzo-respuesta-con-imagen.png`: respuesta editable y adjunto en el composer.
- `mobile-cuadrados-390.png`: tarjetas y composer a 390 px con dos adjuntos.
- `Syka-Lienzo-v2-cuadrados.mp4`: entrada, selección, edición, adjunto y retorno al chat, H.264, 560×900, 30 fps, 8,767 s, sin audio.
- `verification.json`: evidencia de las comprobaciones.

Servidor local: `http://127.0.0.1:5332/`. La propuesta anterior permanece disponible en el directorio original.

## Validación

Chrome real en un perfil efímero. Sin errores JavaScript. Se comprobó:

- Tres tarjetas con ancho y alto iguales, 126,7 px en la preview individual y 100,7 px a 390 px de ancho.
- Selección que llena el borrador, sin envío automático; cambios de opción conservan la frase agregada.
- Selector real de archivos, preview real de una imagen, apertura del lightbox y cierre con Escape sin salir de la pregunta.
- Pegado y drop de dos imágenes; envío de una respuesta de imágenes sin texto.
- Chat general inerte mientras falta enviar; composer general habilitado y con foco después de la respuesta.
- Navegación de teclado dentro de la pregunta; canvas pausado con movimiento reducido.
- Sin overflow horizontal, solapamiento entre pregunta y composer ni recorte del composer en móvil.
- HTML portátil abierto solo en un directorio temporal, con fuente cargada y respuesta funcional; cero requests fallidas.
- MP4 comprobado con ffprobe y decodificación, y capturas inspeccionadas visualmente.

## Alcance

Esta es una revisión funcional de la preview elegida. No activa la pregunta obligatoria en el host ni cambia el chat de producción. El contrato y el superprompt continúan documentados en `docs/research/SUPERPROMPT_MOTION_V2_2026-10-08.md`.

```powershell
node docs/qa/previews/composing-lienzo-v2/build.mjs
node docs/qa/previews/composing-question/serve.mjs 'F:\Coding Proyects\Syka Clips\Pruebas Syka\Composing-Lienzo-v2-2026-10-08' 5332
```
