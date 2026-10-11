---
name: syka-editing-recipe
description: Resolver y conservar una receta de edición con decisiones acordadas, referencias y revisión. Usar en una edición amplia o al convertir un resultado aprobado en una skill personal para reels, YouTube u otro uso.
---

# Una receta que el próximo chat pueda continuar

Obtené contexto del editor y leé `syka_editing_recipe read`. El pedido actual manda sobre decisiones anteriores. Para un ajuste puntual aplicá lo pedido; no armes un brief ceremonial.

En una edición amplia, resolvé objetivo, formato, material a conservar y dirección visual. Reutilizá respuestas previas. Preguntá solo la decisión que cambia el resultado: «¿De esta referencia querés el ritmo o también las tarjetas?», «¿Conservamos toda la voz?». No hagas que el usuario complete un formulario ni esperes una aprobación para cada cambio reversible.

Guardá la receta con `syka_editing_recipe save`, usando la revisión leída y este contrato:

```json
{
  "version": 1,
  "label": "Explicaciones para YouTube",
  "format": "youtube",
  "skill": "mi-explicador",
  "objective": "Aclarar ideas conservando la voz",
  "decisions": ["Captions en frases, sin emojis"],
  "references": ["referencias/analisis.md", "components/Diagrama.tsx"],
  "review": ["No tapar la demostración", "Verificar ambos lados de cada corte"]
}
```

`format` admite `general`, `reels` o `youtube`: organiza recetas en Biblioteca, no crea otra pantalla de perfiles. No deduzcas un formato de una marca ni dimensiones de la etiqueta. Las referencias son archivos/URLs reales; agregá cobertura, tiempos y qué conservar en un análisis separado. No marques preferencias inferidas como aprobadas.

Separá el pedido del usuario, tus decisiones de este ensayo y los resultados revisados. Por ejemplo: «Pedido: conservar la voz», «Decisión del ensayo: mostrar la comparación después de la frase», «Revisión del usuario: le gustó la prueba; pidió más contraste». Una devolución positiva sirve para continuar desde ese resultado, pero no convierte cada fuente, color o duración en una regla para otros proyectos.

## Referencia → decisiones → componente → revisión

1. Analizá material con `syka-motion-reference`: separar aspecto, movimiento, relato y audio. Indicá qué observaste y qué inferiste.
2. Convertí eso en decisiones concretas: geometría/jerarquía, materiales, acentos, estados antes/después, cue temporal y lectura. Resolver el diseño antes de animar evita tarjetas vacías.
3. Elegí el workflow por el trabajo: `syka-explainer-edit`, `syka-faceless-explainer`, `syka-media-use`, `syka-captions`, `syka-design-import`. Motion: `syka-editorial-motion` y `syka-motion-transitions`. Cargá solo lo necesario.
4. Construí una muestra representativa nativa en la composición visible. Conservar texto/logo/audio editables; ejemplos ejecutables y assets copiados al proyecto, sin depender de la biblioteca privada.
5. Revisá riesgos con `syka-edit-review`; guardá observación, corrección y evidencia en un archivo del proyecto, luego enlazalo en la receta. No equivoques un build verde con un resultado lindo.

Para una edición con varias escenas o una referencia que haya que recrear, leé [references/scene-plan.md](references/scene-plan.md). Guardá un plan compacto en el proyecto y enlazalo en `references`. El plan conecta contenido real, cue de voz, estados del gráfico, recursos, sonido y revisión; no agregues campos inventados al JSON de la herramienta. Una corrección puntual no necesita este documento.

Antes de construir toda una edición, resolvé una muestra representativa con el texto real: un cuadro quieto y su transformación sobre el footage. Podés continuar sin detenerte a pedir permiso cuando el trabajo ya está autorizado. Si el usuario cambia la dirección, actualizá las decisiones y el componente que corresponda; no reinicies el brief ni rehagas escenas que siguen sirviendo.

Para reutilizar entre proyectos, personalizá una base mediante `syka_skills create`: descripción de cuándo usarla, decisiones, referencias y componentes aprobados. Usá frontmatter `metadata:` con `format: reels`, `youtube` o `general`. Varias skills pueden compartir formato; no sobrescribas otra por llamarse «mi estilo». La receta actual selecciona una skill, no copia todo el catálogo al contexto.

Inspiración de proceso: contratos de storyboard, design-spec, memoria y review de [HyperFrames](https://github.com/heygen-com/hyperframes). Adaptación original a herramientas Syka; no ejecuta ni renderiza HyperFrames ni modifica pesos del modelo.

Para dirección visual y prompts, leé `syka-visual-direction`. Para motion/animación sustancial, leé también `syka-motion-direction` y su `references/production-prompt.md`: guardá `production-prompt.md` con sus seis bloques adaptados al proyecto. Guardá `frame.md` y el storyboard/beat plan como archivos del proyecto y enlazalos, junto con ese prompt, en `references`; anotá decisiones resumidas en `decisions`. Esta ruta usa el contrato de receta existente y sus revisiones, sin crear otro perfil ni cambiar el esquema. Un cambio de dirección actualiza esos archivos preservando lo aprobado. Las notas del lienzo aportan evidencia de dónde retocar; no equivalen a aprobación de todas las referencias.
