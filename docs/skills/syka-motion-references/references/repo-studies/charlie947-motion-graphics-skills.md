# charlie947/motion-graphics-skills

Estudio original de Syka; snapshot 2026-10-09, commit 4cd156acdad0483884867c2d5a22268db66099d1.

Fuente: https://github.com/charlie947/motion-graphics-skills

## Aporte observado en documentación
motion-brief-writer separa contexto de marca, hechos, copy, tarea, salida y ejemplos. Trece módulos de trabajos distintos.

## Adaptación a Diffusion
Completar los seis bloques existentes de production-prompt.md con hechos, parámetros, referencias concretas y criterios de revisión.

## Límites
El brief writer es una etapa interna, no una orden de detener la producción. No importar preferencias visuales o preguntas redundantes.

## Complemento de documentación: reference-to-motion

Revisión del 2026-10-10, snapshot dfc4284d9f2dcfefacbc8f06729f38deacc54192:
la colección suma `reference-to-motion` (14 módulos en ese snapshot). La nueva
skill distingue referencia de movimiento de referencia de apariencia/marca;
propone un desglose breve y preguntas sobre copy, duración y formato reutilizando
datos ya conocidos. Su salida breve para Claude Motion es propia de ese flujo.

Syka conserva el prompt extenso de seis bloques y su consulta sonora universal.
Adapta la separación de funciones con `brief.references.roles` y suma relato,
audio y técnica cuando corresponde. No impone el límite upstream de 300 palabras
ni su renderer. Este complemento es lectura documental, no ejecución o revisión
del video generado por el repo.

Fuente: [reference-to-motion/SKILL.md](https://github.com/charlie947/motion-graphics-skills/blob/dfc4284d9f2dcfefacbc8f06729f38deacc54192/skills/reference-to-motion/SKILL.md).

## Procedencia y alcance

Complemento 2026-10-11, commit 229022ebca76972e119e36ada23a1648d51665ab:
la colección tiene 15 skills y agrega motion-prompt-writer. Syka adapta la base
de marca reutilizable y la escena variable con ocho partes en shortPrompts del
mismo motion-plan, conservando el superprompt extenso. launch-video y motion-effects
alimentan la receta syka-product-launch y sus componentes originales ProductDemo,
ProductFocus y LaunchCover. No se imponen Apple, seis segundos, loop ni tamaños
universales. CANON-FACTS valida patrones de prompt, no hechos del producto.
Fuente: https://github.com/charlie947/motion-graphics-skills/tree/229022ebca76972e119e36ada23a1648d51665ab
MIT.
Lectura: Skill de brief completa y README principal.
No se ejecutó el pipeline upstream ni se certificó la calidad de sus videos/audio. Este estudio no instala otro motor y no reproduce el contenido completo de la skill original. Los recursos de producción requieren sus propios derechos.

Documentos consultados:
- [README.md](https://github.com/charlie947/motion-graphics-skills/blob/4cd156acdad0483884867c2d5a22268db66099d1/README.md)
- [skills/motion-brief-writer/SKILL.md](https://github.com/charlie947/motion-graphics-skills/blob/4cd156acdad0483884867c2d5a22268db66099d1/skills/motion-brief-writer/SKILL.md)
