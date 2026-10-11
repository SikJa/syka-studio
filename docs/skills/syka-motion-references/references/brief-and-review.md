# Brief con decisiones recuperadas

Un prompt útil liga contenido, estados y validación. La longitud sola no alcanza:
el showreel de @himanshutwtxs parte de un pedido muy corto y obtiene un resultado
complejo; eso no permite recuperar el historial ni garantiza reproducirlo.

## Documentos del proyecto

No reemplaces acuerdos existentes. Para una pieza nueva, esta forma breve ayuda:

```markdown
# design.md
Identidad y fuente: ...
Familias disponibles / tamaños al formato final: ...
Paleta / contraste / margen de seguridad: ...
Assets originales, ubicación y derechos: ...
Invariantes entre planos: ...
```

```markdown
# frame.md
Objetivo verificable y contenido que no se puede inventar: ...
Referencia elegida: ID, URL y análisis leído.
Decisión observada: timestamp + qué relación visual se conserva.
Adaptación propia: técnica nativa + diferencia asumida.

| Beat | Inicio / fin / hold | Contenido exacto | Estado anterior → siguiente | Audio | Evidencia |
| --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... |

Beat de riesgo: ...
Capturas de hold / costura: ...
Seek repetido y export: ...
Revisión visual propia / aprobación real del usuario: ...
```

## Qué transferir según la intención

| Intención | Referencia y decisión observada | Adaptación Diffusion | Riesgo concreto |
| --- | --- | --- | --- |
| Producto con muchos estados | Spotify: player estable mientras cambian UI, colección y hero | Un ancla persistente, assets locales y grupos con revelaciones coordinadas | El hero no debe cambiar de identidad; 30 fps del archivo no prueba el render solicitado a 60 |
| Interfaz continua | Shape morph: botón, player, barra y comando ocupan el mismo centro | Rect/geometría de tiempo absoluto; hijos con ventanas de entrada/salida propias | Solape de dos textos dentro de una forma que está cambiando de ancho |
| Lanzamiento con footage | Hooklab: hook → interacción → clips seleccionados → resultado → cierre | UI o captura real y medios del usuario; causalidad del cursor | Ni métricas de rendimiento ni personas de la demo son nuestros assets |
| Imagen que pasa entre soportes | Develop: foto → teléfono → web → print | Un asset real, posiciones medidas, máscaras o marcos derivados de sus bordes | Glass/displacement y subframes son requisitos externos, no capacidades nativas demostradas |
| Discurso tipográfico | Build the Floor: las palabras se convierten en soportes de la frase final | Textos/rules con roles, lectura previa y posición de reposo | Deformar glifos o partir una frase antes de terminar de leerla |
| Demostración de producto real | Taxtello: seleccionar una relación entre recibo, fila y confirmación | UI real, detalle importante y transformación entre estados observables | El conteo, la veracidad de los datos y el historial de iteraciones requieren evidencia aparte |
| Correspondencia con referencia | Frame by Frame: dos películas alineadas conservan ritmo y cambian marca/contenido | Extraer beats y relaciones, usar copy/assets propios | La comparación publicada no demuestra una réplica hecha por nuestro agente |
| Explicar movimiento | Showreel: cada efecto demuestra la palabra, con contraste entre snap y easing | Cambiar tratamiento según significado; hold claro después del impacto | No convertir la variedad en partículas o rebotes sobre todo el video |

## Comprobar el beat difícil

En el formato de entrega, verificá un hold con el texto más largo y una costura
antes/durante/después. La nueva escena debe salir de un elemento reconocible,
o tener un corte deliberado que explique el cambio. Una cámara que reinicia
sin motivo, un objeto que aparece en otro centro o dos headings que compiten
son fallos concretos, aunque el componente compile.

Buscá legibilidad y estabilidad al seek, no parecido sólo en un thumbnail.
Conservá el reloj de escena y fuentes locales. No traslades las instrucciones
Playwright/ffmpeg del ejemplo como reemplazo del export Diffusion. Medí el
export que realmente sale: duración, resolución y fps pueden diferir del prompt.

En el ensayo nativo a 60 fps se observó que `capture` cuantiza al reloj interno
de 30 unidades/s: 479/60 s puede redondear a 8 s y caer fuera de un clip de 8 s.
Para validar ese borde, decodificá el último frame del MP4 real con FFmpeg y
usá un instante dentro del grid nativo para el hold de captura. Un pedido de
capturas fuera de orden se evalúa desde mounts nuevos y en orden temporal;
no lo presentes como prueba de seek hacia atrás de la interfaz. Ese seek se
verifica en el player vivo, comparando el mismo estado después de retroceder.

## Ensayo futuro: lanzamiento Syka Studio

Todavía no hay guion aprobado ni producción del lanzamiento. Antes de escribir
copy, revisar `SERVICE_MAP_SYKA.md`, el producto en funcionamiento y los assets
del proyecto. Construir una lista de funcionalidades con evidencia, estado real
y captura disponible. Referencias candidatas: Spotify para ancla persistente,
Shape para continuidad de UI y Hooklab para causalidad interacción/resultado.
Elegirlas por la historia que se decida; no imponer las tres.

Preparar screenshots propios, variantes originales del logo, formato de entrega
y posibles cues con música licenciada si corresponde. No anunciar soporte
Opus/Antigravity, métricas, publicación o automatización a partir de nombres en
la UI, docs o fixtures. Este ensayo es distinto de la muestra técnica de QA.
