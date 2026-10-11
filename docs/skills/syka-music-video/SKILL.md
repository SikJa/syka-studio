---
name: syka-music-video
description: Crear en Syka un montaje, lyric video o motion guiado por una canción o música existente, con beats verificables y recursos editables. Usar cuando la música determina el ritmo.
---

# Música como estructura

Leé la receta, `syka-media-use` y `syka-local-audio`. Reutilizá el archivo indicado o buscá música en `syka_resources kind:sounds`, con procedencia y permiso de uso reales. No cambies a una API paga porque una skill upstream la menciona. Importá con `copy:true` y preservá el original.

Usá `syka_audio_analyze` sobre la música importada: devuelve ataques y cambios de energía, candidatos de tempo con score/error y una grilla candidata si el ajuste alcanza. Leé `syka-local-audio/references/measured-sync.md` para conservar el reloj fuente al recortar. Registrá BPM, primer beat, compás y cambios de sección cuando estén comprobados por escucha. `primerBeat + n * 60 / BPM` sirve para tempo constante; no supone que el archivo arranque en un beat ni sirve para tempo variable. La energía es una candidata, no una detección semántica. Guardá propuestas y comprobá varios momentos representativos antes de extenderlas; si no hay grilla confiable, usá cues escuchados y no fuerces el ritmo.

Diseñá por frases musicales: preparación, énfasis, descanso y cambio de sección. No pongas un corte ni whoosh en cada golpe. Leé `syka-visual-direction` para resolver escenas y `syka-motion-transitions` para coreografía nativa. Las letras requieren texto/timing reales; si sólo hay el archivo musical, no inventes una transcripción.

Colocá música y capas con audio nativo. Una secuencia mantiene time de salida coherente con cortes y velocidad; animaciones HTML siguen el ticker del motor. Conservá las capas y keys para retocar. Si hay voz, preservá su inteligibilidad y elegí una mezcla en contexto; no dupliques mix completo y stems. Para elegir SFX por material/ataque/brillo y balancearlos contra una base real, leé `syka-local-audio/references/sound-layer.md`. Revisá ataques, límites, pico y final; `syka_audio_review` trabaja sobre un export autorizado ya disponible, no obliga a generar uno.

Adaptación original de `music-to-video` de HyperFrames al motor Diffusion. El analizador local propone ataques y grillas; la selección musical y el juicio del mix requieren escucha. No incluye generación musical cloud ni escucha semántica automática.
