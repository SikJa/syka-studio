# Propuesta: recetas y planes (2026-10-31)

Reemplaza a `PROPUESTA-PLAN-CONTRATO.md`. Todavía no se implementa nada: este
documento es para decidirlo juntos.

## La idea

- **Receta**: cómo hacés un tipo de video (tu YouTube, tu vertical, tu
  lanzamiento). Es reutilizable, mejora con cada video y la arrastrás al chat.
- **Plan**: el de cada video. Sale de una receta más el material nuevo, y es lo
  que el agente sigue y el gate revisa.
- **Motor**: uno solo para todo tipo de contenido. Las fases son las mismas
  (brief → plan → storyboard opcional → construir → gate → entregar → mejorar la
  receta); la receta decide qué hace cada fase.

## Qué hacen los demás

| | Cómo lo resuelve | Qué tomamos |
|---|---|---|
| HyperFrames `viral-clone` | Aprende el estilo de un video de referencia y lo guarda como **plantilla**. Con un video toma sus números; con varios de un creador, medianas y rangos, y lo que aparece una sola vez queda como variante con su condición. | Arrancar una receta desde referencias, con números medidos y no con adjetivos. |
| HyperFrames `creator-remix` | Cada plantilla trae su identidad (CHANNEL.md), su proceso con controles (REMIX.md), y voz, encuadre, edición, sonido y componentes. "Si el archivo y la plantilla no coinciden, gana la plantilla." | La receta manda sobre las reglas generales, y trae sus propios controles. |
| HyperFrames, tabla "qué cambiar" | Según el pedido (nuevo guion, nueva persona, nuevo producto) dice qué rehacer y qué reutilizar. | Cada receta separa lo fijo de lo que cambia en cada video. |
| HyperFrames `moment-film` | Una receta muy buena para lanzamientos, con `film.json` como plan y un gate que lo lee. | Nuestra receta de fábrica de lanzamiento. |
| Remotion | Skills de buenas prácticas y plantillas de inicio, sin sistema de recetas. Su comunidad recomienda una plantilla con parámetros (marca, textos, assets) en vez de pedir el video final con un prompt. | Lo fijo de la receta vive como componentes con parámetros, no como texto. |

## La receta

Una carpeta por receta, que también es una skill (así se arrastra al chat):

```
Recetas/mi-youtube/
  RECETA.md          entrada: qué es, cuándo usarla, versión, de dónde salió
  receta.json        lo mismo, legible por la máquina (lo valida Syka)
  componentes/       subtítulos, títulos, zócalos y transiciones como TSX con parámetros
  referencias/       análisis de los videos de referencia (texto y números, no los videos)
  historial.md       cada mejora: qué cambió, por qué y de qué video vino
```

`receta.json` guarda:

- **brief**: qué pregunta para este tipo de video, y qué ya trae resuelto;
- **estructura**: secciones típicas con rangos de duración (gancho 3–6 s, bloques 40–90 s, ...);
- **estilo**: colores, fuentes, subtítulos (tamaño, posición, palabras por línea), cámara y encuadre, transiciones;
- **sonido**: de dónde sale la música, volumen bajo la voz, efectos;
- **ritmo**: cortes por minuto, tiempo máximo sin cambio de plano y pausas que se recortan;
- **referencias**: qué se toma de cada una;
- **fijo y variable**: qué no se toca y qué cambia en cada video;
- **controles**: reglas que el gate suma a las generales (por ejemplo "los subtítulos no tapan la cara" o "nunca más de 4 s sin cambio");
- **confianza** de cada regla: *medida* (salió de una referencia o de tus videos), *aprobada* (la confirmaste) o *propuesta* (la sugirió el agente). Así una receta nueva puede arrancar incompleta y madurar.

## Recetas de fábrica

1. **Lanzamiento de producto**: tres historias para elegir, demo con UI real, cámara sobre la interfaz, música con golpes, logo al final.
2. **YouTube**: parte de la transcripción. Gancho, recortes de pausas y repeticiones, b-roll y títulos donde la voz lo pide, subtítulos, capítulos.
3. **Vertical** (reels, TikTok, shorts): gancho en el primer segundo y medio, subtítulos grandes y centrados, cortes rápidos, zona segura de la interfaz de cada red.

Cada persona las copia a sus recetas y las adapta. Las de fábrica no se modifican.

## Que arrancar una receta no sea difícil

Cinco caminos, del más fácil al más completo:

1. **Copiar una de fábrica** y usarla tal cual. La primera mejora llega con el primer video.
2. **"Hacé videos como este"**: arrastrás uno o varios videos de referencia. Syka los analiza (ritmo de cortes, subtítulos, estructura, música y tipografía) y arma una receta en borrador con reglas *medidas*. Con varios videos del mismo creador usa rangos.
3. **Desde tus videos**: arrastrás 2 o 3 videos tuyos ya publicados y saca tu estilo de ahí.
4. **Desde el primer video aprobado**: lo editás iterando y, al aprobarlo, Syka propone convertirlo en receta. Es el camino más natural.
5. **Entrevista corta**: 3 preguntas con opciones visuales (por ejemplo, tres estilos de subtítulos para elegir).

En todos los casos se genera un borrador, te muestra un resumen de una pantalla y lo confirmás.

## Ser proactivo, sin depender del modelo

La propuesta la hace **la app**, no el modelo:

- Cuando el agente entrega un video y vos lo aprobás, o cuando cerrás una tanda de correcciones, aparece una **tarjeta** en el chat:
  - si el video no usó receta: **"Crear receta con este video"**;
  - si usó una: **"Guardar mejoras en «Mi YouTube»"**, con la lista de lo que aprendió ("subtítulos 10 % más chicos", "música −3 dB") para tildar o destildar;
  - **"Ahora no"**.
- Las correcciones que hacés durante la iteración ("más rápido", "subtítulos más abajo") se anotan en el plan como **notas**, y de ahí salen las mejoras propuestas.
- Ninguna receta cambia sin tu OK, y cada cambio queda en `historial.md` (se puede volver atrás).

## El plan de cada video

`Plan/plan.json` en el proyecto. Guarda qué receta y qué versión usó, las
respuestas del brief, las secciones o escenas con tiempos, texto en pantalla,
planos, transiciones y música, los assets con su origen, y las notas de
corrección. Es la memoria que lee una sesión nueva en vez del chat.

## La entrega trabada

Una pieza nueva solo puede marcarse como "lista" con un plan válido y un gate
aprobado sobre la versión final del código. El gate deja un comprobante con la
huella del código revisado. Para una corrección chica, el agente lo declara y
alcanza con el gate.

## El gate con receta y plan

Suma tres cosas a lo que ya revisa:

- las frases del plan aparecen enteras y dentro del margen;
- la duración coincide con el plan;
- se cumplen los controles propios de la receta.

## Orden sugerido

1. Formato de receta y plan, con validación y tests.
2. Motor de fases y entrega trabada.
3. Receta de fábrica de lanzamiento; probarla con una pieza real.
4. Recetas de YouTube y vertical.
5. Tarjeta proactiva "crear receta / guardar mejoras".
6. Crear una receta desde videos de referencia (usa `syka_reference_video`, que ya existe).
7. Gate con los controles de la receta.
