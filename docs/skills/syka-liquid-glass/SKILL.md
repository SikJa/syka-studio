---
name: syka-liquid-glass
description: Editar un video de una persona hablando a cámara con tarjetas de vidrio estilo Liquid Glass (refracción, desenfoque, borde especular) para titulares, cifras con fuente, frases, pasos y placa de nombre, nativas y editables en Syka. Usar cuando pidan liquid glass, estilo Apple o vidrio, o tarjetas con datos sobre un talking-head 16:9.
---

# Liquid Glass sobre una persona a cámara

## Contract

Syka entrega una composición nativa editable dentro del proyecto. Conservá la toma, la voz y el estilo aprobado. Exportá sólo ante pedido explícito.

- **La cara siempre libre.** Ningún vidrio pisa la caja de la cara. Las tarjetas van al costado o arriba; nada de pantallas completas encima de la persona.
- **No inventes cifras.** Cada número sale de lo que la persona dice en cámara (con su minuto) o de su estilo guardado. Sin fuente no hay tarjeta de cifra.
- **Los textos salen del transcript.** Titular hasta 3 palabras, pastilla hasta 4, frase hasta 8 e ítems de pasos hasta 4.
- **Bordes limpios.** Nada entra antes de 0,35 s ni termina de salir después de la duración menos 0,35 s.
- `validar()` de `examples/liquid.tsx` hace cumplir estas reglas: si falla, el proyecto no se arma y el error dice qué pieza corregir. Se corrige el plan de piezas, nunca se desactiva la validación.
- Esta skill es para 16:9 con una persona a cámara. Para vertical o sin persona, usá la receta que corresponda.

Leé sólo la fase necesaria. Las dependencias del índice son condicionales, nunca lecturas recursivas. Una corrección puntual reutiliza decisiones vigentes y su source; no repite brief, investigación ni consulta de producción nueva.

## Brief

Antes de construir, resolvé con `syka_ask_user`, en bloque y con opciones, lo que falte. No preguntes de a una.

1. **La toma**: video a cámara, grabación de pantalla si hay y duración.
2. **Objetivo**: de qué trata, en una línea, y qué tiene que hacer quien lo mira al terminar.
3. **Intro**: qué mostrar en los primeros 30–60 s (titular, cifras, logos, placa).
4. **Cuerpo**: ideas para reforzar, con su minuto aproximado.
5. **Estilo de la persona**: nombre en pantalla, colores (acento, tinta, etiquetas), tipografía, vidrio claro u oscuro, palabras que usa y que no, y datos que nunca se muestran. Si ya está guardado en la memoria o en la receta, reutilizalo.
6. **Música**: tenue y por debajo de la voz, o sin música.

`references/plantilla-pedido.md` tiene la plantilla del pedido y un ejemplo lleno.

## Build

1. **Material**: copiá la toma a `01 Crudos/` y transcribila con tiempos por palabra (transcripción en `03 Assets reutilizables/Transcripciones`). Si la toma no es 1920×1080, pasala a ese tamaño: el vidrio mide en píxeles del cuadro.
2. **Encuadre**: mirá 3 o 4 frames de la toma. Medí la caja de la cara `[x, y, ancho, alto]` con margen y elegí el vidrio: claro sobre fondos luminosos, oscuro sobre fondos oscuros. Si el fondo detrás de una tarjeta tiene rayas, hojas o mucho detalle, movela a una zona lisa.
3. **Piezas**: copiá `examples/liquid.tsx` a `liquid/liquid.tsx` del proyecto y armá `index.tsx` como `examples/ejemplo-index.tsx`:
   - `titular`: titular blanco centrado arriba con una pastilla de vidrio oscuro.
   - `stat`: etiqueta, punto de acento, cifra grande, unidad y sublínea. Exige `fuente`.
   - `frase`: una idea de hasta 2 líneas.
   - `pasos`: lista numerada; cada ítem aparece (`reveal`) cuando la persona lo dice.
   - `placa`: nombre y rol abajo a la izquierda.
   - `VideoLiquid`: la toma con el vidrio dibujado por un shader. Recibe todos los vidrios (`piezas.flatMap(p => p.vidrios)`). Hasta 4 visibles a la vez.
4. **Ritmo**: intro densa, con un recurso cada 3–6 s durante los primeros 30–60 s. Cuerpo que respira: una intervención cada 30–60 s, de 6–8 s. Una tarjeta no espera vacía: hacela entrar cuando se dice lo primero que muestra.
5. **Zoom de cámara** (`zoom` de `VideoLiquid`): sólo en tramos sin vidrios, porque el zoom agranda también el vidrio y lo despega de sus textos. Empuje suave (1 → 1,12–1,15), nunca durante un titular.
6. **Música**: por debajo de la voz (unos −26 dB) y un poco más alta en pausas largas (unos −20 dB), con entrada y salida suaves. Sólo pistas con permiso de uso; ver `syka-local-audio`.
7. **Muestra primero**: en videos largos, mostrá la intro y pedí el visto bueno antes de hacer el cuerpo.

`liquid.tsx` es código propio de Syka inspirado en la skill edicion-liquid de Claudio Conde (capas lente → tinte → borde → reflejo, tamaños de tarjeta y reglas). El shader necesita WebGPU; donde no hay, la toma se ve sin vidrio.

## Review

- `check` sin problemas y `capture` en la entrada, la lectura y la salida de cada pieza. Mirá cada captura: vidrio translúcido con el fondo visible, texto legible, cara libre y nada cortado.
- Cada cifra tiene su minuto y cada texto coincide con lo que se dice.
- La música no tapa la voz.
- Las correcciones que la persona aprueba se guardan como mejora de la receta (`syka_plan nota`), con el valor final. Por ejemplo: «música −26 dB bajo la voz; la primera mezcla quedó alta».
