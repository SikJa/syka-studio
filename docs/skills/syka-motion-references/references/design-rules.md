# Decisiones de motion que vienen con Syka

Estas reglas son una adaptación propia para Diffusion. Se apoyan en estudios
escritos de referencias, no en descargar esos videos en cada instalación.
Los ejemplos ayudan a elegir; el contenido y la identidad del proyecto mandan.

## Composición y tipografía

- Escribí qué debe entenderse en cada beat antes de mover objetos. Un mensaje
  principal necesita una prioridad visual clara; apoyo, prueba y CTA cumplen
  roles distintos. No les des el mismo tamaño, peso y contraste por comodidad.
- Medí texto real con fuentes cargadas. Elegí los saltos por unidades de sentido
  y ajustá el layout a esas líneas; no encogás todo hasta que entre. Conservá
  padding y márgenes visibles alrededor del apoyo y de los extremos del título.
- Una palabra dominante puede organizar una demostración: alterná promesa y
  evidencia concreta. El énfasis de color, peso o familia tiene que dirigir una
  lectura, no repartir acentos a todas las palabras.
- Resolvé una composición propia para vertical y otra para horizontal. Revisá
  el texto de apoyo a un tamaño de lectura parecido al teléfono, además del
  canvas grande. Un título legible no compensa un apoyo microscópico.
- Reservá un hold que permita entender el copy completo después de la entrada.
  Medilo con la frase y el propósito reales; no uses una duración fija porque
  quedó bien en otra pieza. Una explicación puede necesitar reposo.

Estudios útiles: grouped.news (`post-2104649028193632524`), Muse
(`post-2104213514944446825`) y Kotlin: la búsqueda
por título recupera sus observaciones y límites exactos.

## Tarjetas con un significado

- Elegí su relación: comparación, pertenencia, secuencia, selección o estado.
  Esa relación define alineación, conexiones y orden de entrada. Los bordes
  redondeados son parte de un sistema de superficies, no su explicación.
- Mantené escala de radios, padding, bordes y sombra coherente dentro de ese
  sistema. Separá el padding de la tarjeta del margen del texto; si el copy crece,
  ajustá el espacio o la composición antes de recortar contenido.
- Usá un titular común cuando varias tarjetas demuestren la misma idea. No
  repitas un mini encabezado y una entrada aislada para cada cosa sin propósito.
- Cuando cambia el contenido, conservá la tarjeta o el objeto que sigue siendo
  el mismo. Una selección, highlight o conexión tiene que responder al estado
  que el espectador está entendiendo.
- Una demo necesita acciones verificables del producto: las tarjetas no
  reemplazan la interfaz o la grabación cuando eso es lo que se demuestra.

RedShip (`post-2104230888812724497`) organiza problemas y una secuencia temporal;
Muse organiza capacidades bajo una tarjeta padre. Notion conserva tabla y
selección antes de cambiar permisos. Se transfieren relaciones, no marcas,
estadísticas o claims de esos productos.

## Entrada, hold, salida y continuidad

- Definí estado inicial, estado legible, hold y salida para cada objeto. El
  momento en que empieza a aparecer no es el momento en que puede leerse.
- Coordiná entrada y salida del texto con su superficie. Si pertenecen al
  mismo objeto, evitá que el texto desaparezca accidentalmente antes de que su
  tarjeta termine. Un stagger debe guiar un orden de lectura.
- Elegí una familia de curvas coherente con la intención y distancias acordes
  al layout. Un movimiento pequeño puede acompañar la lectura; una gran
  trayectoria necesita una razón y espacio. Rebotes y rotaciones son decisiones
  expresivas que requieren una intención concreta.
- En una transición, registrá qué objeto conserva identidad y cómo cambia su
  posición, tamaño, recorte y significado. Revisá ambos lados de la costura y
  el cuadro intermedio: dos estados bonitos no prueban una transición lograda.
- Cuando el brief es un sting continuo, pueden servir eje, dirección y velocidad
  compatibles en los cortes. Cuando es una explicación, dejá leer. La referencia
  textual Velocity-Matched UI Sting inspira ese criterio condicional; no impone
  movimiento permanente ni siete escenas a todos los videos.
- Un ancla persistente puede conservar unidad al cambiar fondo, layout o
  contenido. La esfera de Mebbian es un ejemplo estudiado; su adaptación plana
  no demuestra física 3D ni obliga a incorporarla al motor.

## Hacerlo editable y verificar el resultado

Traducí estas decisiones a nodos/keyframes nativos y componentes gobernados por
el tiempo de escena. Usá sólo APIs documentadas. Conservá Diffusion, fuentes
reales, identidad, copy y proveedor/esfuerzo acordados. No importes una película
de referencia para presentarla como una animación editable.

Primero construí el beat de mayor riesgo. Mirá un hold, un punto intermedio y el
final con el contenido real; corregí problemas concretos de lectura, recorte,
solape o discontinuidad. Verificá reproducción y seek cuando corresponda. En una
revisión de export, `syka_motion_review` trabaja sobre nuestro archivo del
proyecto. Las pruebas técnicas no sustituyen el juicio visual del usuario.

Registrá en `design.md` la jerarquía, fuentes, paleta y sistema de superficies;
en `frame.md`, contenido, propósito, tiempos y continuidad por beat. Un cambio
pequeño no necesita rearmar toda la dirección.

Procedencia y ejemplos: `collection-workflow.md`, los estudios recuperados por
`library.mjs` y `brief-and-review.md`. El catálogo completo contiene muchos
ejemplos aún no estudiados individualmente: no inventes conclusiones a partir de
su título ni conviertas la cantidad de archivos en evidencia estética.
