# Handoff: recetas y planes (2026-11-02)

Estado del trabajo sobre recetas y planes en Syka Studio. Todo está en la rama
local `syka/release-0.210.0`, **sin commitear**, encima de la 0.210.0 publicada.
El diseño original está en `PROPUESTA-RECETAS-Y-PLANES.md`.

## La idea

- **Receta**: cómo hace alguien un tipo de video. Es reutilizable, mejora con
  cada video y se arrastra al chat como una skill.
- **Plan**: el de cada video (`00 Plan/plan.json`). Sale de una receta más el
  material nuevo, y es lo que el agente sigue y el gate revisa.
- **Motor**: el mismo para todo contenido. Las fases van brief → material (si la
  receta parte de una grabación) → historias (si la receta las pide) → escenas →
  storyboard (opcional) → construir → gate → entrega.

## Qué está hecho

### Herramientas del agente (`packages/agent-chat/src/host/plan/`)

| Archivo | Qué hace |
|---|---|
| `receta.ts` | Formato y validación de `receta.json`. Las de fábrica viven en `docs/recetas/` y las personales en la carpeta de skills personales (cada una es una skill con `receta.json` + `SKILL.md` generado). `guardar` sube la revisión, guarda la anterior en `historial/` y anota en `historial.md`. Las de fábrica no se pisan. |
| `plan.ts` | Formato del plan, fases y validación de escenas. Devuelve todos los errores juntos: frases de más de 6 palabras o con punto final, huecos de tiempo, duración distinta, movimientos sin destino, marca inexistente, sonido inválido, y los **controles** de la receta. |
| `tools.ts` | `syka_receta` (listar, leer, usar, guardar) y `syka_plan` (estado, brief, material, historias, elegir, escenas, aprobar, nota). Cada respuesta dice la fase y el siguiente paso. `entregaBloqueada` traba la entrega. |
| `gate-receipt.ts` | El comprobante del gate (`00 Plan/gate.json`) con la huella del código revisado, y lo que el plan le pasa al gate: frases, zona segura y límite de imagen quieta. |

Controles de receta que se comprueban solos: `ui-legible`, `logo-al-final`,
`cortes-en-movimiento` (máximo un tercio de cortes secos) y `gancho-inmediato`.

### Entrega trabada

`syka_delivery` con `status: ready` sobre `index.tsx` se rechaza si no hay plan,
si el plan no está en fase construir, si el último gate falló o si el código
cambió después del gate. Una corrección chica entrega con `correccion: true`:
se salta el plan, pero nunca el gate.

### Gate que lee el plan

- El servidor del editor (`apps/desktop/src/dapi/server.ts`) le pasa al gate las
  frases del plan, la zona segura y el límite de imagen quieta de la receta, y
  después del gate escribe el comprobante.
- `line-missing` / `line-unsafe`: cada frase tiene que verse entera dentro del
  margen (5 %, o la zona segura de la receta), aunque esté repartida en varias
  capas. Si no aparece y el plan no nombra capa, es solo aviso (puede estar
  dentro de un html).
- `small-subject`: aviso cuando la captura queda chica en un cuadro vacío.
- `stillMax`: cuánto puede quedar quieto el cuadro (1,6 s por defecto, 8 s en YouTube).

### Recetas de fábrica (`docs/recetas/`)

| Receta | Formato | Particularidades |
|---|---|---|
| `lanzamiento` | 16:9, 15–40 s | Tres historias para elegir; reglas de cámara y encuadre; Mixkit comparando tres temas; logo al final; máximo un tercio de cortes secos. |
| `youtube` | 16:9, 2–30 min | Fase de material (video + transcripción real); gancho, intro, bloques con capítulos, cierre; cortes secos permitidos; música 18–24 dB bajo la voz; quieto máximo 8 s. |
| `vertical` | 9:16, 15–90 s | Zona segura de redes (8 % arriba, 20 % abajo, 6 % izquierda, 15 % derecha); gancho de hasta 3 s con frase. |

### Arreglos que salieron de las pruebas reales

- **Steer con Claude**: Claude Code arranca con entrada `stream-json` abierta, así
  un mensaje insertado durante el turno entra en el mismo turno. Probado en Syka
  ("LISTO BANANA").
- **Preguntas que se cortaban**: Claude Code cortaba `syka_ask_user` al minuto
  (`MCP_TOOL_TIMEOUT`) y a los 300 s sin progreso (falta de `timeout` por
  servidor). Ahora una hora para el servidor de Syka y 15 minutos para el del
  editor. Si Claude abandona la pregunta, la tarjeta se cierra en el chat.
  Probablemente era la causa de que el agente "no preguntara".
- **Herramientas siempre cargadas en Claude**: `syka_ask_user`, `syka_receta`,
  `syka_plan`, `syka_delivery`, `syka_skills`, `context`, `check`, `capture` y
  `gate` llevan `anthropic/alwaysLoad`.
- **Un archivo no delega**: solo lo que la persona escribe en el chat autoriza
  saltear preguntas o elegir la historia.
- **Transcripción de Groq**: tolera las desviaciones chicas de Whisper en tomas
  largas (palabras vacías, solapamientos y finales pasados del audio) sin inventar tiempos.

## Pruebas reales hechas

| Prueba | Resultado |
|---|---|
| Lanzamiento (Sonnet 5.5 bajo) | Siguió la receta sola, el plan se rechazó dos veces y pasó, el gate frenó errores reales, entregó en revisión. |
| Steer con Claude | El mensaje insertado entró en el mismo turno. |
| YouTube con una grabación de 6:39 | Preguntó el brief (contestado por la persona), transcribió, recortó a 5:25, 8 capítulos, subtítulos reales, Mixkit, acercamientos, gate aprobado, entrega en revisión. |

### Tarjeta proactiva (2026-11-02)

Cuando un turno entrega `index.tsx` (lista o en revisión) en un proyecto con plan
en fase construir, el host agrega al chat un elemento `kind: "recipe"`:

- video hecho con una receta de fábrica → **"¿Guardamos este video como tu receta?"**;
- video hecho con una receta personal y con correcciones anotadas → **"¿Mejoramos «…»?"**.

Las correcciones del plan (`syka_plan nota`) aparecen para tildar. "Crear receta"
o "Guardar mejoras" le manda al agente el pedido; "Ahora no" la oculta en este
equipo. Se ofrece una sola vez por estado de las notas (`plan.ofertaReceta`).
Código: `ofertaDeReceta` en `plan/tools.ts`, el final de `runTurn` en `host.ts`
y `RecipeOfferItem` en `apps/web/src/agent-chat/items.tsx`. Probado en Syka: la
tarjeta apareció sola después de una corrección chica.

### Liquid Glass y limpieza de skills (2026-11-03)

- Nueva base `docs/skills/syka-liquid-glass`: piezas nativas (`examples/liquid.tsx`) con el
  vidrio dibujado por un `shaderPaint` sobre la misma toma, titular, cifra con fuente,
  frase, pasos, placa y `validar()` (cara libre, superposición, bordes, topes de palabras,
  cifras con fuente). Probada en `E:\Syka Studio\Pruebas\receta-liquid-2026-11-03`.
  Inspirada en la skill edicion-liquid de Claudio Conde; el código es propio.
- "Skills y flujos" muestra las skills personales y sólo las bases que `catalog.json`
  marca `library: true` (hoy `syka-liquid-glass`). Las demás siguen incluidas para el agente.
- Se quitaron `syka-editing-recipe` (reemplazada por recetas y planes), `syka-motion-reference`
  (la cubre `syka-video-references`), `syka-motion-lab` y `syka-huashu-motion` (sus fichas
  siguen en `syka_motion_knowledge`).
- Los documentos internos con fecha, `docs/qa`, `docs/research` y `docs/references` salieron
  del repo; copia en `E:\Syka Studio\Documentacion\Historial desarrollo\syka-studio-docs-2026-11-03`.

## Pendiente

1. **Probar "Crear receta"** desde la tarjeta: que el agente proponga nombre,
   muestre el resumen, espere el sí y guarde con `syka_receta guardar`.
2. **Frases del plan**: el agente sigue descartando los avisos `line-missing`
   aunque el plan y la pantalla no coinciden. Conviene subirlo a error cuando
   la escena tiene texto nativo distinto, o que `syka_delivery` lo muestre.
3. **Crear recetas desde videos de referencia** (usa `syka_reference_video`).
4. **Bug**: la actualización desde la app no termina de instalar ni de reiniciar.
5. **Ícono** del encabezado de la tarjeta: no se dibuja.
6. **Commit y nueva versión**, cuando la persona lo pida.
