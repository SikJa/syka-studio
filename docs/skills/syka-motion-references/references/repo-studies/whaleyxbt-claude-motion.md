# whaleyxbt/claude-motion

Estudio original de Syka; snapshot 2026-10-09, commit e627941543d9988b155dc610bb9cc0115a5e365e.

Fuente: https://github.com/whaleyxbt/claude-motion

## Aporte observado en documentación
Beats con nombres en un timeline compartido; audio y revisión consumen el mismo plan. Revisión por beat, transición y lectura a 360 px.

## Adaptación a Diffusion
Usar identificadores de eventos sobre la composición nativa y extender syka_motion_review; aprovechar el generador de audio que ya existe.

## Límites
Sus presets visuales y cifras de mastering son decisiones de ese autor. La equivalencia de su medidor con FFmpeg no fue validada aquí.

## Procedencia y alcance
MIT en LICENSE; recursos de terceros conservan sus condiciones.
Lectura: Documentación principal completa y lectura parcial del mezclador.
No se ejecutó el pipeline upstream ni se certificó la calidad de sus videos/audio. Este estudio no instala otro motor y no reproduce el contenido completo de la skill original. Los recursos de producción requieren sus propios derechos.

Documentos consultados:
- [README.md](https://github.com/whaleyxbt/claude-motion/blob/e627941543d9988b155dc610bb9cc0115a5e365e/README.md)
- [.claude/skills/motion-design/SKILL.md](https://github.com/whaleyxbt/claude-motion/blob/e627941543d9988b155dc610bb9cc0115a5e365e/.claude/skills/motion-design/SKILL.md)
- [.claude/skills/review-loop/SKILL.md](https://github.com/whaleyxbt/claude-motion/blob/e627941543d9988b155dc610bb9cc0115a5e365e/.claude/skills/review-loop/SKILL.md)
- [.claude/skills/sound-design/SKILL.md](https://github.com/whaleyxbt/claude-motion/blob/e627941543d9988b155dc610bb9cc0115a5e365e/.claude/skills/sound-design/SKILL.md)
- [sfx/mix.py](https://github.com/whaleyxbt/claude-motion/blob/e627941543d9988b155dc610bb9cc0115a5e365e/sfx/mix.py)
