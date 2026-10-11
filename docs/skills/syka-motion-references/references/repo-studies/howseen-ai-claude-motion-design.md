# howseen-ai/claude-motion-design

Estudio original de Syka; snapshot 2026-10-09, commit 3d90d349ef3fdde9b7e89de4df4a2159c9e8697f.

Fuente: https://github.com/howseen-ai/claude-motion-design

## Aporte observado en documentación
seek(t) determinista, continuidad de objetos, detección de flashes, seam de posición y velocidad, SFX alineados por su pico y drops medidos.

## Adaptación a Diffusion
Extraer criterios de continuidad y elegir muestras alrededor de eventos; conservar el reloj de Diffusion.

## Límites
Parte del workflow depende de carpetas personales no incluidas. No adoptar siempre movimiento, copia 1:1, cambios de modelo ni aprobaciones del autor.

## Procedencia y alcance
MIT.
Lectura: README y secciones principales de la skill; no ejecución del pipeline.
No se ejecutó el pipeline upstream ni se certificó la calidad de sus videos/audio. Este estudio no instala otro motor y no reproduce el contenido completo de la skill original. Los recursos de producción requieren sus propios derechos.

Documentos consultados:
- [README.md](https://github.com/howseen-ai/claude-motion-design/blob/3d90d349ef3fdde9b7e89de4df4a2159c9e8697f/README.md)
- [skill/motion-design/SKILL.md](https://github.com/howseen-ai/claude-motion-design/blob/3d90d349ef3fdde9b7e89de4df4a2159c9e8697f/skill/motion-design/SKILL.md)
