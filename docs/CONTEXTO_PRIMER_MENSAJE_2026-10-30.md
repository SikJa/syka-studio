# Contexto del primer mensaje — 30/10/2026

## Problema

Desde el 27/10 el arnés de Codex es progresivo: 4 herramientas visibles al inicio, el resto se descubre a demanda, y las instrucciones dicen "no precargues bibliotecas" y "las secciones omitidas no son una cola de lectura". Eso abarata las correcciones chicas, pero empuja al modelo a leer poco también en el primer mensaje. Los proyectos reales guardan contexto clave en la raíz: en D10-01 hay `BRIEF.md`, `PROMPT-EDICION.md` (11 KB), `CONTINUAR-20261025.md`, `ESTADO-EDICION.json` y `MOTIONS-PROPUESTOS.md`, más la receta, 22 transcripciones y evidencia editorial. Nada obligaba a leerlos.

## Cómo lo resuelve HyperFrames

Fuentes leídas en el equipo, sin copiar código: el repositorio en `Desarrollo/references/hyperframes`, las skills instaladas en `~/.codex/skills/hyperframes*` y los módulos `main/agent.mjs`, `agentRunPrompt.mjs`, `chatRules.mjs` y `handoffText.mjs` de HyperFrames Studio (extraídos de su `app.asar` a una carpeta temporal).

1. **Enrutamiento por estado.** La skill de entrada `/hyperframes` es obligatoria y aplica la primera fila que coincide: puerto explícito, operación puntual, pregunta o idea (se responde sin cambios), pieza nueva en un proyecto existente, corrección puntual (se edita sin entrevista), `BRIEF.md` existente (se ejecuta su flujo sin volver a preguntar), proyecto con archivos pero sin brief (se retoma desde esos archivos) y creación desde cero (entrevista de intención que termina en `BRIEF.md`).
2. **Bloque `<app_context>` en cada turno.** El host agrega datos concretos que el modelo no tiene que descubrir: selección y marcas, momento y cabezal, tamaño del cuadro, transcripciones disponibles (marcadas como datos no confiables), clip bajo el cabezal, componentes elegidos, una imagen del cuadro, carpetas de solo lectura, correcciones posteriores y la conversación previa con otro motor (hasta 12.000 caracteres).
3. **Reglas de sistema que clasifican el mensaje.** Pregunta o plan: se responde en texto y no se cambia nada. Antes de cambiar un proyecto: leer la guía central y el historial de cambios hechos por la persona desde la última vez. Después: `check`, capturas de los momentos tocados y mirarlas antes de responder.
4. **Carga de skills por dominio.** Las ediciones que cruzan dominios cargan todas las skills de su fila, no solo una.
5. **Brief durable.** La entrevista escribe `BRIEF.md`, que es el único artefacto de enrutamiento; los turnos siguientes lo leen en vez de volver a preguntar.

## Qué se implementó en Syka

- **`first-turn.ts` → `RESEARCH_PROTOCOL`**, dentro de las instrucciones progresivas y antes de las reglas de corrección chica. Hay tres estados: pregunta o plan (responder sin cambios), corrección puntual (camino liviano de siempre) y primer pedido sustancial, pieza nueva o pedido que depende de decisiones no leídas (fase de investigación). En la investigación el modelo lee completos los documentos del proyecto, las decisiones guardadas, las referencias y las skills que aplican; resume lo encontrado y lo que falta; y recién después pregunta (hasta tres preguntas) o construye. Los límites de lectura acotada siguen valiendo para las correcciones posteriores.
- **`projectSnapshot(cwd)`**, un bloque `<app_context>` que solo se agrega en el primer turno de cada chat y que el chat del usuario no muestra. Contiene nombres y tamaños de los documentos del proyecto, las fuentes de la composición, el estado guardado (receta, brand kit, preferencias, `assets.yml`) y las carpetas con sus conteos. No lee el contenido de ningún archivo y en D10-01 ocupa unos 900 caracteres.
- Los proveedores que no son progresivos (Claude, ACP, OpenCode) reciben una regla equivalente más corta.

## Cómo probarlo

Abrí un chat **nuevo** en un proyecto con documentos (por ejemplo D10-01) y pedí algo sustancial, como "seguí con la edición". El primer mensaje debería leer los documentos listados y resumir lo encontrado antes de actuar. Una corrección chica posterior debería seguir siendo rápida.

## Pendiente

- Medir con turnos reales el costo y la calidad de la investigación.
- Evaluar si conviene adoptar el `BRIEF.md` único de HyperFrames como artefacto de enrutamiento (Syka hoy reparte brief, receta y memoria).
