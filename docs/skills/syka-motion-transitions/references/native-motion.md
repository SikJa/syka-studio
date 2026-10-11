# De interacción web a motion reproducible

## Tokens orientativos

Los valores de transitions-dev son puntos de partida para microinteracciones. Una transición de escena o un texto extenso puede necesitar otro tiempo.

| Intención | Inicio orientativo | Nativo Diffusion |
| --- | --- | --- |
| Reveal de texto | 0.5 s, separación 0.04 s, llegada suave | Track `offsetY`, `opacity`, opcional `effect/value` |
| Panel entra/sale | 0.4 s / 0.35 s | Tracks independientes según el gesto |
| Respuesta pequeña | 0.15–0.25 s | Opacidad, posición o escala de un elemento pequeño |
| Llegada suave | `cubic-bezier(0.22,1,0.36,1)` | `cubicBezier(0.22,1,0.36,1)` |

Obtené el frame rate real del proyecto: no siempre es 30 fps. Elegí un stagger de 1 o 2 frames si querés ritmo uniforme y convertí `frames/fps` a segundos. El ejemplo técnico usa 30 fps explícitos. No confundas `500ms` de CSS con `500` segundos en JSX.

## Ejemplo editable

`examples/NativeReveal.tsx` usa panel nativo y dos líneas con comienzo desplazado. Cada línea calcula su propia duración a partir del fin común; todas salen juntas. `motion-timing.ts` reserva entrada, lectura y salida incluso con una duración corta; la velocidad de reproducción o un trim de media requerirían trasladar los tiempos al reloj fuente.

Copiá los dos archivos al mismo directorio del proyecto. El default export se monta como un proyecto de ejemplo; para integrarlo en otro, reutilizá `RevealText` dentro de la escena existente y asigná ids únicos. Ajustá `headline`, `support`, `accent` y `reducedMotion` en `config`; esta paleta no es un preset obligatorio. Los parámetros del ejemplo de texto son fuente de verdad y los keyframes siguen siendo nodos del editor.

Comprobar tipado contra `@diffusionstudio/jsx` y tiempos solo valida API/estructura. Antes de usar un patrón en una entrega, inspeccioná captura y export reales.

## HTML cuando de verdad simplifica la composición

Una composición con muchas tarjetas/UI puede usar `<html>` y anime.js pausado. Si el componente comienza en `start`, el seek habitual es `Math.max(0, sceneTime - start) * 1000`, considerando también sourceIn/playbackRate cuando corresponda. Definí todos los estados desde ese tiempo; repetir `seek(t)` o llegar a `t` desde el futuro debe producir el mismo cuadro.

Precauciones documentadas del rasterizador:

- Un `scale()` CSS en un wrapper grande o por encima de un `overflow:hidden` puede vaciar su captura. Para entradas usá translate/opacity; una escala nativa sobre el nodo puede ser preferible.
- Un descendiente con caja pintada y opacidad fraccional bajo otro wrapper que también está desvaneciéndose puede desaparecer. Usá color con alpha para atenuar el fondo, evitando dos capas decoradas de opacidad fraccional.
- No metas `<audio>`, `<video>` o `<canvas>` DOM dentro del paint HTML: audio/video son elementos de composición y el canvas se implementa con `<surface>`.
- No traslades sin verificar funciones de GSAP/Remotion a anime.js o al vocabulario nativo. Leé la API instalada.

## Continuidad con intención

Para que A entregue el movimiento a B, compará alrededor de la costura: posición del foco, escala aparente, dirección y velocidad. Una curva que llega a reposo en ambos lados hace dos reveals separados. A veces un pequeño solapamiento resuelve la costura; otras veces necesitás conservar el objeto en un grupo a través del cambio de fondo. Evitá agregar blur para ocultar una discontinuidad que puede corregirse en el trayecto.
