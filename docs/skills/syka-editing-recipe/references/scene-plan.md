# De una referencia a una escena que se pueda editar

Usá este soporte cuando haya varias escenas o una referencia visual importante. El objetivo es resolver qué se ve y por qué antes de programar más efectos. Adaptá el detalle al trabajo; no impongas una estética, cantidad de tarjetas o duración fija.

## Plan dentro del proyecto

Un archivo como `.syka/scene-plan.md` alcanza. Enlazalo desde `references` de la receta existente. Conservá la transcripción cruda y la revisada por separado; si hay cortes, registrá origen → timeline y usá ese montaje para sincronizar captions y gráficos. No calcules cues desde un transcript crudo que ya no coincide con la edición.

Para cada intervención relevante registrá lo siguiente, en una tabla o párrafo:

- **Idea y cue:** frase, gesto, cambio de pantalla o evento que explica el gráfico. Indicá el tramo real de timeline y, si hace falta, el tramo del archivo fuente. Si el tiempo es aproximado, decilo.
- **Cuadro resuelto:** texto real, evidencia visible y ancla principal. Ubicación respecto de rostro, cursor y captions; espacio necesario cuando está toda la información. Usá la proporción de salida, no un layout abstracto.
- **Estados y continuidad:** qué aparece, qué queda fijo, qué cambia y cómo vuelve al footage o conecta con la próxima escena. Separá llegada, lectura y salida. El hold depende de cuánto hay que leer, no de un preset universal.
- **Construcción y recursos:** componente/nodos con nombres reconocibles, parámetros que interesa editar, SVG o medios originales copiados al proyecto y fuente del recurso. Los controles disponibles dependen de si se usan nodos nativos o DOM dentro de `<html>`.
- **Sonido y revisión:** qué evento merece un acento, cuánto espacio necesita la voz y qué punto quieto/intermedio hay que inspeccionar. También es válido dejar silencio o footage limpio.

Marcá las decisiones del usuario y las elecciones del ensayo con palabras claras. Para alternativas descartadas registrá sólo la razón que ayuda a la siguiente iteración.

## Ejemplo de decisión útil

En una explicación sobre una edición, una frase puede convertirse en encabezado mientras aparece una comparación entre subtítulos fragmentados y una frase completa. La comparación aporta evidencia; no es otra tarjeta que repite lo que el hablante acaba de decir.

El diseño debe resolver ambos textos completos antes de animar: ancla del encabezado, alineación de las dos columnas y zona de captions libre. La llegada presenta el tema; después aparece la diferencia; el hold deja leer; la salida devuelve el foco al cursor. Si el footage ya demuestra la diferencia con claridad, un callout breve puede reemplazar toda la comparación.

Esto describe una posibilidad, no una secuencia obligatoria para reels o YouTube. Tampoco implica que una marca mencionada deba tener un logo superpuesto.

## Llevarlo a Diffusion

El plan usa tiempos de la escena. Al construir un grupo o componente, traducilos a su tiempo local; no sumes el inicio dos veces. Los hijos de `<html>` son DOM: animá su contenido desde el reloj de escena o envolvelo en un grupo para usar keyframes nativos. `syka-editorial-motion` y sus ejemplos contienen la implementación; no copies un runtime de otro motor.

Preferí parámetros de contenido, tamaño, posición, tiempos y material a seis copias de una tarjeta con números distintos. El plan identifica qué información cambia y qué componente se reutiliza. Una variación de texto que rompe el layout se resuelve en el diseño, no sólo achicando toda la tipografía.

## Aprender de la revisión

Guardá observación → cambio → evidencia. Por ejemplo: «el caption chocaba con el diagrama durante la entrada → movido el diagrama al área libre → captura del hold y de la entrada». Verificá el export solicitado, además de la preview: voz/captions completos, recursos correctos y ausencia de recortes o vacíos.

Una buena devolución permite seguir mejorando la misma muestra. Para una skill personal reutilizable, conservá los principios que el usuario quiera repetir y ejemplos/componentes portables. El footage, marcas de una prueba y rutas personales no son requisitos de la base incluida. No declares entrenados los pesos del modelo por haber guardado una receta.
