---
name: syka-camera-3d-captions
description: Adaptar Camera 3D Captions a Diffusion con texto nativo editable, proyección de profundidad y cámara determinista, sin instalar otro motor.
---

# Captions con profundidad

Método adaptado de [Camera 3D Captions](https://github.com/heygen-com/hyperframes-community-skills/tree/master/skills/camera-3d-captions).
La implementación es original de Syka, usa Diffusion y no requiere HyperFrames,
Remotion ni WebGL. Los presets/recursos/dependencias upstream no son requisitos.

Entrá por `syka-motion-brief`: copy/idioma, foco/destino, cámara y voz/música/SFX/
silencio. Recuperá `camera-3d-captions` y `typography` como referencias.

`examples/projection.ts` proyecta posiciones 3D con focal, near/far, yaw/pitch/roll.
`examples/DepthCaption.tsx` lo convierte en `<text>` editable con entrada, hold y
salida por tiempo absoluto. Copiá ambos y adaptá props al proyecto.

Es profundidad proyectada en 2D: no un renderer de superficies 3D. No promete
oclusiones automáticas, anillos de glifos ni matte de sujeto. Ordená capas de fondo
a frente para palabras en planos distintos. Ocluir con footage requiere máscara
real; letras en un anillo requieren otro layout por glifo.

- Mové cámara para conducir el foco; conservá área segura y escala legible en hold.
- Perspectiva no reemplaza contraste, jerarquía ni composición.
- `cameraAt(t)` evalúa desde reloj absoluto: seek directo/atrás/repetido debe coincidir.
  `reducedMotion` congela cámara y conserva entrada/salida por opacidad.
- Nombrá textos; copy/fuente/color/timing son props. Compartí IDs de eventos con
  audio/revisión y alineá ataques desde recursos reales.
- Revisá extremos, plano cercano, escala mínima, clipping y lectura en móvil.

Validar math/compilación demuestra capacidad técnica del ejemplo; la composición
final necesita styleframes, playback y revisión propios.
