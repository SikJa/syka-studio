# Resultado: Syka Studio vs HyperFrames (30/10/2026)

Mismo pedido (`E:\Syka Studio\Pruebas\lanzamiento-syka-referencias\PROMPT-LANZAMIENTO-SYKA.md`), mismas 15 referencias, mismo motor: **Claude · Opus 5.5 · esfuerzo medio**, en un proyecto nuevo en cada app.

## Números

| | Syka | HyperFrames |
|---|---|---|
| Turnos hasta tener la película | 1 | 2: primero el storyboard, después la animación tras el "dale" |
| Tiempo del agente | **14 min 03 s** | **26 min 58 s** (10:52 + 16:07), sin contar la espera del "dale" |
| Tokens de entrada leídos de caché | 4,44 M | 13,68 M |
| Tokens de entrada nuevos (escritos en caché) | 188 k | 249 k |
| Tokens de salida | 80 k | 120 k |
| Costo | No lo informa (estimado en ~$3,5 por los tokens) | **$10,67** informado ($3,54 + $7,13) |
| Preguntas | 0 | 0, pero frenó en el storyboard porque el modo Storyboard estaba activado |
| Errores durante la corrida | 2 menores (un error de Python y un `wc` que falló por la ruta con espacios) | 0 visibles. No había clave de HeyGen y la biblioteca de efectos no respondió; lo resolvió por su cuenta |
| Música | Propia, generada a 120 BPM | Tema de la biblioteca de la app a 120 BPM |
| Efectos de sonido | 30 efectos nativos | 5 efectos hechos por el agente (clic, tipeo, whoosh, pop, golpe) |
| Revisión propia | 5 hojas de contactos y correcciones | Storyboard con 19 cuadros + chequeo de calidad + los 7 cuadros de control |

Fuentes:
- Syka: `Datos\profile\agent-chat\chats\6127540c…\events.jsonl` y la sesión de Claude `Datos\harness-profiles\claude\projects\E--Syka-Studio-Motions-dark-river-30-oct\897ebaf6….jsonl`.
- HyperFrames: `~\.hyperframes-studio\New video\.hyperframes\run-traces\*.jsonl` (el evento `result` de cada turno).

## Cuadros de control (1 · 5 · 9 · 13 · 17 · 21 · 23,9 s)

| Segundo | Syka | HyperFrames |
|---|---|---|
| 1 | Esfera armada, todavía sin ojos | Puntos juntándose, con los ojos ya visibles |
| 5 | Inicio con el pedido tipeándose. La captura se ve chica | Inicio más grande, con cursor y acercamiento |
| 9 | Recorder con la flecha. Texto "Grabá. Explicá. Seguí en Studio." | Igual, con la ventana más grande. El texto aparece por partes ("Grabá. Explicá.") |
| 13 | Editor completo, chico y con espacio vacío alrededor | Acercamiento fuerte a la nota sobre el video y a los subtítulos. Más cinematográfico |
| 17 | Chips sobre la pantalla de modelos atenuada, con "Tus cuentas. Tus modelos." centrado | Ventana de modelos a la izquierda y chips grandes saliendo a la derecha |
| 21 | **Casi vacío** (un punto carmín) | Puntos colapsando, también bastante vacío |
| 23,9 | Mascota en estado Listo, centrada. La tarjeta final ya se fue | Mascota centrada, con la misma escala que el comienzo |

## Lectura

- **Velocidad y costo:** gana Syka con claridad. Tardó la mitad y consumió unas tres veces menos tokens leídos de caché, en un solo turno y sin frenar.
- **Encuadre y cámara:** gana HyperFrames. Usa capturas más grandes y acercamientos reales al lugar que importa. En Syka, las escenas 2 y 4 se ven alejadas, con mucho espacio vacío.
- **Proceso:** HyperFrames planifica primero (storyboard aprobable) y después anima. Syka va directo, que es lo que pedía el prompt ("build without waiting for approval").
- **Audio:** Syka entrega música y efectos más completos y propios.
- **Los dos fallan en el segundo 21:** el cuadro del colapso queda casi vacío.

## Qué mejorar en Syka (de esta prueba)

1. **Cámara:** que la skill de motion empuje la cámara hacia la zona activa de cada captura en lugar de mostrar la ventana entera chica. Es la diferencia visual más grande.
2. **Control de cuadros vacíos:** el chequeo de control tiene que marcar como error un cuadro con casi nada en pantalla, como el segundo 21.
3. **Título del chat:** quedó como "<inputs> All inputs…". El modelo chico no lo renombró. Hay que revisarlo.
4. **Nombres de herramientas en el chat de Claude:** todas aparecen como "Herramienta".
5. **Rutas con espacios** en los comandos de shell (el `wc` sobre `B:/Apps/Programas propios`).
