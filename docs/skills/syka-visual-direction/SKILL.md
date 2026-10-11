---
name: syka-visual-direction
description: Resolver la dirección visual de una edición Syka a partir de marca, referencias o un preset, y convertirla en beats y componentes nativos editables. Usar para diseñar o mejorar tarjetas, diagramas, motions y piezas con varias escenas.
---

# Dirección que se puede ejecutar y corregir

Para una pieza completa de motion o una mejora amplia de fluidez/composición, leé [references/motion-production.md](references/motion-production.md): lecturas por beat, estados, continuidad, comportamiento por objeto, sonido y variantes de formato. Conservá la marca y el alcance acordados; no requiere aprobaciones nuevas para cada paso.

Leé la receta del proyecto antes de preguntar. El pedido actual y los ejemplos aprobados prevalecen. Usá la marca, referencias y recursos disponibles; si falta una decisión que cambia el resultado, preguntá sólo eso mientras seguís con tareas independientes. Un pedido de editar ya autoriza una muestra reversible: no exijas un nuevo onboarding ni una aprobación de cada paso.

La dirección vive en un `frame.md` dentro del proyecto, enlazado desde `syka_editing_recipe.references`. Para continuar una pieza, conservá su dirección y actualizá sólo decisiones cambiadas. `references/frame-template.md` es una plantilla breve y opcional; `references/prompt-guide.md` explica cómo pasar de palabras a una escena. Los presets en `references/frames/` son referencias de diseño, nunca componentes listos para Diffusion. Elegí uno sólo si ayuda al estilo solicitado, adaptá sus tokens a la marca y mantené el formato real de entrega. No impongas 16:9, vidrio, movimiento continuo ni un preset classic.

El plan identifica por beat: propósito, intervalo, contenido exacto, foco, posición, entrada, tiempo de lectura, salida y audio. Preferí acciones que expliquen el contenido: conservar una tarjeta mientras cambia su evidencia, dibujar una relación o mover una cámara para mostrar otro sector. Una imagen bonita o un rectángulo con fade no sustituye el diseño resuelto.

Para una edición amplia o un pedido de «más calidad», leé [references/reference-to-edit.md](references/reference-to-edit.md). Convertí la referencia en decisiones observables y probá primero el beat de mayor riesgo con el texto y medios reales. El catálogo nativo `syka_resources kind: motions` devuelve muestras, `componentPath`, `componentFiles` y `usage`: usalos para construir y corregir, en vez de reinventar la técnica o importar una muestra como video terminado. No todos los pedidos necesitan un motion; un corte limpio puede ser la decisión correcta.

Usá `syka_skills` para leer `syka-editorial-motion`, `syka-motion-transitions` o el workflow necesario. Los tiempos se traducen a secuencias/nodos/keyframes de la composición activa. Un gráfico HTML usa el ticker de la escena: no usa reloj real ni otro render. Leé las referencias JSX antes de inventar propiedades. Los nuevos elementos llevan nombre y key estables para que se puedan señalar, retocar y deshacer.

Para una pieza de tipografia, tarjetas o paneles, lee [references/typography-and-cards.md](references/typography-and-cards.md). Resolve primero el cuadro quieto con el copy real: jerarquia, ancho de linea, alineacion, espaciado y margenes. Anima titulo, apoyo y superficie segun esa jerarquia; evita que todas las capas compitan a la vez. Los valores orientativos no fijan una marca ni un estilo para todos los proyectos.

Las notas visuales del chat incluyen tiempo, Source/Key cuando existe, región, captura y trazos normalizados. Releé el source y compará su identidad antes de tocarlo. No interpretes un círculo de revisión como un objeto que debe aparecer en el export. Para píxeles grabados dentro de un MP4, ofrecé cambios de encuadre/overlay o reconstrucción explícita; no inventes un componente editable interno.

Verificá un frame de lectura, uno de transición y ambos lados del cambio. Reproducí después de retroceder: debe conservar el mismo estado al mismo tiempo. Guardá evidencia real y dudas en la receta; una captura o check técnico no prueba sincronía ni gusto. Cuando se apruebe el resultado, guardá referencias, parámetros y componentes reutilizables, no una instrucción vaga «hacerlo premium».

Adaptación original para Diffusion basada en las guías de diseño, prompts y Studio de HyperFrames. Ver `docs/THIRD_PARTY_NOTICES_HYPERFRAMES.md` para procedencia y licencia de los presets incorporados.
