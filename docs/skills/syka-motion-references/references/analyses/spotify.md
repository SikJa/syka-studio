# Spotify: persistencia del player y del hero

Fuente: [@brainextends](https://prompt-motion.com/brainextends-e19ac3),
[post](https://x.com/brainextends/status/2103801834930606193).
Prompt local: `brainextends-606193.md`, 8142 caracteres, declarado completo en el
repo. El mismo texto normalizado figura en ambas fuentes.

Archivo de galería: 1920×1080, 30 fps, 18.065 s, audio AAC estéreo. Se observaron
12 frames uniformes y una costura adicional. No se certifica escucha, curvas
exactas ni todo el historial de creación.

| Tiempo observado | Resultado visual | Decisión útil |
| --- | --- | --- |
| 1.64 s | UI compacta centrada en un escenario negro redondeado, con verde alrededor | Separar el escenario y el contenido; la UI ocupa menos espacio que el marco |
| 3.27 s | Lista y player horizontal bajo ella | Un ancla secundaria conecta cambios de contenido |
| 6.55 s | Mismo cover iridiscente con nombre y artista | Mantener un único asset hero en búsqueda, detalle y cierre |
| 8.18 s | Interior verde, cover más pequeño, player aún presente | Cambiar color/escala conservando relaciones |
| 9.82 s | Cover ampliado y recortado, heading entrante | Máscara del escenario y ventanas de texto distintas |
| 13.09 s | Seis covers alineados | Colección ordenada, sin flotación aleatoria |
| 14.73–17.80 s | Covers convergen, logo y hold final | El cierre nace del centro existente y recibe tiempo de lectura |

La tipografía observada es sans, pequeña respecto del escenario; la familia
exacta no se identificó. El movimiento amortiguado es una inferencia; el prompt
pide springs/curvas cuidadas, pero el video no expone sus parámetros.

El prompt exige 60 fps y no agregar watermark; esta copia tiene 30 fps y muestra
`@brainextends` arriba a la derecha. No equivale a verificar el export original.
La existencia de audio no verifica 120 BPM ni alineación de efectos.

En Diffusion: player y hero persistentes con IDs estables; texto, imágenes y
keyframes nativos, o componente local gobernado por ticker para UI compuesta.
El blur temporal de 3–5 subframes queda como requisito no reproducido, no como
capacidad supuesta. No copiar marca, covers ni soundtrack para una producción.
