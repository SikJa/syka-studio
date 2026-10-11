---
name: syka-motion-direction
description: Diseñar la dirección visual y el storyboard de un lanzamiento SaaS, explicador o motion en Syka; convertir referencias en escenas conectadas, tipografía legible, sonido intencional y componentes editables.
---

# Dirección de motion

El resultado es una pieza con una idea visual y progresión, no un catálogo de efectos. Adaptá la profundidad al pedido: un título no necesita el proceso de un lanzamiento completo. El estilo sale del brief, referencias y producto real; ninguna estética ni preset de captions está fijado.

## Antes de animar

Entrá por `syka-motion-brief`: consulta útil para cada nueva pieza y decisión de
música/efectos/voz/silencio en todos los casos. Compilá `syka_motion_plan` desde
respuestas reales, referencias y beats para obtener JSON y superprompt detallado.
Reels, storyboards, tipografía y captions con cámara tienen rutas propias; no
conviertas todos los pedidos en un lanzamiento de tarjetas.

Para ver el flujo completo con respuestas hipotéticas y el JSON que compila el
prompt, leé [examples/green-bottle-flow.md](examples/green-bottle-flow.md). El ejemplo
es una demostración del método; su formato, copy y estética no son defaults.

1. Definí público, mensaje que debe recordar y acción final. Identificá qué promesas del producto podés demostrar con UI, assets o comportamiento real. Separá funciones comprobadas, prototipos y planes; una integración disponible no demuestra que una publicación se haya realizado.
2. Mirá referencias con `syka-motion-reference` antes de preguntar. Extraé reglas útiles (jerarquía, densidad, ritmo, continuidad, relación música/imagen), no solo colores. Si falta dirección, sugerí una concreta con el motivo ligado a lo que viste y al producto en la tarjeta de `syka_ask_user` (`context` y `recommendation`); esperá la elección. No hace falta frenar ni repetir decisiones si ya está autorizado producir con una dirección definida o delegada.
3. Prepará algunos **styleframes**: cuadros del inicio, demostración y cierre, con proporción y texto reales. Miralos capturados antes de pulir animación. Si un cuadro se siente genérico o ilegible quieto, más easing no lo arregla.
4. Armá un beat sheet compacto: tiempo, idea, foco visual, estado inicial/final, vínculo con la próxima escena y sonido. Usá [references/creative-brief.md](references/creative-brief.md) cuando haga falta un formato. Guardalo en el proyecto para sostener decisiones entre iteraciones.

Para una pieza sustancial, leé [references/production-prompt.md](references/production-prompt.md). Es la estructura predeterminada del prompt de producción: **inputs, direction, structure, build, gotchas y start/review**. Guardá `production-prompt.md` en el proyecto y enlazalo en la receta. Cambiá su contenido con el brief; ninguna paleta, guion o cantidad de escenas queda fijada por esa estructura.

## Construcción

Para tarjetas, comparaciones o callouts sobre footage, cargá `syka-editorial-motion`. Incluye ejemplos ejecutables en Diffusion y la traducción del reloj/DOM de HyperFrames. Usá los ejemplos para arrancar una muestra, adaptándolos al contenido real; no sustituye el storyboard ni convierte todos los gráficos en un mismo preset.

- Una escena demuestra una idea. Alterná encuadre, escala y densidad cuando lo justifique la historia: producto completo → detalle útil → resultado. No repitas seis tarjetas idénticas con distinto texto.
- Diseñá qué **continúa** entre escenas: una selección se convierte en bloque de timeline, ese bloque se amplía en un caption y el caption termina dentro de la preview. Puede ser el mismo nodo, un match cut o un movimiento coordinado; no hace falta morph en todos los cortes.
- Usá `syka-motion-transitions` para entradas/salidas fluidas y continuidad. Anticipación, aceleración, pausa y salida tienen roles distintos. Un corte o un hold quieto también puede ser la decisión correcta.
- Mostrá UI original legible, logos correctos y contenido verosímil. Preferí capturas propias y demostraciones reproducibles. Una reconstrucción simplificada debe conservar el comportamiento real; no inventes controles, métricas, publicaciones o clientes.
- Si representás una marca, buscá primero su SVG con `syka_resources` (`action: list`, `kind: logos`, `query: nombre`). Elegí variante clara/oscura y símbolo/lockup según el fondo; no sustituyas un logo disponible por uno dibujado. Importalo con `assets` (`action: import`, `copy: true`) al proyecto para que se conserve si se desconecta la biblioteca. Si no está, indicá el resultado real y buscá una fuente autorizada; una mención verbal sola no exige agregar un logo. Las bibliotecas personales son opcionales y no se distribuyen con el editor.
- Elegí familias tipográficas, tamaños y márgenes en conjunto. El título debe poder leerse al tamaño de reproducción previsto. No tapes el producto con copy que ya comunica la imagen.
- Adaptá la escala de la interfaz al video: una etiqueta legible en un monitor puede perderse en Discord o móvil. Recortá y acercá el control importante con capturas de resolución suficiente; si mantenés la vista completa, jerarquizá con iluminación/encuadre y una frase corta. No fabriques un dashboard ornamental para llenar espacio.
- Componé sonido desde el beat sheet con `syka-local-audio`: eventos principales, textura discreta, música con espacio para voz y silencios con intención. No pongas un click en cada elemento por costumbre.
- Conservá edición: texto y logos nativos, grupos/componentes con nombres y parámetros; `<html>` con timeline pausado si simplifica UI compleja. No hornees todo en un MP4 cuando el pedido sea una composición editable.

## Iteración

Para un lanzamiento o motion ambicioso, hacé dos o tres pasadas proporcionales usando `syka-edit-review`: primero concepto/legibilidad, luego continuidad/timing/sonido y finalmente comprobar la preview y los seeks. Después de cada pasada corregí los problemas de mayor impacto; no agregues decoración para disimularlos. El presupuesto temporal del usuario limita las rondas. Exportá únicamente si el usuario lo pidió; de otro modo dejá la composición lista para su export manual.

Entregá composición, assets utilizados, preview/export solicitado y una nota breve de lo realmente validado. Analizar referencias y escribir skills no equivale a entrenar pesos de un modelo.

## Procedencia técnica

Adaptación editorial para el motor Diffusion de Syka. Referencias de método: [HyperFrames](https://github.com/heygen-com/hyperframes) (continuidad y dirección), [Remotion skills](https://github.com/remotion-dev/skills) (composición reproducible, tiempo y verificación), [motion-graphic-skill](https://github.com/JakeB-5/motion-graphic-skill) (storyboard y crítica). Consultá su documentación si trabajás en esos motores; sus APIs no son intercambiables con JSX de Diffusion. Esta skill no depende de instalarlos ni ejecutarlos.

De HyperFrames se revisaron `hyperframes-creative` (house-style, video-composition, beat-direction), `hyperframes-animation` y `product-launch-video`; de Remotion, `remotion-markup`. Aplicá sus decisiones útiles al brief. Las preferencias upstream sobre número de capas, movimiento permanente, tipografías o presets no se convierten en obligaciones de Syka; tampoco sus comandos de inicialización, login o render.
