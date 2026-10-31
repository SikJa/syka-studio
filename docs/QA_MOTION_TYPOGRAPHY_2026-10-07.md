# Tipografía, tarjetas y movimiento — 7 de octubre de 2026

Pedido: mejorar instrucciones reutilizables y herramienta manteniendo Diffusion y lo instalado. Las cartas anteriores eran solo QA; se preservan. Prueba nueva de 10 segundos, horizontal 1080p/60fps, silenciosa. GPT-6.1 Sol Medio, conservando la última configuración explícita.

## Diagnóstico y alcance

El motor existente desplaza 100px en slideUp y usa la misma curva para ambos sentidos; el acceso rápido Suave añadía solo fade. Las skills ya trataban ritmo y referencias, pero no reunían decisiones concretas de tipografía y tarjetas en un soporte dedicado.

Se añade softRise al final del enum para preservar IDs persistidos. Entrada de 32px con desaceleración cuártica, salida de 16px hacia arriba con aceleración cúbica. Conserva opacity y offsetY authored; no escala glifos, añade blur ni muta texto. El preset queda en JSX, reconciler, runtime, selector y Biblioteca/Animaciones; Suave lo aplica. Se conservan todos los presets anteriores. Es una capacidad acotada, no una solución automática a toda la dirección de arte.

Instrucciones nuevas: jerarquía con copy real, fuentes/pesos comprobados, ancho de línea y cortes semánticos, alineación, padding, radio coherente, pausa de lectura, entradas por jerarquía y comparación por variable. No fija una marca ni obliga a usar Inter.

## Recursos revisados

Selección mínima: mantener syka-motion-references y las instrucciones nativas de Diffusion; adaptar principios de las skills ya instaladas transitions-dev y syka-visual-direction. Implementación original, sin código upstream nuevo ni dependencias nuevas.

| Recurso | Decisión y motivo | Licencia / mantenimiento consultados | Compatibilidad y riesgo |
| --- | --- | --- | --- |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Referencia de proceso; no instalar ni migrar | API reporta Apache-2.0, actividad 2026-10-07 | HTML/GSAP/Studio no son APIs Diffusion. No probar login ni nuevas cuentas. |
| [Remotion skills](https://www.remotion.dev/docs/ai/skills) | Usar ideas de composición reproducible y revisión; sin instalar Remotion | Doc oficial revisada; API del repo no clasifica licencia | Sus APIs requieren su renderer; no copiar ni ejecutar código en este cambio. |
| [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | Descartado para este alcance | MIT; actividad 2026-09-24 | p5.js/p5.brush y personajes dibujados; no cubre mejor tipografía nativa. Dependencias/render propios. |
| [claude-animation-skill](https://github.com/buildwithhanif/claude-animation-skill) | Descartado para este alcance | MIT; actividad 2026-09-23 | Node canvas, rig y estética dibujada; instalarlo expandiría el stack sin resolver el defecto elegido. |
| [PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) | No incorporar código/medios | API sin licencia clasificada; actividad 2026-09-25 | Pipeline p5 y canción externa; derechos de assets no derivados del acceso público. |
| [Battle of Austerlitz Film](https://github.com/WinterArc21/Battle-of-Austerlitz-Film) | No incorporar | API sin licencia clasificada; actividad 2026-09-24 | Película y composición distinta; no se auditaron scripts/assets para reutilización. |
| [Awesome AI motion](https://github.com/guanmo-ai/awesome-ai-motion) | Reserva de enlaces, no ampliar catálogo ahora | API NOASSERTION; actividad 2026-10-06 | Licencias de referencias separadas, catálogo ya existente cubre el caso. |
| [Awesome Opus videos](https://github.com/athemeroy/awesome-opus-5-5-videos) | No importar segundo catálogo | Redirige a awesome-claude-5-5-videos, API CC-BY-4.0, actividad 2026-10-03 | Afirmaciones de autores/modelos no prueban calidad ni capacidad local. |

Licencias anteriores son clasificación de GitHub, no una auditoría legal de cada asset. Se revisaron páginas/metadata; no se ejecutó ninguno de estos repositorios. No se descarga la skill externa citada por las referencias anteriores.

Los tres enlaces de X del encargo devolvieron 403 en la reconsulta; sus ideas se usan como síntesis recibida del chat remitente, sin afirmar una inspección nueva de sus videos. La guía de Studio no fue accesible con el lector. No se presupone disponibilidad de HyperFrames Desktop en Windows ni se promete una función sin prueba local.

## Archivos de esta entrega

- packages/runtime/src/constants.ts
- packages/runtime/src/systems/motion.ts
- packages/runtime/src/systems/soft-rise.test.ts (nuevo)
- packages/jsx/src/types.ts
- packages/reconciler/src/document.ts
- apps/web/src/components/sidebar-right/inspector/animation-types.ts
- apps/web/src/components/sidebar-right/inspector/animations.tsx
- apps/web/src/components/sidebar-right/inspector/soft-rise.test.ts (nuevo)
- docs/reference/jsx/animations.md
- docs/skills/syka-motion-transitions/SKILL.md
- docs/skills/syka-visual-direction/SKILL.md
- docs/skills/syka-visual-direction/references/typography-and-cards.md (nuevo)
- docs/references/prompt-motion/scripts/qa-typography.mjs (nuevo, arnés aislado)
- Este informe; evidencia typography-integration.json y revisión final.

Copia previa de los archivos existentes en C:/Users/Sikora/AppData/Local/Temp/syka-motion-quality-20261007-002607. No git reset/stash/checkout, commit, push ni despliegue. El árbol tiene muchos cambios anteriores; no se restauran archivos completos a ciegas si luego cambian en otro chat. Para revertir: retirar solo softRise y su entrada de selector/mapeo, volver Suave a fade y retirar el soporte de instrucciones añadido, comparando la copia previa con el estado actual. Los nuevos proyectos/renders conservan su carpeta versionada.

## Ejecución reproducible

Desde diffusion-studio:

```powershell
node node_modules/vitest/vitest.mjs run packages/runtime/src/systems/soft-rise.test.ts apps/web/src/components/sidebar-right/inspector/soft-rise.test.ts docs/references/prompt-motion/tests/host-integration.test.ts --config apps/desktop/vitest.config.ts
npm.cmd run check --workspace=@diffusionstudio/runtime
npm.cmd run check --workspace=@diffusionstudio/jsx
npm.cmd run check --workspace=@diffusionstudio/reconciler
npm.cmd run check --workspace=@diffusionstudio/web
```

El runner qa-typography.mjs deja registro del brief, modelo real, herramientas, check/capture/export y usa perfiles/bundles/puertos aislados 5317/3317/9417. Ejecutarlo otra vez genera un turno nuevo: no es necesario para reproducir el render de las fuentes guardadas. Para rerender sin generación, abrir el proyecto desde Syka y exportar el scene ID deseado, o con el CLI local `syka open "<proyecto>"` y `syka export --help` para los argumentos de esa versión.

Comparación: qa_type_before (base razonable slideUp), qa_type_motion (misma composición, solo softRise), qa_type_after (misma temporización y softRise, nueva jerarquía/composición). Mismos textos, assets originales, dimensiones, fps y duración. Antes vs motion evalúa movimiento; motion vs after evalúa diseño. Aprobación estética pendiente de Sikora.

## Validación

7 tests pasaron: runtime real, selector/mapeo real y descubrimiento de la skill por el host. TypeScript de runtime, JSX, reconciler y web pasó. Las tres escenas pasan check sin issues; 9 nodos por escena, 6 textos editables y 2 formas. Se confirmaron textos/estados durante holds y transiciones, tildes y cortes semánticos; el baseline y el control conservan mismos píxeles en el hold.

Tres exports nativos: 10s,1920x1080,60/1fps,600 frames,sin audio. Decodificación completa sin errores y timestamps uniformes. Evidencia detallada y hashes: carpeta del proyecto qa-evidence/verification.json; exports independientes posteriores: typography-integration.json. Seek real de teclado en Electron 3.6→1.2→5.6666667→2.5666667→3.6, captura repetida con píxeles idénticos. Proyecto reabierto con check sin issues. Preview nativa recorrida a 1x hasta10s, con capturas de muestreo cada segundo; no se afirma una inspección manual de cada frame del MP4. La salida final deja el fondo deliberadamente limpio, no es un render perdido. Sin audio pedido, no hay revisión sonora que simular.

Preset Subida suave comprobado visible en Biblioteca→Animación del editor aislado; captura qa-evidence/live-playback/native-preset-library.png. Variantes comparadas a mismos tiempos en qa-evidence/independent/comparison.png. Aprobación estética aún del usuario. No se reinició ni cambió el proyecto abierto en la instancia principal; verificación de ejecución realizada en instancia aislada de los mismos fuentes actuales.

Proyecto: F:/Coding Proyects/Syka Clips/Pruebas Syka/QA-tipografia-tarjetas-2026-10-07. Final: 02 Finales/qa_type_after.mp4. Base: 02 Finales/qa_type_before.mp4. Control solo-motion: 02 Finales/qa_type_motion.mp4. Los tres siguen editables en index.tsx.

Re-render sin agente ni cambios de fuente, desde diffusion-studio, en dos terminales:

```powershell
# Terminal 1: abre solo el perfil/proyecto QA existente, usando los bundles privados ya construidos.
node docs/references/prompt-motion/scripts/qa-typography-open.mjs
# Terminal 2: exporta a subcarpeta con timestamp; conserva todas las versiones anteriores.
node docs/references/prompt-motion/scripts/qa-typography-render.mjs
# Al terminar: cierra solo la instancia QA.
Set-Content docs/references/prompt-motion/evidence/qa-runtime/typography-2026-10-07/live-finish.txt 'DONE'
```

Para recompilar el arnés privado con fuentes futuras, qa-typography.mjs incluye build aislado; además inicia un turno nuevo, por lo que no debe usarse solo para re-render. Ningún recurso candidato fue instalado. Helpers adicionales: qa-typography-review.mjs, qa-typography-ui.mjs, qa-typography-open.mjs y qa-typography-render.mjs.
