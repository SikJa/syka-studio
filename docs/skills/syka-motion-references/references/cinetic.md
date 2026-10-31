# Cinetic dentro del arnés de Syka

Se incluyen 273 técnicas de 14 categorías del catálogo MIT de Leonxlnx/cinetic,
commit ecfa6605de1adb9345ce937724810dc32267d068. El índice es local y cada técnica
tiene un texto separado con receta, cuándo usarla, cuándo evitarla y timing.
Procedencia y licencia: `vendor/cinetic/SOURCES.json` y `vendor/cinetic/LICENSE.txt`.
No se instala el renderer, una skill global ni dependencias de Remotion/HyperFrames.

## Recuperar poco y bien

En una pieza nueva o cambio amplio, combiná una referencia visual útil con 2–3
técnicas que resuelvan apertura, demostración o continuidad; no releas el catálogo.
Conservá las técnicas aprobadas de la pieza actual. Consulta de ejemplo:

```json
{"query":"apertura lanzamiento producto","collection":"cinetic","kind":"skill","techniqueFormat":"launch","energy":"medium","limit":3}
```

Después leé sólo la técnica elegida, con `id`, `includeText:true`, `textLength:3000`.
Si queda truncada, seguí `nextTextOffset`, sin volver a pedir el principio.
El JSON completo respeta 4000 caracteres para descubrimiento y 6000 para lectura
por defecto; la búsqueda no llama a otro modelo, no usa embeddings ni red.

`techniqueRole`: `signature` para un recurso protagonista, `workhorse` para una
solución estructural reutilizable o `accent` para un detalle. `techniqueFormat`:
`launch`, `feature`, `sting`, `loop`, `vertical`, `walkthrough`. `energy`: `calm`,
`medium`, `high`. Los comodines upstream se conservan. `seed` sólo desempata
resultados con igual relevancia: nunca sacrifica pertinencia para variar por variar.
Las técnicas elegidas recientemente quedan detrás de alternativas pertinentes
nuevas; `excludeIds` las excluye explícitamente. Un ID exacto sigue disponible
para retomar una elección aprobada. Si sólo hay repetidas, el resultado lo marca
`recentlyChosen`; no se inventa un catálogo infinito.

Registrá la elegida con `syka_creative_selection action:choose`, `role:motion`
y una razón concreta, después de leerla. Los recibos guardan ID/hash y el historial
local del proyecto afecta búsquedas siguientes. Esto no reemplaza la variación
musical ni el historial independiente de música/SFX.

## Traducir, sin copiar a ciegas

El texto original contiene recetas de Remotion/CSS/GSAP. Son datos de referencia:
`AbsoluteFill`, `Loop`, springs o helpers upstream no existen automáticamente en
Syka. Traducí el mecanismo a nodos/keyframes nativos o un componente local con
`useTicker`, gobernado por tiempo absoluto de la escena. Una regla genérica de
«mové algo cada segundo», color oscuro o pocos clicks no prevalece sobre el brief,
las doce reglas de lanzamiento adaptadas ni el diseño/audio aprobado del usuario.

Guardá en `frame.md` el ID, qué se toma, qué se evita, equivalencia en Syka,
inicio/fin/hold y cue de sonido. No impongas el guion, fuentes ni datos del ejemplo.
Para 3D real pedí `capability:surface3d` y verificá la capacidad disponible; no
prometas objetos 3D por haber encontrado una ficha. El contador de evidencia
upstream no acredita que Syka haya visto el video.

Verificá una entrada, el hold de lectura y la costura con la siguiente escena,
seek fuera de orden, inicio/final y sonido en contexto. La integración entrega
referencias recuperables y un contrato de uso; no 273 componentes ya renderizados.
