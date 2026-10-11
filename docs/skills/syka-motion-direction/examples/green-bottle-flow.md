# Botella verde: conversación → datos → superprompt

**Demostración.** Las respuestas de abajo son hipotéticas. No representan
preferencias ya confirmadas del usuario ni una animación producida. El ejemplo no
trae foto/modelo/música de una botella: define una ilustración original y deja la
selección sonora pendiente de escucha. No incluye métricas musicales inventadas.

## Cómo se vería la conversación

**Usuario:** «Haceme un prompt de una botella verde».

**Agente, en la tarjeta de preguntas del chat:**

1. «¿Querés una imagen fija o un motion? Si es motion: ¿presentar el producto,
   venderlo o contar una idea? ¿Para quién y dónde se va a ver? Sumá duración y
   formato si los tenés; podés delegarlos».
2. «¿Tenés una foto/modelo y marca reales, o inventamos una botella? ¿Qué texto
   exacto debe aparecer? ¿Qué tono/referencia querés? Podés delegar el diseño».
3. «¿Música, efectos, ambos o silencio? ¿Lleva voz? ¿Tenés un tema o referencia
   sonora, o querés que te proponga el tratamiento?».

**Respuesta hipotética:** «Motion de producto para un reel, 15 segundos vertical.
Para gente que aprecia diseño simple. Inventá una botella verde, sin marca ni
beneficios falsos. Que diga “VERDE. SIMPLE.”. Sobrio, con música y un par de efectos,
sin voz. Elegí vos la dirección y el audio; mantenelo editable».

**Agente:** «Voy con una botella opaca estilizada sobre fondo crema: silueta,
detalle del acabado, producto completo y cierre tipográfico. Mantengo el mismo
objeto entre planos. Propongo una base electrónica cálida y tres acentos suaves;
el tempo y los ataques se fijan después de elegir y escuchar los archivos».

Esto delega decisiones faltantes; no es una segunda autorización obligatoria.
Si fuera imagen fija, se tomaría la ruta de imagen, sin inventar una timeline
ni música. Si ya hubo respuestas para esta pieza, se reutilizan.

## Qué recibe el compilador

[green-bottle-brief.json](green-bottle-brief.json) contiene las especificaciones,
la consulta hipotética marcada, las funciones de tres referencias documentales,
cuatro beats y eventos visuales/sonoros/revisión. Se envía a `syka_motion_plan`.
El resultado `ready` significa **brief compilable**, no assets creados ni calidad
aprobada. Aquí el producto y el sonido todavía no se construyeron.

[green-bottle-production-prompt.md](green-bottle-production-prompt.md) se genera
con el compilador real. Conserva los seis bloques: inputs, direction, structure,
build, gotchas y start/review. El JSON ordena datos y tiempos; el documento extenso
explica la intención y cómo construir/revisar. No es necesario elegir entre ambos.

| Tiempo | Foco | Sonido propuesto |
|---|---|---|
| 0–3 s | La silueta revela el producto | Entrada musical breve; acento al asentarse a 0,70 s |
| 3–7 s | Detalle del acabado y curva del hombro | Base contenida, sin efectos en cada cambio |
| 7–10 s | Vuelta al producto completo | Cambio de energía y acento a 7,50 s |
| 10–15 s | Copy legible y cierre | Acento discreto a 12,35 s; decay y fade completos |

## Cuando se produce una pieza real

1. Consultar los datos que cambian la pieza y registrar respuestas reales.
2. Buscar/leer referencias por función y declarar qué evidencia se inspeccionó.
3. Compilar y guardar el plan/prompt/vistas; resolver recursos dentro de la dirección
   delegada y conservarlos con rutas relativas.
4. Elegir/generar y escuchar audio, analizarlo con `syka_audio_analyze`; recién ahí
   guardar `assetCuePointSeconds` medido. No confundir el tiempo de la acción visual
   con el inicio del archivo cuyo ataque llega después.
5. Construir nativamente, resolver `motion_events` y recalcular los cues si cambia
   la timeline. Capturar/revisar styleframes, lectura y seeks de la fuente real.
6. Con un export solicitado ya disponible, revisar candidatos de flashes/loop y
   audio del archivo. Corregir defectos concretos; entregar la fuente editable y
   describir qué se comprobó. No exportar solo porque esta demo menciona revisión.
