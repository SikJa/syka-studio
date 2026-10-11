---
name: syka-motion-transitions
description: Adaptar la fluidez de transitions-dev a títulos, paneles y escenas de video de Syka mediante keyframes nativos o timelines pausados; mantener scrubbing, export y movimiento entre escenas coherentes.
---

# Transiciones fluidas en el reloj de Syka

Usá la intención de `transitions-dev` (jerarquía temporal, curva de llegada, entradas y salidas independientes) dentro de la composición. **No pegues CSS con clases y timers en el video**: se ve en vivo pero puede discrepar al capturar, retroceder o exportar. Esta adaptación está autocontenida; no requiere tener la skill global instalada.

## Elegir y adaptar

- Título + apoyo: entrada corta con desplazamiento moderado y stagger por jerarquía; salida conjunta si ambas líneas terminan la misma idea. El blur es opcional y no debe quitar lectura.
- Panel/UI: revelá desde el elemento o borde que explica su origen; sostén el tiempo necesario para entenderlo; cerrá con ritmo propio, no invirtiendo mecánicamente la entrada.
- Cambios entre escenas: compartí un objeto, alineación, dirección o encuadre. Diseñá el estado final de A junto al inicial de B. Si llevan movimiento continuo, no hagas que cada lado frene a cero en la costura.
- No impongas estos patrones a toda la pieza. Fade, corte, movimiento lineal, rebote y pausa son válidos cuando cumplen una función. Adaptá amplitud a tamaño de cuadro, tipografía y peso del objeto; no copies distancias de una web a 1080p sin mirar.

Leé [references/native-motion.md](references/native-motion.md) para tokens orientativos, traducción exacta y límites del renderer. El ejemplo [examples/NativeReveal.tsx](examples/NativeReveal.tsx) prueba reveal + panel con nodos editables; **es una muestra técnica de cuatro segundos, no la dirección artística de un lanzamiento**.

## Contrato del motor

Leé `reference/jsx/keyframes.md`, `animations.md`, `timing.md` y `styles.md` mediante `syka_read_reference`. Las rutas de soporte de esta skill se leen con `syka_skills read`, usando el `path` que devuelve `list` y `file`, por ejemplo `file: "examples/NativeReveal.tsx"`.

1. Preferí `<keyframeTrack>` en texto, geometría, logos y grupos. `easing` pertenece a la clave que inicia el segmento; el easing de la última clave no hace nada.
2. Las claves usan **tiempo de fuente**, no segundos globales. En media: `sourceTime = sourceIn + (sceneTime - clipStart) * playbackRate`. Considerá también el reloj padre si hay grupos. En un nodo sourceless sin trim, las claves parten de cero aunque su `start` sea 5.
3. Blur nativo: `<effect type="blur" value={0}>` con un track `property="value"`; no inventes una prop `blur` sobre `<text>`. Para desplazamientos sutiles usá `offsetX/offsetY` cuando convenga: preservan subpíxel sin cambiar el layout.
4. No superpongas un preset y un track sobre la misma propiedad esperando sumarlos: el track gana. `opacity` y movimiento pueden tener tracks separados; blur se anima en su efecto.
5. En `<html>`: construí anime.js en `onMount`, `autoplay:false`, y hacé `seek` desde `useTicker().time()`. Leé `reference/jsx/html.md` y `lifecycle.md`: el ticker es de escena; convertí a tiempo local al desplazar el componente. No uses timers, `Date.now()` ni acumulación por delta para determinar el estado exportado.
6. Declarar `end` en nodos sourceless evita el corte implícito a 16 s. Para clips cortos reducí entrada/salida para que no eliminen todo el tiempo de lectura.

## Subida suave nativa

El motor ofrece `softRise`, tambien en Biblioteca/Animaciones como **Subida suave** y en el acceso rapido **Suave**. Entrada: 32px desde abajo, desaceleracion cuartica y opacidad. Salida: 16px hacia arriba con aceleracion cubica; no reproduce la entrada al reves. Conserva opacidad y offsetY authored. No mueve glifos ni cambia su escala; sirve para texto y paneles, no para todos los tipos de relato.

```tsx
<text fontFamily="Inter" fontSize={96} start={0} end={3}>
  Una idea clara.
  <animation type="softRise" duration={0.55} />
  <animation type="softRise" phase="out" duration={0.3} />
</text>
```

Inspecciona duracion y hold: los defaults del motor no protegen el tiempo de lectura de clips muy cortos. No superpongas in/out ni keyframes sobre opacity/offsetY salvo una decision explicita. Para movimiento reducido usa fade sin desplazamiento como variante elegida, no una preferencia ambiental que cambie silenciosamente el render.

## Verificar

Para una pieza completa, complementá las capturas del renderer con `syka_motion_review` sobre el export nativo: un burst de cuadros codificados consecutivos alrededor de la costura elegida y holds a 360 px. Leé `syka-edit-review/references/motion-evidence.md`; el muestreo del export no certifica por sí solo seek del player, audio o calidad estética. Las reglas por tipo de objeto están en `syka-visual-direction/references/motion-production.md`.

Capturá comienzo, mitad del reveal, máxima superposición, hold y salida. Buscá halos, recorte, texto que aparece a saltos, imagen vacía y costuras. Saltá hacia atrás y volvé al mismo tiempo: debe devolver el mismo estado. Compará una muestra del export con la captura del mismo revision/tiempo. Preservá los controles editables.

Para una variante accesible elegida por el usuario, exponé `reducedMotion` y reducí desplazamiento/blur manteniendo contenido y duración. No hagas que el export cambie silenciosamente por la preferencia del sistema. Si editás UI web real, sí conservá `prefers-reduced-motion` del patrón original.

## Procedencia

Adaptación original para Diffusion de [transitions.dev](https://transitions.dev): patrones locales `18-texts-reveal.md`, `07-panel-reveal.md` y tokens de `_root.css`. Conserva sus principios, sin copiar el sistema CSS ni su orquestación de DOM. No transforma CSS automáticamente ni incorpora otro motor de video.
