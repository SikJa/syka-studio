# Superprompt de motion v2: formato y ejemplo completo

Estado: propuesta para la futura skill. No se instaló una skill nueva ni se cambió el flujo del agente. Las cuatro previews de pregunta son prototipos interactivos separados.

## Dos capas de un mismo plan

Propongo **JSON para el contrato de producción** y **un prompt creativo extenso, con secciones Markdown o XML, generado desde ese contrato**. El JSON permite validar duraciones, contenido, referencias y cues. El documento explica intención, relaciones visuales, coreografía y criterio de revisión. La calidad depende de esas decisiones y de comprobar la pieza; cambiar la sintaxis no completa un brief insuficiente.

La documentación de [Anthropic sobre estructura de prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags) recomienda separar instrucciones, contexto y ejemplos mediante etiquetas descriptivas. Esto respalda su uso como delimitadores; no demuestra que XML sea universalmente superior a JSON o Markdown para todos los modelos.

La skill propuesta debe recuperar ejemplos pertinentes y producir un documento completo. No debe abreviar automáticamente el plan que consume el agente porque el resumen visible al usuario sea corto. El tamaño del prompt surge de las decisiones necesarias, sin una cantidad obligatoria de palabras.

## Información que tiene que contener

1. Encargo, público, canal, emoción y mensaje que debe recordarse.
2. Pregunta inicial y respuesta real; decisiones del usuario separadas de decisiones delegadas.
3. Referencias con ID, URL, tipo de evidencia y relación concreta que se adapta.
4. Contenido exacto, jerarquía tipográfica y límites de lo que se puede inventar.
5. Paleta, grid, coordenadas, márgenes, fuentes y variantes disponibles.
6. Identidad de los objetos persistentes y relación entre estados.
7. Storyboard por escena con preparación, entrada, hold, transformación y salida.
8. Trayectorias, distancias, curvas, amplitud y duración de cada movimiento importante.
9. Música, silencios, cues de SFX y relación temporal con la imagen.
10. Capacidades nativas verificadas, recursos faltantes y adaptación de técnicas externas.
11. Construcción editable, reloj absoluto, reproducibilidad y export.
12. Revisión de momentos concretos, criterios técnicos y valoración visual/auditiva.

Una referencia necesita explicar qué decisión resuelve. Una lista de links no cumple esa función. Los prompts completos, los fragmentos de posts y las observaciones de videos anteriores siguen siendo evidencias diferentes.

## Contrato de datos propuesto

Este fragmento muestra la forma, no es un schema instalado ni un plan completo:

```json
{
  "schemaVersion": 1,
  "brief": {
    "request": "Una pieza sobre el alma y el Big Bang",
    "question": "¿Poético y abstracto, o explicativo y visual?",
    "answer": "Poético, 20 segundos y con música protagonista",
    "delegated": ["copy", "paleta", "coreografía"]
  },
  "output": {"width": 1920, "height": 1080, "durationSeconds": 20, "fps": 60},
  "references": [{
    "id": "post-2103458245213929495",
    "evidence": "prompt_text",
    "adapt": "Las palabras cambian el espacio y preparan la declaración final"
  }],
  "beats": [{
    "id": "opening",
    "startSeconds": 0,
    "endSeconds": 2.5,
    "text": "Antes del ruido.",
    "entrance": {"startSeconds": 0.35, "durationSeconds": 0.6, "yFromPx": 28},
    "hold": {"startSeconds": 0.95, "endSeconds": 2.05},
    "exit": {"startSeconds": 2.05, "durationSeconds": 0.45},
    "persistentObject": "origin-point",
    "audioCueIds": ["opening-air", "expansion"]
  }],
  "cues": [{"id": "expansion", "timeSeconds": 2.5, "kind": "visual-and-audio"}]
}
```

Tiempos en segundos como unidad canónica, con conversión explícita a samples y frames. Una palabra transcrita o un cue puede caer entre frames; no se altera su reloj para simplificar la grilla. Escena, audio, prompt y evidencia deben consumir el plan vigente, evitando mantener copias independientes de los mismos números.

## Ejemplo de prompt completo

El siguiente es un ejemplo original para un brief hipotético respondido. No es una animación ya producida ni una instrucción activa. La elección de copy y dirección se supone delegada por el usuario.

### Encargo y alcance

Creá una pieza tipográfica y abstracta de **20,00 segundos**, 1920×1080 a 60 fps, editable en Diffusion. La idea relaciona el origen del universo con la experiencia de mirar y dar sentido. El alma se trata como metáfora poética; no se presenta una afirmación científica sobre su existencia ni sobre una relación causal con el Big Bang.

El usuario eligió enfoque poético, veinte segundos y música protagonista. El copy, la paleta y la coreografía son decisiones creativas delegadas. Conservar esos acuerdos en la receta. Si el proyecto abierto tiene una identidad previamente acordada, adaptar esta dirección antes de reemplazarla.

La pieza debe sentirse íntima al principio, amplia durante la expansión y cercana en el cierre. Un punto persistente conecta toda la historia. El interés surge del cambio de escala y del espacio que adquieren las palabras. La música sostiene la progresión y deja una pausa audible para la pregunta central.

### Referencias y transferencia

- [Build the Floor, @Gdgtify](https://skillry.dev/ai-videos/opus-5-5/gdgtify-929495), ID `post-2103458245213929495`: tomar la progresión de la composición mediante palabras y la preparación de una declaración final. Adaptación: las palabras abren y reúnen el espacio alrededor del punto. Usar texto nativo; no asumir deformación de glifos ni máscaras de sus contornos.
- [UI continua, @twoclipping](https://skillry.dev/ai-videos/opus-5-5/twoclipping-402193), ID `post-2103273003555402193`: tomar un objeto reconocible que cambia de estado y el timing independiente de sus hijos. Adaptación: el mismo punto se convierte en expansión, centro de un campo y presencia cercana. No copiar la interfaz, el cursor ni su renderer.
- Las reglas tipográficas incluidas en Syka aportan lectura, jerarquía, line breaks semánticos y revisión a tamaño pequeño. Las referencias anteriores se consultan como texto de prompts; los estudios visuales previos no equivalen a haber visto sus videos durante esta producción.

### Copy y jerarquía

Usar estas líneas, en este orden:

1. «Antes del ruido.»
2. «Todo era posibilidad.»
3. «El universo encontró forma.»
4. «¿Y nosotros?»
5. «Quizás el alma sea / nuestra forma de mirar.»
6. «Del origen, una pregunta.»

La barra de la quinta línea indica un salto semántico de línea, no un carácter visible. El agente debe medir las frases con las fuentes reales. No partir «forma de mirar» ni reducir todo el sistema tipográfico para resolver una frase larga. Ajustar esa composición en particular.

### Dirección visual y tipografía

Fondo tinta `#11171B`; texto papel `#EFE8DC`; acento cálido `#D3916F`; geometría secundaria `#758793`. Mantener un contraste claro y reservar el acento para el punto persistente y momentos de énfasis. El campo abstracto no debe competir con las palabras.

Safe area inicial: 160 px a izquierda/derecha, 128 px arriba y 140 px abajo. Centro geométrico: (960, 540). Ancho máximo del bloque principal: 1520 px. Máximo dos líneas para las frases. Reservar separación suficiente entre texto y campo; revisar la caja real y el resultado rasterizado.

Inter, variante real 500/600, para frases directas. Instrument Serif, variante italic real 400, para la reflexión. Confirmar disponibilidad antes de diseñar. No usar un fallback silencioso; si falta una fuente, escoger una incluida con el mismo rol y actualizar el documento.

Escala inicial para medir: Inter 112 px en apertura, 96 px en la frase larga, 156 px en «¿Y nosotros?». Instrument Serif italic 116 px para las dos líneas de reflexión. Cierre Inter 84 px. No aplicar stretch horizontal a las letras. Medir el tracking en unidades reales de la API. Validar también a 360 px de ancho.

### Objetos y continuidad

`origin-point` nace en el centro, con diámetro inicial 10 px. Su centro y color siguen siendo reconocibles entre estados. Cuando su expansión llena el plano, una oclusión completa permite reorganizar elementos secundarios. Los textos conservan ventanas propias de entrada y salida; un cambio de geometría no arrastra una frase ilegible ni superpone dos frases.

El campo usa pocos círculos/reglas o partículas de distribución precalculada. Semilla fija por proyecto; ninguna llamada aleatoria nueva por frame. Su posición deriva del tiempo absoluto. Evitar acumulación de física entre frames y mantener la misma escena al buscar un instante en cualquier orden.

### Storyboard y coreografía

| Tiempo | Preparación, movimiento y lectura | Continuidad y audio |
| --- | --- | --- |
| 0–2,5 s | Fondo limpio. Punto visible desde el inicio. «Antes del ruido.» entra de 0,35 a 0,95 s con desplazamiento vertical 28→0 px y opacity 0→1. Hold 0,95–2,05 s; sale 2,05–2,50 s, 0→−14 px. | Aire tenue desde el inicio; el punto prepara la expansión. |
| 2,5–5 s | El punto se expande con una aceleración controlada y pasa a un campo abierto. La segunda frase entra 2,95–3,50 s, se lee hasta 4,45 s y sale hasta 4,85 s. | El mismo centro sostiene la transformación. Primer crecimiento armónico y SFX suave en el cue `expansion`. |
| 5–9,375 s | El campo se ordena en pocas relaciones. «El universo encontró forma.» entra 5,35–5,95 s; hold hasta 8,70 s; salida 8,70–9,10 s. | El motivo musical adquiere forma; los movimientos importantes comparten cues. |
| 9,375–12,5 s | La geometría secundaria se retira. «¿Y nosotros?» entra 9,55–10,10 s y queda estable hasta 11,90 s; sale hasta 12,30 s. | Pausa de 10,625–11,250 s en música y foley, con rampas de borde; no insertar otro efecto sobre ese silencio. |
| 12,5–17,5 s | El punto vuelve cercano. Primera línea de reflexión entra 12,80–13,40 s; segunda 13,10–13,70 s. Ambas se leen completas 13,70–16,85 s; salida coordinada hasta 17,30 s. | Regreso del tema con menos densidad. El campo deja espacio a la frase. |
| 17,5–20 s | Cierre entra 17,65–18,15 s, hold hasta 19,40 s y salida 19,40–20 s. El punto y fondo llegan a un reposo deliberado. | Resolución y fade de audio hasta cero. No se pidió loop. |

Las entradas usan ease-out controlada; las salidas una aceleración breve. La geometría puede tener un settle pequeño, con amplitud medida. Las letras no necesitan rebote en cada entrada. La cámara, si se usa, se limita a escala 1,00→1,04 en un tramo elegido y deriva del mismo reloj; revisar su efecto sobre lectura y clipping.

### Música, SFX y cues

Score original, estéreo 48 kHz, veinte segundos: 960000 samples por canal. Propuesta musical a 96 BPM, ocho compases de 4/4 en veinte segundos. La grilla guía la música; la lectura y la pausa pueden dominar un evento visual. No exigir un golpe en cada beat.

Tres stems separados: armonía, motivo y foley. Armonía cálida con ataque suave; motivo corto que adquiere claridad después de la expansión; foley fino para cambios importantes. Reservar el registro grave para la expansión y evitar transitorios que tapen la frase central. Sin narración ni audio tomado de las referencias.

Definir cues con nombre para aire inicial, expansión, orden del campo, pregunta, silencio, retorno y resolución. Usar los mismos tiempos en movimiento y audio. Medir el inicio y peak del SFX si su ataque desplaza la sensación de coincidencia. Fade final terminado en 20 s, sin colas ocultas.

Verificar clipping, peak, duración y presencia de los stems. Medir loudness del archivo final y ajustar al destino; no convertir un valor escrito en este prompt en una medición. Escuchar a velocidad normal cuando exista una capacidad de escucha o feedback humano; informar el alcance real de la revisión.

### Construcción, recursos y export

Usar textos, formas, audio y keyframes nativos. Para el campo procedural, usar un componente local por tiempo absoluto, con identificadores y parámetros documentados. Mantener nombres claros y fuente editable. Conservar los assets del usuario y el mecanismo de undo de Syka.

No trasladar el renderer HTML de los ejemplos. Motion blur temporal, oclusión de personas y deformación de contornos no se consideran disponibles sin una comprobación específica. Si una técnica no está soportada, diseñar una relación equivalente con nodos nativos y explicar la adaptación.

Cargar y resolver las fuentes antes de medir o capturar. Generar primero el tramo de expansión y la frase más larga como prueba de riesgo. Corregir su defecto antes de extender el patrón. Export final de 1200 frames a 60 fps; comprobar resolución, duración real, streams y último frame decodificado.

### Revisión y entrega

Inspeccionar holds de 1,50; 3,90; 7,00; 10,80; 15,00 y 18,80 s. Revisar secuencias antes/durante/después de las costuras de 2,50; 5,00; 9,375; 12,50 y 17,50 s. Usar frames reales del export para costuras y final; una captura puede cuantizar al reloj interno y no coincide necesariamente con un frame del MP4.

Revisar lectura a tamaño pequeño, clipping, orden del copy, objetos que cambian de identidad, restos de la frase anterior, pausa audible y fade final. Probar playback y seek fuera de orden en el player. Vincular evidencia al export y a su revisión: un snapshot posterior no demuestra que un video viejo contiene los cambios.

La mejora iterativa se registra como defecto + timestamp + cambio + evidencia posterior. Los checks técnicos no asignan automáticamente una nota estética. Entregar MP4, fuente editable, recursos necesarios, documentos de dirección y revisión, y un resumen claro de lo comprobado y lo pendiente de valoración.

## Qué falta para convertir esto en la skill activa

Implementar el contrato/validación y la transformación a documentos; integrar la pregunta obligatoria en el host; resolver respuesta/cancelación/reconexión sin depender del proveedor; conectar cues con escena/audio y comprobar el flujo con turnos reales de cada proveedor habilitado. Las previews permiten elegir la presentación visual de la pregunta antes de ese cambio.
