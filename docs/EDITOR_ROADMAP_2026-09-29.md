# Syka Clips: estado del editor y siguiente flujo

Fecha: 2026-09-29. Base auditada: el fork local de Diffusion Studio.

Este documento conserva la auditoría y las propuestas de la etapa inicial. Para el estado posterior de toolbar, Solo, historial y herramientas Codex, ver [la entrega implementada](./EDITOR_UPDATE_2026-09-29.md). Las tablas de capacidades anteriores reflejan la auditoría inicial, no sustituyen ese informe actualizado.

## Alcance ajustado por el usuario

La siguiente implementación autorizada incluye quitar la instalación confusa del CLI, reparar Solo de grupos, herramientas visibles de timeline, cabeceras más claras, separar audio y mejorar la coherencia del historial. También conectar búsqueda web, imágenes nativas de Codex y navegación pública mediante navegador aislado, sin depender de la cuenta de Diffusion ni añadir claves OpenAI.

**Brand Kit, primera edición automática y nuevos sistemas de motion quedan para después.** Renombrar, ocultar, mute/solo y el inspector ya existen: hay que mejorar su presentación y conexión, no contarlos como herramientas nuevas.

### Propuesta para el panel derecho, todavía sin implementar

Mantener dos áreas reconocibles:

- **Propiedades:** el inspector actual responde al clip seleccionado; texto, encuadre, tiempo, audio, efectos y animación. Una escena vacía sólo muestra controles generales, por eso parece tener menos funciones.
- **Recursos del agente:** skills del proyecto, perfil de video y acceso a automatizaciones. Una skill aporta instrucciones/procedimientos; una herramienta aporta una capacidad ejecutable; el perfil combina agente, skills y parámetros. No son lo mismo.

Ejemplos de perfiles futuros: **Reel** (formato vertical, ritmo y skills de subtítulos/encuadre), **Video largo** (estructura, capítulos y audio), **Motion** (gráficos y skills de composición). Elegir un perfil configura el trabajo; no dispara una edición automática sin material e intención.

Las automatizaciones necesitarán un registro local de trabajos, estado y cancelación; programar cuando la app está cerrada requiere además una estrategia de ejecución de escritorio. No hay cronjobs operativos en esta entrega. El glosario va en Configuración. Brand Kit puede sumarse luego como recurso del proyecto; no se crea un botón vacío ahora.

## Entrega actual

- Perfil local: agregar, cambiar, previsualizar y quitar foto; guardar con el nombre. PNG/JPEG/WebP de hasta 5 MB, recorte cuadrado y reducción a WebP de hasta 256 px. Se guarda en `syka.local-profile.v1`, sin cuenta ni servicio de Diffusion.
- La foto aparece también en la fila del usuario del dashboard. Los perfiles anteriores siguen funcionando.
- TypeScript y compilación del renderer pasaron. La pantalla del perfil se verificó en Brave; el usuario confirmó que la foto funciona. Después de volver a abrir Electron se capturó el dashboard con su foto conservada. La prueba automatizada completa de carga/reapertura no se da por aprobada: la extensión bloqueó la carga de archivos y el navegador aislado mostró una página vacía. Esto no impidió comprobar el resultado real en Electron.
- Syka y BridgeClip se abren en Electron. AgentCut se sirve en `http://127.0.0.1:3100` y Remotion Studio en `http://127.0.0.1:3010/SykaVideo`.
- Remotion Studio muestra la composición inicial vacía del proyecto anterior, no el proyecto de Diffusion convertido. Se capturó su interfaz. Tiene una advertencia de defaultProps y otra de versión de Zod; esta entrega no valida renders de ese proyecto.
- Los archivos nuevos de herramientas, perfiles y capturas quedan dentro de `F:/Coding Proyects/Syka Clips`. Se conserva el contrato de medios/proyectos en `D:/Syka Media/05 🧩 Proyectos creativos/Syka Clips/Personal`.

## Qué es cada zona señalada

- **Cabeceras de pistas / lista de capas:** abajo a la izquierda; nombres, orden, selección y controles de cada capa.
- **Toolbar de timeline:** controles de edición junto a la timeline; conviene hacer visibles las acciones frecuentes.
- **Inspector:** panel derecho superior; cambia propiedades del elemento seleccionado.
- **Mezclador de audio / soundboard:** panel derecho inferior; ganancias de capas, master y medidores.

## Audio: qué funciona y qué falta

| Función | Estado comprobado | Límite |
| --- | --- | --- |
| Volumen de capa y master | El AudioBus real aplica ambas ganancias; siete casos numéricos de ganancia/mute pasaron | No se compararon MP4 exportados en esta auditoría |
| Mute | Silencia la capa o el master; existe persistencia en JSX | La ruta de persistencia/exportación se comprobó por código |
| Medidores estéreo | RMS y peak reales, después del fader; prueba del worklet pasó | No son controles de panorama |
| Solo de clip | Aísla el clip en reproducción | Es monitoreo temporal, no una propiedad que se exporte |
| Solo de grupo | **Fallo reproducido:** silencia también a los hijos del grupo | Corregir descendientes en el conjunto permitido |
| Canales visibles | Dos capas seleccionables y master | No hay una tira fija por pista |
| Procesamiento avanzado | No se encontró EQ, compresor, limitador, reducción de ruido, panorama ni cadena de efectos | Implementar progresivamente |

Otro ajuste necesario: el fader acepta hasta +60 dB y el inspector hasta +12 dB. Deben compartir un rango coherente. Los faders dependen de que playback cree los buses de audio.

Evidencia detallada: `../../.runtime/diffusion/qa/AUDIO_AUDIT_2026-09-29.md` y los JSON de resultados junto a él. Son pruebas aisladas del código de producción; no alteraron el proyecto del usuario.

## Timeline: reutilizar antes de duplicar

Ya existen implementaciones para mover y recortar, snapping, dividir en el playhead con **Ctrl+B**, copiar/cortar/pegar, duplicar, borrar, undo/redo, ordenar y agrupar, ocultar/mutear/solo, keyframes y cambios de tiempo/velocidad. Hay transiciones para elementos de secuencias. Este inventario se verificó por fuente, no con una prueba de UI de cada acción.

El menú de timeline contiene varias entradas sin callback: Split, markers, selección avanzada, magnetic track y algunas acciones de velocidad/audio/transición. Un atajo funcional no convierte en funcional la entrada equivalente del menú. Los markers del inspector tampoco se persisten actualmente. No se encontró un comando dedicado de ripple delete ni bloqueo de pista/clip.

## Qué implementar primero

| Orden | Área | Cambio propuesto | Referencia / razón |
| --- | --- | --- | --- |
| 1 | Edición básica | Toolbar con dividir, duplicar, borrar, snapping, undo/redo; conectar menús existentes | CapCut hace las acciones frecuentes más visibles; Syka ya tiene parte del código |
| 2 | Cabeceras de pistas | Nombre, tipo, mostrar/ocultar, mute/solo y bloqueo; estados claros | Evitar que herramientas esenciales queden escondidas |
| 3 | Historial | Unificar cambios de chat y edición manual, con revisión y deshacer por turno | El undo de fuente del agente y el historial visual son mecanismos distintos |
| 4 | Audio | Reparar Solo de grupos, unificar rangos y mostrar canales con nombres | Primero confiabilidad del mezclador actual |
| 5 | Agente | Dar acceso acotado a documentación JSX/skills y a contexto de medios; actividad comprensible | Hoy el bridge no puede leer todas las referencias que necesitan las composiciones complejas |
| 6 | Inspector | Organizar Video, Audio, Texto, Subtítulos, Animación y Efectos; completar crop, flip y encuadre | Mantener controles existentes y añadir los que falten, según selección |
| 7 | Subtítulos | Groq real, edición de palabras/timing, estilos y correcciones; edición desde la transcripción | BridgeClip aporta un buen flujo de primera pasada; falta validar con la cuenta Groq propia |
| 8 | Brand Kit local | Logos, colores, fuentes, estilos de subtítulos, intros/outros, márgenes seguros | Aplicar identidad consistente desde chat y UI, sin cuenta externa |
| 9 | Motion | Presets de entrada/salida, transiciones y keyframes editables | Aprovechar el motor actual y evaluar bloques de HyperFrames/Remotion con adaptadores |
| 10 | Timeline de medios | Miniaturas, formas de onda, zoom y proxies para material pesado | El MCP ya ofrece extracción de filmstrips/waveforms; falta convertirlo en flujo visible |
| 11 | IA para primera edición | Silencios/muletillas, candidatos de clips, reencuadre y propuestas de B-roll | Cambios reversibles; distinguir clips rápidos de videos trabajados |
| 12 | Biblioteca | Assets del proyecto, búsqueda y reutilización; licencias visibles para música/SFX | Que cada proyecto tenga materiales localizables y reutilizables |
| 13 | Audio avanzado | Primero fades y normalización; luego EQ, compresor/limitador y reducción de ruido | No confundir controles de ganancia con una suite de audio |
| 14 | Exportación | Presets por plataforma, variantes de formato, cola y validación previa | Mantener el proyecto editable y exportar sólo después de revisar |

### Qué tomar de las referencias

- **BridgeClip:** entrada de archivos/VOD, selección de momentos, primera pasada de subtítulos, encuadres y recorte de silencios. Es una referencia para preparar el material, no una timeline completa.
- **AgentCut:** dos entradas —crear un video o extraer clips— que desembocan en un editor; reglas/plantillas del usuario, planes y revisión de cambios. Su proyecto/historial requieren adaptación, no se pueden mezclar directamente con el JSX de Diffusion.
- **CapCut:** organización del inspector, toolbar visible, cabeceras de pistas y acceso rápido a texto, audio, efectos y transiciones. La captura procede de documentación oficial y sirve de referencia visual; no se copia código de CapCut.
- **HyperFrames:** catálogo de gráficos y escenas animadas, SDK y herramientas de edición a evaluar por bloques. Integrar una plantilla requiere preservar tiempos, assets y paridad entre preview y exportación.
- **Remotion / El Mago:** continuar como sistema complementario para composiciones complejas. No hay hoy conversión automática y completa entre el proyecto Diffusion y el proyecto Remotion.

Fuentes de referencia: [CapCut desktop](https://www.capcut.com/resource/capcut-desktop-download), [uso en PC](https://www.capcut.com/resource/how-to-use-capcut-on-pc), [HyperFrames Studio](https://github.com/heygen-com/hyperframes/blob/main/packages/studio/README.md), repositorios locales `references/agentcut`, `bridgeclip`, y evaluación `../../studio/docs/HYPERFRAMES_EVALUATION_2026-09-29.md`.

## CLI y agente: capacidades actuales

El CLI es un control remoto por comandos para la aplicación local; **no es un modelo de IA**. El fork ya tiene un CLI compilado y shims locales. No hace falta instalar el CLI upstream de Diffusion para usar Syka.

Para ver ayuda desde PowerShell:

```powershell
node "F:/Coding Proyects/Syka Clips/diffusion-studio/apps/cli/dist/index.js" --help
```

Permite consultar contexto, abrir proyectos, comprobar composiciones, capturar frames/pantalla, inspeccionar medios, generar filmstrips/formas de onda y solicitar exportación. El CLI y el chat tienen permisos diferentes: que un comando esté en el CLI no implica que el chat pueda ejecutarlo. La ayuda conserva algunas entradas upstream cuya implementación está desactivada en Syka; conviene limpiar ese catálogo.

### Un prompt en el inicio de Codex

El código del dashboard puede crear/seleccionar un proyecto y preparar `index.tsx` antes de enviar el prompt. El bridge puede leer y editar ese archivo para construir escenas, textos, gráficos, animación y colocar medios disponibles. Con texto solo puede componer motion graphics; para editar una grabación necesita el archivo o acceso al material.

No se validó en esta entrega el recorrido completo dashboard→video nuevo→exportación. Las ediciones de fuente, deshacer y capturas cuentan con pruebas reales de la etapa anterior.

| Capacidad | Chat integrado actual |
| --- | --- |
| Leer/editar fuente existente | Sí, con versiones/hash y backups |
| Deshacer edición de fuente | Sí, mecanismo propio |
| Contexto, check, captura, fuentes y metadata de medios | Sí, por allowlist MCP |
| Frames, filmstrip y waveform | Sí |
| Subtítulos automáticos | La composición puede solicitarlos; la ruta usa mezcla local y Groq; falta clave/prueba real |
| Herramientas normales de Codex: web, navegador, apps, imagegen, subagentes | No están heredadas automáticamente por este bridge |
| Crear archivos auxiliares, descargar YouTube o exportar autónomamente desde el chat | No está conectado hoy en su allowlist |
| Adjuntos como entrada nativa de visión/audio | No: actualmente se pasan rutas en texto |
| Skills y documentación JSX | Incompleto: discovery del host desactivado y referencias fuera del proyecto inaccesibles al lector acotado |

La suscripción habilita el acceso al modelo; **las herramientas las proporciona nuestra aplicación**. Integrar generación de imágenes de Codex o análisis audiovisual necesita un puente explícito y validación, no aparece por compartir el login.

## Flujo recomendado

1. Elegir **clip rápido** o **video trabajado**, describir intención y aportar material.
2. Crear el proyecto e inventariar medios, duración, formato, transcripción y Brand Kit disponible.
3. Preparar una primera edición editable: selección de tramos, orden, limpieza, subtítulos, encuadres, audio y motion según el modo.
4. Presentar preview y cambios comprensibles. El usuario edita manualmente o pide cambios por chat; ambos modifican el mismo proyecto y tienen un historial coherente.
5. Revisar y exportar. En videos trabajados, permitir llevar una composición/paquete al Mago mediante un contrato definido, sin prometer una traducción perfecta entre motores.

La próxima implementación recomendada es **toolbar/cabeceras, historial compartido y contexto del agente**. Luego Brand Kit y subtítulos. Es la base que permite que el flujo automático y el manual se complementen sin acumular botones desconectados.

## Punteros de código

- Perfil: `apps/web/src/context/auth.tsx`, `components/dashboard/account-view.tsx`, `components/dashboard/sidebar.tsx`, `components/dashboard/utils.ts`, `hooks/use-avatar.ts`.
- Dashboard y creación: `apps/web/src/components/dashboard/home-view.tsx`, `apps/desktop/src/projects.ts`.
- Bridge: `packages/agent-chat/src/host/codex.ts`, `packages/agent-chat/src/host/source-tools.ts`.
- Audio: `packages/runtime/src/media/audio-bus.ts`, `packages/runtime/src/systems/playback.ts`, `apps/web/src/hooks/use-volume-meter.ts`.
- Timeline: `apps/web/src/engine/input/shortcuts.ts`, `engine/split.tsx`, `components/sidebar-left/project-menu/timeline-menu.tsx`.
