# Lanzamiento guiado y personaje de marca

## Elegir referencias por su función

Partí de cuatro funciones posibles: hook (abrir con la promesa o tensión), proof
(mostrar el producto resolviendo algo), turn (hacer visible el cambio) y CTA
(dar un siguiente paso concreto). Son funciones del relato, no cuatro escenas
obligatorias ni una duración o estética universal. Un anuncio puede necesitar
varios beats para demostrar una función, y otro resolverla con un solo gesto.

Para cada función recuperá pocas referencias pertinentes mediante
`syka_motion_knowledge`. Presentá una propuesta con contenido real y una
alternativa si aporta otra idea. Reemplazar una referencia debe conservar la
marca, el texto aprobado, los tiempos de voz y el mapa de eventos. Anotá qué
conservar de cada ejemplo: ritmo, composición, transición o interacción.

## Mascota como actor de una acción

La mascota ES el orbe existente de Syka: conserva sus cintas, geometría, color
y animación. Se superponen ojos, boca y gestos; no se dibuja otra carcasa ni se
crea un personaje aparte. Sus gestos siguen esta secuencia: mirada al objetivo, anticipación corta, acción legible,
reacción del objeto y recuperación. La mascota no debe tapar copy, subtítulos,
rostros ni el control demostrado. Reservá un área segura para el personaje.

En la UI de Syka, manos y accesorios toman el color de acento elegido en
Personalización (el token --primary que publica el controlador de apariencia).
Las cintas conservan la identidad aprobada. La preview de cara con acento lleva
el mismo token a ojos y boca; la alternativa neutral usa cápsulas claras y llenas
inspiradas en Grok Bot. La opción de ojos negros con contorno fue descartada por
el usuario. No activar una variante de rostro en producción hasta elegir su diseño.
El cambio de acento debe verse en vivo, también si la mascota está pausada. En un video
exportado, la paleta del personaje pertenece al brief creativo del proyecto.

Ubicación propuesta en el editor: el mismo orbe vuelve a la cabecera del chat
cuando está disponible, acompaña la actividad mientras trabaja y se amplía para
preguntas. El viaje hacia la timeline o la preview es opcional. Mantener el
personaje fuera del cuadro del video y de los controles que la persona necesita.


Gestos reutilizables:
- Edición: acercar dos clips y marcar un corte.
- Subtítulos: escribir o acomodar una línea mientras aparecen palabras reales.
- Audio: auriculares y movimiento rítmico discreto; una onda decorativa no es una
  medición de audio ni evidencia de que la mezcla fue escuchada.
- Revisión: dirigir la mirada o una lupa a un detalle verificable.
- Pregunta: levantar la mano y mantener la pose hasta una respuesta.
- Cierre: gesto breve cuando existe un resultado disponible, sin porcentajes falsos.

En un anuncio, personaje, cursor, objeto y acento sonoro comparten el mismo mapa
de eventos y reloj absoluto de Diffusion. El renderer del editor sigue siendo
Diffusion. Para la interfaz de la aplicación, los gestos dependen de eventos
reales del agente; desconocido significa trabajando, no una tarea inventada.
Respetá pausa, movimiento reducido, visibilidad y tamaño pequeño. Nada debe
capturar el mouse por estar animado.

Preguntá música/sonidos/voz si esa decisión no está resuelta. Elegí sonidos del
kit por acción y material; pequeños acentos al colocar/cortar/completar son
opcionales. No sonorizar cada parpadeo ni repetir notificaciones en cada loop.

## Evidencia y límites de las referencias

Revisado el 2026-10-13. El post de lanzamiento guiado
https://x.com/HyperFrames_/status/2109689637216379019 anuncia selección de motions
por papel narrativo. En los fotogramas del video de 31,9 s se ven la mascota como
cursor, ejemplos de anuncios, cuatro funciones y la adaptación al sitio/marca.

El post https://x.com/HyperFrames_/status/2108644709946257524 anuncia HeyGen Video 1.
En los fotogramas del video de 65,2 s se ve un personaje leyendo, junto al composer,
acompañando recorte de fondo y señalando una búsqueda. Es evidencia de la puesta
en escena promocional, no prueba de una mascota operativa incorporada a su app.
No se verificó escucha del audio ni el renderer de esos dos videos. Las afirmaciones
de precio/ranking/modelo pertenecen al autor y no se convierten en capacidades de Syka.

El repositorio oficial sí incluye `lottie-character-walk`: cuerpo/gestos en Lottie,
escenario en GSAP, sincronizados mediante el runtime. Fuente:
https://github.com/heygen-com/hyperframes/tree/072f53cda9bb648ef0f4e00836825352e6619d39/registry/blocks/lottie-character-walk
También documenta cursor → presión → reacción:
https://github.com/heygen-com/hyperframes/blob/072f53cda9bb648ef0f4e00836825352e6619d39/skills/hyperframes-animation/rules/cursor-click-ripple.md

Esta adaptación es una receta original. No se redistribuyen los videos, su
personaje, ni el asset Lottie. La preview usa el renderer y preset composing de
thinking-orbs para el cuerpo. De Bloub reutiliza ojos, parpadeos y morph de
expresiones, sin Vue ni su cuerpo. Robot Heads aporta la referencia de actuación,
pero su carcasa no sustituye al orbe. No agrega servicios de generación pagos.

La boca se coloca a partir de las dimensiones proyectadas de ambos ojos,
incluyendo parpadeos y morph. Reservar una separación real: no fijar su posición
mientras los ojos cambian de altura. El hover sigue el puntero y recupera la pose
al salir; el foco de teclado tiene una respuesta equivalente. No sumar un bucle
permanente para esta interacción ni continuar animando al ocultar la ventana.

La preview actual reutiliza AgentComposer, AgentQuestionNotice, MessageBubble y
AgentToolChipsTrace. El orbe ocupa el icono de la actividad y el ancla de pregunta;
no se inventa otro editor. Sus herramientas son fixtures que pasan por
mascotActivity, no una prueba de actividad real del proveedor. Referencia visual
revisada: https://x.ai/bot y https://x.ai/news/designing-grok-bot.

## Referencias de personaje adicionales

- https://bloub.vercel.app/ y https://github.com/jeremy-prt/bloub
  Commit `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`. Aporta morph de expresiones,
  parpadeo, mirada y deformación independientes del reloj. La licencia cubre el
  código; no usar la identidad x.ai imitada en su demo. Adaptar forma y material.
- https://robot-heads.fayaz.workers.dev/ y https://github.com/fayazara/robot-heads
  Commit `58ebf6439a8125a769f63b22ffd35bc18834b1b5`. Robot TV con volumen simulado,
  reflejos, ojos LED y estados. Es Canvas 2D, no requiere WebGL. Su estado working
  contiene una barra decorativa: no mostrarla como progreso real del proyecto.

La cara aprobada conserva ojos claros rellenos y liga ojos, boca y manos al
acento del usuario. Blanco es la opción de la preview; no ofrecer acabados
alternativos como negro, metal o cristal en este flujo.

El rostro ya está conectado al orbe compartido del chat y al de las notificaciones.
El encabezado usa una fila: sesiones, Assets, orbe centrado de 48 px, Chat y
desacoplar. Los avisos conservan su mensaje y fondo negro; preguntas, bloqueos y
avisos informativos tienen expresiones distintas.

Los viajes son gestos breves de presentación, nunca cambios del proyecto ni
medidas de progreso. Sólo una herramienta de edición nativa activa dispara el
viaje a un espacio reservado de la timeline. Al adjuntar una referencia viaja
al costado del origen visible (12 px de separación), la recoge y vuelve. Nunca
superponer el cuerpo o la referencia que lleva sobre la tarjeta, su texto o
sus controles. Buscar otro lado libre u omitir el gesto si no hay espacio.
El gesto de timeline debe caber completo dentro de su slot reservado.
Una pregunta interrumpe el recorrido;
reduced motion, ventanas ocultas y destinos fuera de pantalla lo suprimen.
No bloquear clics durante el viaje ni mantener su RAF una vez terminado.

La preview del editor reutiliza el encabezado, portal, renderer, notificación y
composer de producción sobre una captura local del editor. Sus eventos son
fixtures: no prueban una ejecución nueva del proveedor. La identidad siempre
es el orbe original; nunca reemplazarlo por otra carcasa o personaje.
