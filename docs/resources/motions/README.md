# Motions nativos de Syka

Las muestras MP4 sirven para elegir una dirección. Para integrarla, copiá el `.tsx`
correspondiente y `motion-time.ts` a `components/` del proyecto; importá el default.
Cada instancia usa `id`, `start`, `end`, `width`, `height` y posición opcional `x`,`y`.
Los segundos son del reloj absoluto de la escena. Evitá montarlos en un grupo con
desplazamiento temporal sin ajustar ese contrato. El componente tiene una sola
capa HTML seleccionable; textos internos se editan mediante props/fuente, no
mediante controles separados de tipografía del inspector.

- `OrbitFeature`: `title` corto (hasta ~28 caracteres), `detail` (hasta ~90),
  `label`, `accent`, `reducedMotion`. Duración sugerida 6–10 s. Esfera analítica
  y tarjeta con perspectiva 2.5D; **no es el rig Blender original de Orbit Card**.
- `CircleGallery`: `images` (3–12 rutas locales de assets), `title`, `subtitle`,
  `secondsPerCard` (2.2 por defecto), `fit` (`cover` o `contain`), `accent`.
  Reemplazá siempre las imágenes de demostración por recursos pertinentes.
  `contain` conserva una captura completa; `cover` llena la tarjeta recortando.

Comprobá un hold, un barrido y salida; seek repetido, captura y export.
La misma imagen al mismo tiempo debe coincidir aunque se llegue desde atrás.
La estética de muestra no es un estilo obligatorio para todos los proyectos.

Referencias públicas consultadas el 2026-10-06:
https://hyperframes.heygen.com/catalog/blocks/orbit-card
https://hyperframes.heygen.com/catalog/blocks/carousel-circle-3
Código upstream Apache-2.0, commit d94708e5312df021e1fdcac421f00ed3015f11bd.
Estos componentes son implementaciones originales para Diffusion; no incluyen
el runtime, las curvas de Blender, bibliotecas, fuentes ni fotografías upstream.
