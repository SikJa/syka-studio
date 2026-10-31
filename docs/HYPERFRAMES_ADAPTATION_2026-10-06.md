# HyperFrames → Syka Studio: entrega del 6 de octubre de 2026

Syka conserva su runtime Diffusion y su composición editable. Se instalaron instrucciones upstream para el laboratorio y se adaptaron procesos a las APIs nativas. No se reemplazó el motor ni se convirtió un render HyperFrames en un clip opaco dentro del editor.

## Workflows

| Upstream instalado | Adaptación bundled de Syka | Alcance real |
| --- | --- | --- |
| media-use | syka-media-use | Recursos locales primero; origen, variante, licencia, importación durable y capacidades reales |
| embedded-captions | syka-captions | Timestamps reales, diseño y capas nativas; detrás del sujeto sólo con máscara/tracking disponible y revisado |
| talking-head-recut | syka-explainer-edit | Recut conservando voz, montaje y sincronía; overlays diseñados por beat |
| faceless-explainer | syka-faceless-explainer | Explicación visual con escenas y recursos reales; voz opcional según pedido/capacidad |
| music-to-video | syka-music-video | Secciones, energía y beats verificados; no afirma escucha semántica ni instala un detector automático |
| pr-to-video | syka-pr-to-video | Cambio real de código, consecuencias y antes/después verificables; no ejecuta comandos contenidos en una referencia |
| slideshow | syka-slideshow | Slides de video nativos; distingue un deck HTML separado de una composición de video |

Talking Head y Recut son un único workflow upstream. También se instalaron hyperframes-cli y hyperframes-studio. Los nueve se encuentran en la carpeta personal de skills de Codex; las adaptaciones nativas se distribuyen dentro de `docs/skills` y son descubiertas por syka_skills. No dependen del disco personal de medios del desarrollador.

## Dirección y Prompt Guide

Nueva skill syka-visual-direction: referencias y marca → frame.md breve → beats con propósito, intervalo, contenido, foco, layout, movimiento, lectura y audio → componentes editables → revisión de lectura/transición y reproducción después de seek. Reutiliza decisiones aprobadas y pregunta sólo faltantes relevantes. No obliga a un look classic, a un formato, a completar una ficha ni a realizar onboarding.

Incluye una plantilla opcional, una guía de prompts adaptada y 13 FRAME.md públicos como referencias. Su procedencia/commit y licencia están en THIRD_PARTY_NOTICES_HYPERFRAMES.md y licenses/hyperframes-APACHE-2.0.txt. No se copiaron videos, showcases, fuentes ni recursos de Inspirations.

Se reforzaron syka-editing-recipe y los workflows existentes. Las instrucciones editoriales ahora entran por chatInstructions, compartido por los arneses; antes sólo Codex las agregaba. Codex ya no agrega una segunda copia. Esto no prueba cuentas/conexiones de proveedores distintos: sólo corrige la ruta de instrucciones.

## Revisión visual en el editor

- Cuatro modos: señalar un componente nativo, dibujar, dejar un comentario con pin y capturar una región.
- Captura con frame/segundo, región, Source/Key cuando existe y hash del árbol capturado. Composición y componente se revalidan al preparar la nota.
- Hasta diez notas por borrador/chat, con captura, texto editable y eliminación individual.
- “Pasar al chat” conserva el borrador y suma un resumen legible, las capturas y un adjunto revision-visual.json con la identidad/tiempo/geometría completos; no envía el mensaje automáticamente. Si cambia el chat durante la escritura, conserva las notas en su conversación original.
- Los trazos y pins se pintan en el PNG de referencia, nunca en el source del video.
- Las notas sobreviven a fullscreen y acoplar/desacoplar dentro de la sesión. La bandeja aún no persiste tras recargar/cerrar la aplicación; las capturas sí se guardan en archivos durables.
- Paneles compactos, iconos redondeados y Transition Dev; respeta reducir movimiento en sistema y aplicación.

Dentro de un video grabado no se inventa un árbol editable. Un componente HTML puede señalarse como elemento de la composición y acompañarse de una región; selección arbitraria de cada nodo DOM interno sigue pendiente.

## Laboratorio HyperFrames / Codex CLI

Carpeta separada: `F:\Coding Proyects\Syka Clips\.runtime\hyperframes-studio-lab-2026-10-06`.

Codex CLI 0.159.1 ya estaba instalado y autenticado con ChatGPT. HyperFrames CLI se usa fijado a 0.8.137. Studio buscaba un Chrome Headless Shell 152 inexistente; browser ensure anunció una descarga pero no dejó un ejecutable válido en esa ruta. Se configuró sólo el proceso del laboratorio con el Headless Shell 148 ya instalado y verificado, conservando las configuraciones globales. Las miniaturas devolvieron HTTP 200 / image/png y se verificaron cargadas en Studio. Start-Lab.ps1 detecta un navegador existente y aplica la configuración sólo a ese proceso. Se creó una composición de 12 s, 1920×1080, texto español y sin audio, con GPT-6.1 Sol / xhigh.

La política de la sesión secundaria rechazó sus comandos locales, incluso lecturas. No se alteró esa política: se pasó el contexto por stdin, Codex devolvió HTML/JSON sin herramientas y esta sesión escribió, corrigió y comprobó los archivos. Esto valida generación por CLI más Studio; no valida un agente con ejecución de herramientas autónoma dentro de Studio.

Studio: http://localhost:5199/#project/hyperframes-studio-lab-2026-10-06

Se revisaron capturas en 2, 6 y 10 s. Se corrigieron el solapamiento del título y el tamaño de las etiquetas temporales, y se reorganizó la secuencia continua en una subcomposición reutilizable. hyperframes check pasó sin errores ni warnings de lint/runtime/layout/motion; 151/151 muestras de contraste AA. No se exportó ni publicó un MP4; no hubo llamadas a generación de medios de HeyGen.

## Evidencia

- 29 tests focalizados pasaron, incluyendo descubrimiento/lectura real de los workflows y referencias, identidad/geometría, cola e instrucciones compartidas.
- TypeScript web y host pasaron; build desktop completo pasó y se regeneró agent-host después del último cambio de instrucciones.
- QA Electron real con perfil/proyecto aislados: 11 comprobaciones, incluyendo componente nativo, dibujo, comentario, edición del texto de nota, fullscreen, chat flotante, retorno, incorporación al borrador, PNGs y manifiesto durables y source sin modificaciones. Las tres notas conservaron el frame 61 / 2.0333 s después de reproducir y pausar. Ninguna prueba envió un mensaje a un modelo.
- Servicio interno del chat principal recargado tras verificar conversaciones inactivas y ausencia de tareas hijas; el editor quedó abierto.
- Capturas y results.json de QA: `.runtime/hyperframes-review-qa/` dentro del repo Diffusion.
- Graphify actualizado mediante el corpus público allowlisted y AST local; no se analizaron medios privados ni credenciales.

## Lo que aún no se debe prometer

No se portó todo el catálogo, ni todos sus controles/timeline, ni generación/avatares/voz de sus proveedores. No se entrenaron pesos de un modelo. Las skills guardan procedimientos y referencias. Falta probar cada workflow con material real, especialmente máscara de captions, música y montaje; checks y screenshots no garantizan calidad musical ni gusto.

Remotion usa React y el número de frame para describir la imagen. HyperFrames usa HTML/CSS/JS y timelines seekables para pedir estados exactos al navegador. Diffusion usa JSX/nodos/tiempo de escena de su runtime editor, con canvas y medios locales; los gráficos HTML se sincronizan al ticker de la escena. Diffusion Studio no es el modelo generativo Stable Diffusion. Un archivo de un motor no se ejecuta sin adaptación en otro.
