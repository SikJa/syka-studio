# Liquid: biblioteca, evidencia y adaptación propuesta

## Estado de esta entrega

Implementada la limpieza de la biblioteca: bienvenida y CTA «Crear con Syka» sólo cuando una lectura terminada y sin error devuelve cero skills. También se ocultan las tres tarjetas de conversación inicial cuando existen skills. Lista agrupada en personales e incluidas con Syka, encabezado compacto, scope de aplicación al haber contenido y acción de reintento para errores. No se modifica ni elimina ninguna skill.

Se corrigió además un contenedor del menú de composiciones que permanecía invisible e interceptaba clics: el positioner y su contenido cerrado no reciben pointer events; la apertura conserva interacción y animación.

Verificación nativa por CDP: 1 skill personal + 9 bases; bienvenida ausente con contenido. Vacío/carga/error probados mediante respuestas simuladas en el renderer, sin escribir ni borrar skills reales. Reintento recupera el inventario real. Menú real abierto/cerrado y clic de Biblioteca verificados. TypeScript y build web pasaron. Evidencia local en `.runtime/skills-library-review-2026-10-04` del workspace padre. Las capturas de pantalla de esta sesión no se completaron; la comprobación se hizo mediante DOM, interacción e IPC, no revisión visual de una captura nueva.

La skill `edicion-liquid` sigue sólo en el laboratorio `experiments/claudio-liquid-2026-10-04`. Esta entrega no integra su builder, GSAP ni el runtime HyperFrames en Syka. La adaptación de abajo es una propuesta, no una implementación.

## Qué explica Claudio y qué demuestra el paquete

Fuente: [GPT-6 Astra por fin resolvió la edición de mis videos](https://www.youtube.com/watch?v=6GFuMCWwYrw). Se revisaron la transcripción pegada por el usuario y la descripción descargada previamente en `video.info.json`. El intento de lectura web actual fue limitado por YouTube; no se afirma una verificación nueva del historial de producción del autor.

| Tramo del video | Explicación del autor | Aplicación útil para Syka |
| --- | --- | --- |
| 02:24–04:39 | Recomienda herramientas de código, CLI/API/MCP en vez de operar editores a clics. | Ya usamos herramientas directas y composición fuente; no requiere sustituir Diffusion. |
| 04:39–06:01 | Gráficos HTML sobre una grabación y contexto previo de su marca/logos. | Perfil de estilo y biblioteca de recursos propia, con selección del logo real. |
| 06:01–07:54 | Video base, referencias visuales, Liquid Glass y tipografía conocida. | Guardar paleta, fuentes, recursos y ejemplos aprobados por usuario. |
| 07:54–09:01 | Brief estandarizable, intro más editada y música tenue. | Plan de escenas con densidad ajustada al formato, sin imponer la misma tarjeta a cada frase. |
| 09:01–09:22 | Pide conservar el blooper. | Decisiones editoriales concretas antes de borrar pausas/reacciones automáticamente. |
| 09:22–10:36 | Loop de render, revisión contra skill/brief y corrección. | Capturas y revisión del export con correcciones locales; no basta que compile. |
| Desde 10:36 | Personalizar el framework con la marca y skill propia. | Base genérica incluida + estilo personal opcional + brief específico del video. |

La afirmación de un solo prompt y menos de veinte minutos es del autor. El video no prueba por sí solo todo el historial de ejecución ni que esa velocidad se generalice.

El ZIP agrega evidencia ejecutable: diez tipos de elemento, builder desde JSON, safe_zone, comprobación de solapamientos y límites de tiempo, obligación de citar fuentes en cifras, SVG de lente para dimensiones exactas, receta visual de cuatro capas, variantes claro/oscuro, entradas/salidas finitas, mezcla con ducking y scripts de QA. Su SKILL.md también registra aprendizajes de la primera edición: gráficos sobre fondos limpios, música más baja, encuadre por toma, conservación de bloopers y ajuste exacto de frames.

## Por qué nuestra muestra cambió

No se entrenó un modelo. Se usó una solución mucho más concreta que instrucciones de «hacer una tarjeta elegante»: builder y material originales, animaciones diseñadas, contenido/tiempo definidos en JSON y verificación real. Se eligió el material oscuro después de que el claro fallara contraste sobre nuestra toma; se usó Segoe UI declarada como sustituto local de Inter. Todo lo demás del paquete instalado permanece byte por byte igual al ZIP.

Resultado medido: 11,35 s, 681 frames, 1080p60, voz conservada, ambient sintetizada y mezcla alrededor de -14 LUFS. Check final sin errores de código/runtime/contraste; salida lateral con dos hallazgos informativos de overflow durante su movimiento. Esta muestra sólo prueba frase, diagrama, material y audio. No demuestra toda una edición larga, recorte de silencios o sincronización de pantalla/cámara.

## Qué viene con Syka actualmente

Confirmado en la respuesta nativa de `syka-agent:settings`, fuente `docs/skills` y script de staging. Estas nueve carpetas con SKILL.md se incluyen como recursos de la aplicación y son las bases visibles en Biblioteca:

| Base | Función |
| --- | --- |
| syka-editing-basics | Montaje general y coordinación de recursos. |
| syka-explainer-edit | Video a cámara/tutorial/demo: montaje, voz, captions y gráficos. |
| syka-captions | Subtítulos editables, tiempos reales y sincronía tras cortes. |
| syka-editorial-motion | Tarjetas, comparaciones y anotaciones; incluye ejemplos JSX nativos. |
| syka-motion-direction | Brief visual, storyboard, tipografía y recursos. |
| syka-motion-reference | Análisis de referencias y reconstrucción de motion. |
| syka-motion-transitions | Entradas/salidas y continuidad animada en el reloj del motor. |
| syka-local-audio | Síntesis y mezcla local, con ejemplos/scripts propios. |
| syka-edit-review | Calidad del montaje y export. |

También se incluyen `editor.md` y `watch.md`, documentación de edición/análisis; no son carpetas de skills visibles en esta lista. El perfil personal tiene actualmente `syka-subtitulos-serif-abajo`. No se distribuye con la aplicación. Tampoco se distribuyen las skills globales de Codex (HyperFrames/Remotion/Watch/transitions-dev), las skills privadas de El Mago ni `edicion-liquid` del laboratorio.

Que una base esté incluida no incorpora automáticamente las herramientas externas que sus scripts pueden usar ni las cuentas de transcripción. La app empaqueta estas instrucciones y soportes; la distribución pública/instalador sigue fuera del alcance actual.

## Adaptación recomendada

1. Reforzar el proceso común en `syka-explainer-edit` y `syka-edit-review`: brief, transcript crudo/revisado, plan de escenas, muestra breve, revisión del render y corrección proporcional. Varias reglas ya están escritas; hace falta que el flujo las materialice en archivos/comprobaciones reales.
2. Añadir a `syka-editorial-motion` una colección de componentes propios probados: frase, dato con fuente, pasos, diagrama, logo y comparación. Texto, dimensiones, material, posiciones, tiempos y zona libre deben ser parámetros; cada uno con estados de entrada/lectura/salida y ejemplos sobre footage. Ésta es la mejora visual principal, no más prosa en la skill.
3. Ofrecer Liquid como estilo optativo/personalizable, sin convertirlo en el estilo obligatorio. Mantener perfiles personales de fuente/paleta/logos/ritmo separados de las bases y del brief de cada video.
4. Reforzar `syka-local-audio` con recetas medibles de ambient y ducking reutilizables, preservando originales y sincronía. No es equivalente a componer cualquier género musical.
5. Comparar una misma muestra nativa con el resultado HyperFrames ya aprobado: seek atrás/adelante, export y composición libre de solapamientos/recortes. No declarar material idéntico antes de esta comparación.

### Motor y editabilidad

Diffusion admite DOM en `<html>` y timelines pausados controlados por `useTicker`, pero su HTML se pinta dentro del canvas. El medio se representa con los elementos de composición; `<video>`/`<audio>` dentro de HTML están rechazados. También hay limitaciones documentadas de scale/opacity en capturas. Por eso no se puede pegar el HTML generado por el builder como si el reloj/media de HyperFrames existieran aquí.

Las reglas, geometría, jerarquía y fases se pueden trasladar a componentes nativos. **La refracción del video debajo del vidrio requiere un prototipo específico**: los pixels del footage están en otra capa del compositor; copiar `backdrop-filter` no demuestra que el efecto salga bien en capture/export. Se debe validar la composición del material en el motor antes de prometer igualdad con el test.

Para preservar exactamente la salida original mientras se investiga el material nativo, una alternativa es renderizar el tramo con HyperFrames e importarlo como video en la timeline. Conserva el aspecto, pero los textos/gráficos quedan dentro del video; editar sus parámetros requiere regenerar ese tramo desde JSON. No equivale a controles individuales de cada elemento en Propiedades.

Recomendación: proceso y componentes nativos primero; el render externo como opción cuando se elija esa pérdida de editabilidad para mantener un material exacto. Antes de copiar el builder del ZIP a una distribución pública, verificar el permiso del paquete completo: el aviso MIT que incluye corresponde a la librería óptica y no prueba licencia general de todos sus archivos. Puede mantenerse la implementación propia basada en principios y parámetros de diseño.
