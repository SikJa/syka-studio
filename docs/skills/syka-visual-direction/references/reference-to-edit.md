# De una referencia a una edición que funciona

Usar en una edición completa, una nueva dirección o una corrección de calidad;
no reiniciar este proceso para cambiar una palabra o el color de un elemento.

## 1. Resolver qué cuenta el material

Escuchá si la herramienta disponible lo permite; si sólo tenés transcripción,
declaralo y mirá los fotogramas correspondientes. Separá hechos del material,
pedidos del usuario y suposiciones de diseño. No agregues métricas, marcas ni
un CTA inventado para llenar una tarjeta. Conservá lo que el usuario pidió
mantener. Una referencia de estilo no autoriza cambiar el sentido de la voz.

## 2. Extraer tres decisiones de la referencia

Anotá en el `frame.md` existente:

- **Composición:** dónde está el foco y cuánto ocupa; tipografía y densidad.
- **Tiempo:** entrada, hold legible y salida; qué pasa en un punto intermedio.
- **Continuidad:** qué elemento permanece y qué cambia entre estados.

Anotá también qué NO estás copiando: por ejemplo imágenes de demo ajenas, su
marca o una cámara 3D que no existe en el componente elegido. Si no pudiste ver
el ejemplo, no lo describas como analizado. El título del catálogo no alcanza.

## 3. Buscar una técnica disponible

`syka_resources {action: "list", kind: "motions"}`. Los motions incluidos traen
`componentPath`, `componentFiles`, `usage` y muestra MP4. Leé sus fuentes y README
con `syka_read_reference` (rutas incluidas dentro de docs) o la terminal para
bibliotecas personales, copiá los archivos requeridos a `components/` del proyecto y
reemplazá medios/textos. Las rutas de biblioteca no deben quedar como dependencias
externas de un proyecto portátil. El código local importado sigue siendo editable.

- **Órbita:** una idea o funcionalidad que necesita presencia. Una tarjeta,
  texto breve, giro de presentación y pausa. No usar para cuatro párrafos.
- **Carrusel circular:** una colección real de imágenes, portafolio o ejemplos.
  `fit="contain"` si hay que leer la captura completa; `cover` sólo si el recorte
  respeta el sujeto. Ajustá `secondsPerCard` al tiempo de lectura.
- **Callout/comparación:** elegir el ejemplo editorial cuando una relación o
  diferencia importa más que mostrar una colección. No cambiarlo por un carrusel
  porque sea la última novedad del catálogo.

## 4. Probar el beat difícil antes de multiplicarlo

Construí una muestra reversible de 4–8 s dentro de la edición autorizada.
Usá el texto más largo y el medio de mayor riesgo, no lorem ipsum.
Mirala al tamaño de entrega: en vertical, cara y captions necesitan su espacio.
Un HTML tiene una capa nativa seleccionable; sus hijos se editan en props/fuente.
Si el usuario necesita manipular cada palabra desde Propiedades, preferí texto
y keyframes nativos. No prometas esos controles sobre DOM rasterizado.

Comprobá un hold, mitad de movimiento y corte. La aceptación visual responde:

1. ¿Se entiende la idea sin leer la explicación del agente?
2. ¿Hay tiempo para leer a la velocidad final, sin tapar rostro ni subtítulos?
3. ¿El movimiento explica la idea o sólo disimula una caja vacía?
4. ¿La imagen, el logo y la palabra clave son los correctos?
5. ¿La tipografía, el contraste y el espaciado se acercan a la referencia?

Corregí el fallo concreto antes de replicar el patrón. No marques “aprobado por
el usuario” a partir de tu propio gusto. Una validación técnica y una evaluación
visual son evidencias distintas.

## 5. Guardar una entrega verificable

Receta existente + `frame.md` + componentes y medios locales. Por beat registrar
inicio/fin, frase exacta, elemento/ID, propósito del movimiento y audio asociado.
Captura de lectura y transición, seek repetido al mismo instante y export cuando
fue solicitado. Si hubo una limitación de motor o recurso, registrar cuál.

Esto mejora instrucciones y contexto. No entrena pesos ni garantiza que todos
los modelos sigan igual la dirección; hay que evaluar una edición real por modelo.

Referencias de proceso consultadas: HyperFrames Prompt Guide, Design/FRAME.MD,
Studio Animation y catálogo público, 2026-10-06. Adaptación propia para Diffusion;
sin requisito de entrevista, aprobación adicional ni capas decorativas forzadas.
