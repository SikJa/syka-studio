# Skills incluidas en Syka Studio

Catálogo generado desde los archivos públicos del producto: **28 skills**. Se incluyen en los recursos de la aplicación y se accede con syka_skills; no se descargan videos ni se requiere la biblioteca personal de su desarrollador. El manifiesto [catalog.json](skills/catalog.json) registra nombre, categoría, ruta relativa y SHA256.

## Edición y revisión

| Skill incluida | Función |
|---|---|
| [editor.md](skills/editor.md) | Edit footage in Syka |
| [syka-design-import](skills/syka-design-import/SKILL.md) | Diseño resuelto → composición nativa |
| [syka-edit-review](skills/syka-edit-review/SKILL.md) | Revisión proporcional |
| [syka-editing-basics](skills/syka-editing-basics/SKILL.md) | Edición con Syka |
| [syka-editing-recipe](skills/syka-editing-recipe/SKILL.md) | Una receta que el próximo chat pueda continuar |
| [syka-explainer-edit](skills/syka-explainer-edit/SKILL.md) | Explicaciones con footage real |
| [watch.md](skills/watch.md) | Watch footage in Syka |

## Dirección y motion

| Skill incluida | Función |
|---|---|
| [syka-editorial-motion](skills/syka-editorial-motion/SKILL.md) | Motion editorial en Diffusion |
| [syka-faceless-explainer](skills/syka-faceless-explainer/SKILL.md) | Explicar mediante imágenes |
| [syka-motion-brief](skills/syka-motion-brief/SKILL.md) | Del pedido al plan de producción |
| [syka-motion-direction](skills/syka-motion-direction/SKILL.md) | Dirección de motion |
| [syka-motion-reels](skills/syka-motion-reels/SKILL.md) | Motion para reels |
| [syka-motion-storyboard](skills/syka-motion-storyboard/SKILL.md) | Storyboard que se puede construir |
| [syka-motion-transitions](skills/syka-motion-transitions/SKILL.md) | Transiciones fluidas en el reloj de Syka |
| [syka-motion-typography](skills/syka-motion-typography/SKILL.md) | Tipografía que conduce la animación |
| [syka-pr-to-video](skills/syka-pr-to-video/SKILL.md) | Explicar un cambio, no inventar un lanzamiento |
| [syka-product-launch](skills/syka-product-launch/SKILL.md) | Lanzamiento con una demostración real |
| [syka-slideshow](skills/syka-slideshow/SKILL.md) | Presentación y video son entregables distintos |
| [syka-visual-direction](skills/syka-visual-direction/SKILL.md) | Dirección que se puede ejecutar y corregir |

## Subtítulos

| Skill incluida | Función |
|---|---|
| [syka-camera-3d-captions](skills/syka-camera-3d-captions/SKILL.md) | Captions con profundidad |
| [syka-captions](skills/syka-captions/SKILL.md) | Captions legibles |

## Música y sonido

| Skill incluida | Función |
|---|---|
| [syka-local-audio](skills/syka-local-audio/SKILL.md) | Música y diseño sonoro nativo |
| [syka-music-video](skills/syka-music-video/SKILL.md) | Música como estructura |

## Referencias y recursos

| Skill incluida | Función |
|---|---|
| [syka-media-use](skills/syka-media-use/SKILL.md) | Recursos con una función en el relato |
| [syka-motion-reference](skills/syka-motion-reference/SKILL.md) | Referencia a motion editable |
| [syka-motion-references](skills/syka-motion-references/SKILL.md) | Referencias que dirigen una pieza |
| [syka-video-references](skills/syka-video-references/SKILL.md) | Referencias de video en Syka |

## Entrega y publicación

| Skill incluida | Función |
|---|---|
| [syka-content-package](skills/syka-content-package/SKILL.md) | Contenido desde el chat que ya está abierto |

## Qué necesita configurar cada persona

Las instrucciones vienen incluidas; ejecutar sus herramientas requiere una cuenta del agente conectada. El motor Diffusion y sus funciones nativas de preview/export pertenecen a la aplicación. La transcripción nueva usa la conexión opcional propia de Groq; subtítulos ya transcritos no necesitan repetirla. La revisión del MP4 y ciertos flujos de audio/referencias requieren los binarios locales que figuran en Herramientas locales (FFmpeg/FFprobe, Python o yt-dlp según la operación). Búsqueda web, imagen, publicación y modelos dependen de sus proveedores y capacidades reales. Una skill no instala ni autentica un servicio.

Las skills del perfil personal, de otro agente o de un proyecto son opcionales y no se cuentan como parte del instalador. Los medios privados, cuentas, claves, historial y proyectos del desarrollador no se incluyen. El staging valida este catálogo; el tamaño final sólo se conoce al generar un instalador.
