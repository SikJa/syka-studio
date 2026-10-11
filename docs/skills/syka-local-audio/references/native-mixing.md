# Mezclar sin pelearse con la voz

## Orden práctico

1. Conservar el original. Resolver audio duplicado antes de sumar música; si separaste una pista de voz de un video, muteá el audio original que reemplaza.
2. Escuchar/medir voz, base y efectos por separado. Elegir una sección con densidad apropiada. Un pad grave y una melodía liviana suelen competir menos con una explicación que acordes agresivos y caja constante.
3. Ajustar la relación inicial y después automatizar. Los ejemplos arrancan en música a −16 dB y bajan a −27 dB durante voz, con ataque 150 ms, hold 80 ms y recuperación 350 ms. Son ganancias relativas de pista, no targets de loudness universales: el nivel original cambia la relación final.
4. Alinear acentos al evento visual/sonoro, reducirlos en diálogo importante y dejar sus colas. Revisar el cierre musical además del fade técnico.
5. Exportar y comprobar la mezcla real; la perilla de escucha del editor no cambia la exportación.

Biblioteca inserta efectos a −12 dB y bases/capas a −16 dB como punto de partida editable. Los originales Kenney se conservan sin normalizarlos; algunos OGG tienen overshoot al decodificar. Ajustá según la voz y el evento, no uses este margen como garantía de una mezcla completa sin clipping.

## Ducking editable

Copiá `examples/audio-envelope.ts` y `examples/NativeMusicBed.tsx` dentro del proyecto antes de importarlos. Los spans de voz deben estar en tiempo de la timeline editada. Un transcript crudo anterior a cortes no sirve para esta curva hasta remapearlo. Si necesitás mantener cierta frase encima de la música, usá un span explícito.

```tsx
<NativeMusicBed id="music-main" src="Audio/base.wav" start={0} duration={15}
  speech={[{start:0.4,end:4.2},{start:5.0,end:10.6}]}
  baselineDb={-16} duckDb={-27} fadeIn={0.2} fadeOut={0.7}/>
```

La curva agrupa gaps cortos para evitar subir y bajar la base entre palabras. No separa stem ni detecta energía automáticamente: usa spans dados. Los puntos de fade y duck se combinan en una sola pista de volumen; no se espera que dos animaciones de `volume` se sumen.

`sourceTime = sourceIn + (timelineTime - start) × playbackRate`. Ejemplo: música con inicio 10, trim 2 y velocidad 2; un cue a 12 cae en sourceTime 6. Dentro de una escena/grupo, spans e inicio deben compartir el mismo reloj del padre. No sumar offsets dos veces. Si usás otra velocidad, comprobá duración y tono.

Diffusion recibe dB y tiempos fuente; [Remotion](https://www.remotion.dev/docs/audio/volume) permite amplitud lineal y callbacks relativos al medio, mientras [HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes-audio/references/presets.md) ofrece otras cadenas de efectos. Adaptá la relación y el reloj; pegar sus props no crea compresión/EQ/sidechain nativos en Syka.

## Si bajar volumen no alcanza

Primero quitá capas y elegí otra sección/timbre. Si el usuario necesita procesar un archivo, FFmpeg puede producir un **derivado** con EQ suave para despejar el rango que compite con la voz o un crossfade. Guardá origen, filtros y output; no sobrescribas el original ni confundas ese WAV procesado con un efecto editable en vivo. Evitá combinar denoise/compresor/limiter sólo por tenerlos disponibles.

La reducción espectral automática de HyperFrames no está implementada por esta adaptación. La escucha semántica cloud tampoco se activa. Waveform, RMS y transcript no demuestran inteligibilidad por sí solos.

## Qué validar

- Entrada, final, música durante voz, pausa y acento principal. Comparación A/B si procesaste voz o música.
- Seek y export coincidentes; clips con trims/rates y curvas en el reloj correcto.
- Ninguna pista duplicada; stems sumados una sola vez; voz conservada y completos los spans/cues.
- Pico de la mezcla sin clipping. Dejar margen de pico real según la entrega; medir LUFS/true peak cuando hace falta y evitar normalizar a una cifra ciega.
- Costura de loop/crossfade y cierre: no basta con que el WAV tenga el largo pedido.

FFmpeg `ebur128=peak=true` permite medir el render final con un binario que incluya el filtro. El generador sólo mide sample peak y RMS. Si no pudiste oír el resultado, informá el alcance de la validación y ofrecé la preview; no presentes métricas como una escucha humana.
