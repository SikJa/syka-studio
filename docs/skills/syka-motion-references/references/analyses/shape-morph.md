# Shape morph: una forma, varios estados

Fuente: [@twoclipping](https://prompt-motion.com/twoclipping-5cba86),
[post](https://x.com/twoclipping/status/2103273003555402193).
Prompt local: `twoclipping-402193.md`, 2711 caracteres, declarado completo y
coincidente entre fuentes. Archivo: 1440×1440, 60 fps, 14.059 s, audio estéreo.
Revisión: 12 frames uniformes y costura adicional; no escucha certificada.

| Tiempo | Estado observado | Relación conservada |
| --- | --- | --- |
| 0.00 s | Botón negro sobre fondo claro cálido | Centro y masa de la forma |
| 1.27 s | Forma circular con check | El botón concentra su ancho |
| 2.55 s | Player compacto con portada y controles | La misma zona central se expande |
| 3.82–5.09 s | Player → barra de volumen | El rectángulo pierde altura y conserva el eje |
| 6.36 s | Toggle claro | El knob y el track heredan la geometría anterior |
| 7.64–8.91 s | Tarjeta de gráfico con tabs y cifra | El track se convierte en contenedor con jerarquía propia |
| 10.18–11.45 s | Command palette y resultado de búsqueda | El texto entra después de preparar su espacio |
| 12.73–13.80 s | Regreso a botón | Aproxima el estado de apertura; no se certificó igualdad pixel a pixel del loop |

El cursor aparece junto a controles y acompaña la interacción. El video no
prueba que clicks/drags sean interacción real; puede ser coreografía renderizada.
El prompt define 120 BPM y siete barras, compatibles con una duración nominal
de 14 s; no se midió el tempo del audio. El pequeño overshoot y damping exacto
no se recuperan desde estos frames.

Para Syka: un objeto/ID conserva centro y geometría entre estados; duración de
transición y hold se parametrizan aparte del texto. Implementar la interpolación
como función del tiempo de escena. Mostrar cursor sólo cuando ayuda a explicar
una acción. Ventanas separadas para textos salientes y entrantes evitan solapes.
Texto nativo para edición individual; HTML para UI compuesta editable en fuente.
