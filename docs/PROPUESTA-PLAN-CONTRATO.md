# Propuesta: el plan como contrato (2026-10-31)

Para piezas nuevas o rehechas. Las correcciones chicas no pasan por esto.

## Qué aprendimos de HyperFrames

Su plan (`compositions/film.json`) no es un documento para leer: es la fuente de
tres cosas a la vez.

1. **El storyboard**: cada "shot" del plan se posa como imagen fija.
2. **El gate**: el gate compara el plan con el video. Comprueba tiempos contiguos,
   que cada frase del plan aparezca entera, que los cortes ocurran en movimiento y
   que no haya más de un tercio de cortes secos.
3. **La memoria**: una sesión nueva lee el plan en vez del chat.

Lo que lo hace fuerte no son los campos, sino que **nada avanza sin él**. Hay una
parada obligatoria con tres historias distintas (salvo "no preguntes"), el plan se
escribe antes del código, y el gate falla si el video no cumple el plan.

## La propuesta para Syka

### 1. Un archivo: `00 Plan/plan.json` en el proyecto

| Bloque | Qué guarda |
|---|---|
| `promesa` | producto, la única idea, para quién, la tarea que muestra, antes, después y llamado a la acción |
| `formato` | relación de aspecto, duración en rango, canal, storyboard sí o no, aprobado (quién y cuándo) |
| `look` | fondo, tinta, acento, fuentes y logo (rutas reales del proyecto) |
| `sonido` | modo, tema elegido (Mixkit u otro, con licencia), BPM y **beats medidos** con `syka_audio_analyze`, voz |
| `escenas[]` | ver abajo |
| `marca` | la escena donde aterriza el logo |
| `notas[]` | cada pedido del usuario y qué se cambió |
| `excepciones[]` | reglas del gate que el usuario pidió saltar, con sus palabras; valen solo con plan aprobado |

Cada **escena** tiene:
- `id`, `inicio` y `fin` (contiguos, de 0 a la duración);
- `frase`: hasta 6 palabras, o `""` si no lleva texto;
- `imagen`: qué ve el espectador que prueba la frase;
- `capa`: el id de la capa de texto que dibuja la frase, para que el gate la encuentre;
- `planos[]`: momento, distancia (general, panel o primer plano), qué se ve,
  movimiento (acercar, alejar, paneo, corte o quieto), destino del movimiento y
  cursor;
- `ui[]`: cada acción del producto como causa → efecto;
- `assets[]`: qué necesita (captura, construido, compartido o generado) y si ya está;
- `costura`: cómo pasa a la siguiente (corte en movimiento, corte seco, morph,
  corte por coincidencia o fundido) y en qué beat de la música cae.

### 2. Una herramienta con fases (nombre a definir)

Acciones, en orden:
1. **brief**: junta la promesa. Si falta algo, pregunta con `syka_ask_user` (hasta
   3 preguntas).
2. **historias**: propone **tres historias distintas** en una tarjeta de pregunta
   (mundo, recurso y forma). Si el usuario dijo "no preguntes", elige la
   recomendada y lo dice en una línea.
3. **plan**: valida y guarda `plan.json`. Devuelve los errores (frase de más de 6
   palabras, tiempos con huecos, escena sin imagen, primer plano sin destino) hasta
   que pase.
4. **cuadros**: posa cada plano y arma la hoja de contacto con `capture`. Con
   Storyboard activado, **frena** hasta el "dale".
5. **reloj**: liga el tema y sus beats medidos al plan; los cortes se mueven a los beats.
6. **revisar**: corre `gate` con el plan.

El host recuerda la fase de cada pieza. `syka_delivery` **rechaza** entregar una
pieza nueva sin plan válido o sin un gate aprobado después de la última edición, y
dice qué falta. Así no depende de que el modelo decida leer la skill.

### 3. El gate lee el plan

Además de lo que ya revisa:
- **la frase aparece entera** dentro del margen seguro (5 % de cada borde) en algún
  momento de su escena. Esto habría detectado los textos pegados al borde de la
  prueba de hoy;
- **los tiempos** del plan coinciden con la escena, y las escenas son contiguas;
- **los cortes** caen en movimiento (salvo los secos planeados, como máximo un
  tercio) y a ±2 cuadros del beat de música que dice el plan;
- **los primeros planos** del plan realmente llenan el cuadro en su momento;
- **el logo** aparece en la escena `marca`.

### 4. Botón Storyboard en el compositor

Prendido: la fase 4 frena y muestra la hoja de contacto en el chat. Apagado: sigue solo.

## Orden de trabajo sugerido

1. Esquema de `plan.json`, validación y tests.
2. Herramienta con fases, y bloqueo en `syka_delivery`.
3. Gate con plan.
4. Hoja de contacto y botón Storyboard.
5. Skill de lanzamiento reescrita alrededor de las fases (más corta).
6. Prueba real, y después actualización.
