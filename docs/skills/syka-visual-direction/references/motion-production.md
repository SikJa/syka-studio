# Producción de motion que se entiende

Leé esto para una pieza completa o una mejora amplia de calidad. Conservá
Diffusion, el brief y el proveedor/esfuerzo elegidos. Un cambio de texto no
necesita este recorrido. Las reglas se adaptan al género: no conviertas un
editor de producto en un dibujo animado permanentemente inquieto.

## Resolver antes de repetir

Registrá en `design.md` qué debe recordar el espectador, destino/formato,
fuentes y pesos disponibles, copy real, assets originales y límites del
producto. Reutilizá la receta y componentes aprobados. Si falta un screenshot
real, avanzá con el resto y señalá esa carencia; no dibujes una función falsa.
Una interfaz ficticia puede servir para una ficción explícita, no para probar
funciones reales. No introduzcas números o claims desde una referencia.

Extraé de las referencias relaciones concretas: qué domina, cuánto dura la
lectura, cómo viaja el foco, qué objeto conserva identidad y cómo cambia su
estado. Un frame informa composición; una secuencia informa movimiento.
Asociá observación con URL/ID y tiempo; diferenciá inferencias. Preferí
material propio aprobado cuando explica mejor la marca que un video viral.

En `frame.md`, por beat, anotá:

| Intervalo | Qué entiende el espectador | Estado de entrada → salida | Foco y ancla persistente | Lectura estable | Cue real |
| --- | --- | --- | --- | --- | --- |
| 0–3 s | Una idea concreta | Tarjeta cerrada → detalle visible | Superficie y título | Después de asentarse | Si existe audio |

Cada beat resuelve una lectura o una acción. Si hay demasiada información para
la duración acordada, simplificá o redistribuí el contenido; no aceleres todas
las capas. Una lista de efectos no explica qué aprendió quien mira.

Probá primero el tramo con más riesgo: el título más largo, un panel que cambia
de tamaño o una costura con dos textos. Resolvé sus cuadros de reposo con copy
real antes de animarlo. Usá fuente/asset real y nodo o componente editable;
un MP4 de muestra sólo sirve de referencia. Después repetí el patrón que pasó
la revisión. Una preview pequeña sirve de animatic; el export final sigue
saliendo de Diffusion.

## Hacer viajar la mirada

El comienzo establece el tema y un foco entendible. Antes de una acción
importante, llevá la mirada a su origen con posición, contraste o una señal
breve. En una demo: selección → acción → respuesta → lectura; no cambies la
pantalla antes de que se entienda qué hizo el cursor. Evitá dos causas o dos
títulos dominantes compitiendo al mismo tiempo.

Después del movimiento, dejá tiempo para localizar y leer. El hold estable
no es un defecto: contar más cosas o mover un fondo no mejora automáticamente
el ritmo. Contrastar acciones breves con pausas claras suele ayudar. El último
mensaje también tiene un hold antes de cerrar. Un final vacío puede ser una
salida deliberada, pero no debe comerse el CTA ni parecer un frame perdido.

Diseñá juntos el final de A y el inicio de B: ubicación del ancla, tamaño,
radio, color, dirección y foco. Conservá las keys de los objetos persistentes.
Si una trayectoria cruza el cambio, no reinicies cámara ni agregues dos
desaceleraciones a cero. Un corte es válido cuando aclara la historia. Un
loop sólo se prepara cuando se pide: revisá la costura de vuelta, no sólo
la semejanza de dos stills.

## Elegir la conducta de cada objeto

- Texto: desplazamiento breve, llegada estable, lectura sin blur ni estiramiento
  de glifos. Entrada por jerarquía; no por letra sin razón. `softRise` es una
  opción nativa, no una obligación de estilo.
- Tarjeta/panel: transformá superficie y distribución desde un ancla reconocible.
  Radio, padding, alineación y sombras mantienen relaciones durante el cambio.
  Un settle pequeño puede ayudar; un overshoot que invade el texto requiere ajuste.
- Cursor/UI: recorrido y respuesta causales, overshoot mínimo. No hagas click
  donde todavía no existe el control ni ocultes la respuesta inmediatamente.
- Cámara: movimiento que revela una relación, encuadre que deja leer. No derives
  fluidez de aplicar un zoom constante a todos los beats.
- Personaje/objeto expresivo: anticipación, arco y reacción pueden funcionar;
  el movimiento secundario acompaña la acción principal. Squash de un cuerpo
  no implica squash de la tipografía o del logo de una marca.

No uses una sola curva para todo. Diffusion ya tiene keyframes con `gentle`,
`snappy`, `bouncy`, `strong` y `spring(bounce,duration)`; leé su contrato local.
Esos easings de segmento no son un solver acumulativo de múltiples cambios
de target. Para una nueva trayectoria, inspeccioná continuidad de posición y
velocidad antes de afirmar física continua. No instales otro motor para
recrear una técnica que puede resolverse con el sistema actual.

Los estados se calculan por tiempo absoluto de escena/fuente. Nada acumulado
por delta o reloj real gobierna el export. Para textura aleatoria, semilla por
objeto y tiempo de dibujo: agregar otra capa no debe cambiar el patrón de las
capas existentes. Probá seek fuera de orden en el player; decodificar dos veces
un MP4 no demuestra ese contrato.

## Sonido y versiones de formato

Si hay pista real, analizá sus cues antes de fijar la animación. Referencias
de BPM no prueban beats del archivo. Programá sonido y acción en el reloj
de la composición; dejá espacio a voz y evitá un whoosh en cada entrada.
Escuchá la mezcla completa y el tramo corregido. No impongas música, síntesis
o -14 LUFS a un brief silencioso o a todo destino.

Para cada formato solicitado conservá historia y contenido, pero resolvé
layout propio: cortes semánticos, tamaño de lectura, cantidad de elementos,
encuadre y márgenes. El ancho de prueba de 360 px no transforma 16:9 en 9:16.
No recortes el horizontal y lo llames adaptación vertical. Si reutilizás la
misma timeline, los tokens/layouts varían sin inventar información nueva.

## Cerrar una ronda

Usá `syka-edit-review/references/motion-evidence.md`: export nativo, evidencia
real, hasta tres defectos con tiempo y corrección local, y nueva inspección.
Conservá primera versión y versión corregida para comparar. Dos o tres rondas
pueden servir; no persigas un autoscore hasta gastar el presupuesto. Reportá
pendientes concretos y qué sigue siendo juicio estético del usuario.

Guardá tokens, componentes y decisiones útiles en la receta; revisiones y
exports en el proyecto. El siguiente encargo reutiliza conocimiento de marca,
no todos los efectos del anterior. No crees un nuevo chat por marca de oficio.

## Procedencia y límites

Adaptación original para Syka de la investigación del 2026-10-07:

- [seeco, artículo](https://x.com/i/article/2106091215502422016), leído por
  [espejo público](https://api.fxtwitter.com/seeconvm/status/2106096193235259564).
  Referencia editorial; no licencia para redistribuir su artículo ni prueba
  de rendimiento de un modelo.
- [ClaudeAnimationBase / ANIMATION_GUIDE.md](https://github.com/JohnHeibel/ClaudeAnimationBase/blob/0ac8bf2b31942376cb6b8c4074715595d512acd2/ANIMATION_GUIDE.md),
  MIT: lenguaje de lectura, anticipación y revisión. No se copió su código,
  personaje ni reglas específicas de p5.brush, prohibición de texto o movimiento perpetuo.
- [PDoomVideo / ANIMATION_GUIDE.md](https://github.com/JohnHeibel/PDoomVideo/blob/fa546a38092e75f2b079e6a86d6abc54dd525d17/ANIMATION_GUIDE.md),
  consulta de continuidad y plan de capítulos; sin licencia declarada en GitHub
  al investigar. No incorporamos código, canción, personaje ni guía completa.
- [Anime.js springs](https://animejs.com/documentation/easings/spring/): referencia
  de curvas; el contrato vigente de Syka es `reference/jsx/keyframes.md`.
- [What Ships](https://whatships.com/): búsqueda opcional de ejemplos de producto,
  no catálogo local analizado ni permiso para reutilizar todos sus medios.
