# Syka: arnés, superprompt y selección · 2026-10-10

## Cambios implementados

- Ctrl/⌘ + clic suma/quita componentes sin abrir una nota por clic. Al soltar
  aparece una corrección conjunta. El botón Escribir nota también cierra una
  colección manual. El seek limpia los recuadros del instante anterior y conserva
  las notas guardadas. La bandeja mantiene accesibles encabezado y envío.
- Tutorial de primera selección, persistido por perfil, con botón ? para repetirlo.
- Grabar zona desde preview y selector. Flujo corregido según el segundo video:
  Elegir una zona → Empezar → selector sobre el escritorio → soltar → grabar.
  El setup se oculta antes de capturar; no hay recorte dentro de una miniatura.
- Selector temporal, aislado y sin ciclo de animación: sólo acepta su propio IPC;
  destruye ventana y handlers al confirmar, cancelar, perder foco, cerrar el dueño,
  fallar el renderer, desmontar el panel o vencer el plazo. Las coordenadas son
  relativas a la pantalla y se convierten a píxeles físicos antes de grabar.
- motion-plan genera el JSON, superprompt de seis bloques y vistas design.md,
  frame.md, audio-plan.md desde un único mapa de beats/eventos. No escribe archivos
  por sí solo. Las instrucciones requieren preservar/versionar diseños aceptados.
- Revisión de exports recortados: exportStartSeconds traduce eventos del reloj de
  composición al MP4. Foco/lectura siguen relativos al archivo. El snapshot incluye
  brief y documentos; no certifica que el MP4 sea de la revisión actual.
- Se mantiene la consulta útil para nuevas piezas, decisión sonora universal y
  cierre persistente de preguntas. Correcciones puntuales reutilizan el brief.
- Catálogo de 27 skills del producto, agrupadas, con rutas relativas y hashes,
  generado y incluido en staging. No incluye skills del perfil del desarrollador.
- El launcher de desarrollo usa una copia privada del runtime con nombre/icono y
  metadata Syka Studio. No modifica el Electron compartido. El paquete ya tenía
  identidad Syka Studio; el desarrollo necesitaba el ejecutable propio.
- La detección de recursos distingue el ejecutable de desarrollo con SYKA_DEV_RUN.
  Todos los consumidores usan isPackagedBuild: interfaz, docs, fonts, agentes y
  helpers nativos. Renombrar Electron no debe cargar el bundle instalado antiguo.

## Evidencia técnica

- 47 pruebas agent-chat: plan, revisión, preguntas y harness. Typecheck del host.
- 16 pruebas desktop: modo de instalación/desarrollo, rutas de runtime, coordenadas,
  rangos de video, aislamiento, cancelación, cierre, falla de carga y desmontaje.
- Fixture Chromium de selección: 27 comprobaciones, incluyendo fuentes HTML exactas,
  clipping/transforms, multiselección, seek, notas y envío del lote simulado.
- Fixture Chromium de grabación: 12 comprobaciones del orden de operaciones,
  cancelación, rectángulo inverso, tamaño mínimo, confirmación única y Esc.
- Smoke en Electron real, sin ventanas visibles ni grabación: ambos monitores,
  conversión DPI, preload sandbox, IPC de confirmar/cancelar y limpieza.
- Builds web y desktop, incluyendo el preload nuevo y recorder nativo.
- Staging: 27 entradas y 27 hashes coincidentes. Skill motion-brief válida.
- Binario privado: ProductName, FileDescription y OriginalFilename Syka Studio.

Las fixtures no editan el proyecto del usuario. No se generó instalador ni se hizo
una producción con un modelo externo. Queda la prueba manual del gesto real y de
la grabación con sonido. Los avisos de tamaño de chunks y use-client de crt-warp
son advertencias del build, no fallos de estas comprobaciones.

## Activación local

Reiniciado después de que el usuario confirmó el fin de la grabación. Proceso
principal 20384: Syka Studio.exe; ProductName y FileDescription Syka Studio.
La ventana real cargó http://localhost:5188/#/projects/m75mc8zt502ILvAAxxsea y
restauró Calm Forest 8 Oct con el acceso Grabar una zona de la pantalla. El host
del agente está activo. No se editó el proyecto durante la verificación.

La [lista completa de skills](SKILLS_INCLUDED.md) y la
[guía de selección](guides/component-selection.md) son documentación pública y se
incluyen en los recursos del producto. Este informe local no se distribuye.
