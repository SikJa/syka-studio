# Tipografia, composicion y tarjetas en video

## Antes de mover

La tipografia es contenido y jerarquia, no una decoracion posterior. Lee el copy exacto y las fuentes disponibles (`context` / `fonts`); no asumas un peso que el archivo no tiene. Conserva la identidad del proyecto. Elige una familia y dos o tres niveles con contraste suficiente, sin imponer Inter ni una paleta universal.

Resuelve un styleframe quieto con el texto real: titulo, apoyo y etiqueta. El titulo domina por escala/peso; el apoyo explica; la etiqueta orienta. Prueba primero a la escala real de reproduccion (tambien una preview pequena). Evita condensar o escalar horizontalmente la letra para hacerla caber. Ajusta ancho, cortes semanticos, tamano o copy autorizado. No partas palabras ni truncas informacion esencial. Revisa tildes, signos, interlineado y espaciado con frames del renderer: una caja suficiente no demuestra que los glifos caben.

Para 1080p horizontal se puede explorar titulo 80-120 px, apoyo 32-44 px, padding 48-72 px y radio 28-40 px; son rangos iniciales para inspeccionar, no defaults de marca. Escala todo en conjunto para otras dimensiones. Usa una alineacion principal y una reticula: titulo, apoyo y evidencia comparten anclas. Deja aire alrededor del foco. El radio mantiene coherencia entre tarjetas, botones y superficies; la sombra separa planos sin competir con el texto.

## Entrada, lectura, salida

Primero llega el foco; el apoyo puede seguir 2-5 fotogramas despues. El stagger pertenece a jerarquia, no a cada letra por costumbre. La tarjeta y sus hijos pueden moverse como unidad para preservar relaciones. Conserva una pausa de lectura completa, sin blur ni oscilacion perpetua. No multipliques movimientos para aparentar calidad.

La llegada desacelera; la salida despeja espacio para lo siguiente y puede acelerar. Decide que objeto o ancla persiste entre beats antes de elegir una transicion. Usa `syka-motion-transitions`: `softRise` ofrece un recorrido corto nativo sin escala ni blur, con entrada y salida independientes. Para distancias personalizadas usa keyframes, no un preset y un track sobre la misma propiedad. Respeta start/end y el reloj de fuente.

## Revisar y comparar

Registra en design.md familia/pesos realmente disponibles, niveles, ancho de lineas, padding, radio y margenes. En frame.md: texto por beat, tiempos de entrada/hold/salida y objeto persistente. Vincula decisiones de referencias a timestamps observados, sin inventar curvas exactas desde stills.

Si el objetivo es mejorar calidad, compara con los mismos textos, assets, fps, dimensiones y duracion. Cambia una variable por variante: motion con composicion fija, luego jerarquia/composicion con motion fijo. Captura los mismos tiempos y mira el MP4 completo a velocidad normal. La preferencia estetica sigue siendo del usuario; un check tecnico no la resuelve. Audio se revisa solo si el encargo lo incluye.
