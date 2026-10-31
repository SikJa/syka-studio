# Cámara y encuadre sobre la UI del producto

Reglas propias de Syka para que la demo se lea en un teléfono y la cámara tenga
intención. Medidas en proporción del cuadro de la composición.

## Encuadre

- **La captura nunca queda chica en el centro de un fondo vacío.** La ventana del
  producto ocupa entre el 55 % y el 90 % del ancho; si se ve entera, va sobre un
  fondo de marca (degradé, luz, textura), no sobre negro liso. El gate avisa con
  `small-subject` cuando la imagen llena menos del 12 % de un cuadro casi vacío.
- **Se lee en un teléfono.** El texto de la UI que importa mide al menos el 2,5 %
  del alto del cuadro; si no llega, acercá la cámara hasta que llegue, no subas
  el tamaño de la captura completa.
- **Tres distancias, alternadas.** Plano general (la ventana entera, solo para
  ubicar), plano de panel (un panel llena el cuadro) y primer plano (un control:
  botón, campo, tarjeta, al 2–3× del plano de panel). Nunca más de un plano
  general seguido; la mayor parte del film vive en panel y primer plano.
- **Despejado.** Lo que no participa del beat queda fuera de cuadro o atenuado
  (opacidad ≤ 0,4). Barras laterales e historial no compiten con el control activo.
- **Plano y frontal.** La UI real no se inclina en 3D; la profundidad viene de
  sombra suave, escala y desenfoque del fondo.

## Movimiento de cámara

- **Cada movimiento llega a algo.** Un acercamiento o paneo dura 0,4–0,7 s, con
  aceleración y frenado marcados (ease in-out fuerte, no lineal), y termina sobre
  el control que el cursor va a usar o el resultado que aparece. Si no hay destino,
  no hay movimiento.
- **Nada de deriva.** Prohibido el zoom lento continuo (por ejemplo 1 → 1,05 en
  4 s) para "dar vida": se lee como temblor. Si el cuadro necesita vida mientras se
  lee, que se mueva la luz o el fondo, no el texto ni la UI.
- **El texto que aterrizó queda quieto.** Un título no se desliza ni escala
  después de llegar; el movimiento pasa al siguiente elemento o a la cámara.
- **Cortes en movimiento.** Cortá en el cuadro más rápido de un movimiento, con la
  misma dirección a ambos lados, o en el rebote de un clic. No cortes con todo quieto.
- **Pantalla nueva, mismo encuadre.** Una pantalla que entra aparece con el encuadre
  que tenía la anterior y recién después se acerca a su control.
- **Desenfoque de movimiento opcional** en los movimientos rápidos: 6–12 px en
  elementos del tamaño de un texto, 15–20 px en movimientos de cuadro completo,
  solo en el eje del movimiento.

## Cursor

- Grande (4–7 % del alto del cuadro), entra desde fuera de cuadro, apunta al
  próximo control y su clic provoca el cambio en el mismo cuadro.
- Puede desaparecer mientras la cámara se mueve y reaparecer en el destino.

## Implementación en Syka

Agrupá la captura y sus overlays (marco, cursor, callout) en un mismo `<group>` y
animá la cámara transformando ese grupo (escala y posición desde el reloj
absoluto, con `transform-origin` en el control). Calculá el destino desde los
bounds medidos del control, no a ojo. Después corré `gate` y mirá con `capture`
el primer y último cuadro de cada movimiento.
