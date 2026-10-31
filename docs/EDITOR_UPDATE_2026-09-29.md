# Syka Clips: herramientas y puente Codex

Entrega local del 29 de septiembre de 2026. Complementa la auditoría previa y el roadmap; describe esta implementación, no una migración de motor.

## Edición implementada

- Se retiraron los botones de instalación/desinstalación del CLI y el CTA «Install agent tools». Las conexiones de agentes siguen accesibles; la sección informa que Syka CLI ya está incluido.
- Barra visible sobre la timeline: **Deshacer, Rehacer, Dividir, Duplicar, Borrar, Separar audio y Snapping**. Los estados reflejan la selección y las capacidades reales. Snapping cambia el ajuste magnético del motor y la preferencia persistida, con atajo N.
- Cabeceras con nombre y controles identificables. F2 o doble clic renombra; las etiquetas explican ocultar, mute y Solo. Estas funciones ya existían; se mejoró su acceso.
- Separar audio crea un clip editable que conserva el archivo original, tiempo resuelto, recorte, velocidad y automatización de volumen. El video queda muteado. No transcodifica ni elimina el audio del archivo original. Ambos cambios pertenecen a un paso del historial. Los casos no compatibles muestran la razón y no modifican el video.
- Solo de un grupo conserva sus hijos y la ruta hacia Master; excluye ramas ajenas y respeta mutes y ganancias. Al quitar Solo restaura la mezcla. Solo sigue siendo monitoreo temporal y no altera el export.
- Fader e inspector comparten rango −60 a +12 dB, con 0 dB en el centro del fader.

## Historial compartido

Electron y el host del agente usan el mismo journal persistido en `.syka/edit-history` del proyecto. Guarda snapshots y hashes, serializa escritores de distintos procesos y recupera transacciones interrumpidas. Manual y chat comparten el orden de Deshacer/Rehacer; no se reproducen operaciones del documento anterior después de una recarga.

Antes de enviar un mensaje al agente o restaurar un cambio, se guardan las ediciones pendientes. Insertar audio y mutear el video forman un solo paso. Un nuevo cambio invalida la rama de Rehacer.

Un cambio externo no reconocido bloquea el historial y muestra un aviso. La compilación puede mostrar esa fuente sin reestamparla ni sobrescribirla. No se adopta ni se reinicia silenciosamente el historial externo.

**Límites actuales:** un archivo de fuente por lote, hasta 256 KiB. Los lotes multiarchivo se rechazan antes de escribir; el orden puede alternar archivos entre lotes. Assets y configuración tienen su propia persistencia: el journal no es una copia completa del directorio. Restaurar un snapshot puede recuperar también selección/cámara anteriores. No hay panel visual de todas las revisiones todavía. Un cierre en un punto excepcional de reclamación de lock puede necesitar recuperación asistida conservadora.

## Codex: por qué faltaban herramientas y qué cambió

La suscripción da acceso al modelo; el chat de nuestra app tiene su propia sesión y lista de herramientas. No hereda automáticamente las herramientas, plugins o conexiones de esta conversación de Codex Desktop. El puente anterior deshabilitaba búsqueda web e imágenes y exponía principalmente lectura/edición de fuente e inspección del editor.

Ahora están conectadas:

- **Búsqueda web nativa en vivo**, con resultados y enlaces.
- **Generación nativa de imágenes de Codex**, con la suscripción y sus límites, sin una API key OpenAI nueva. El host valida los bytes y guarda una copia durable en `03 Assets reutilizables/Generados/Codex` del proyecto. El chat muestra la imagen y obtiene una ruta verificada.
- **Navegador público aislado:** abrir una URL, leer texto/enlaces y obtener una captura. Usa Chrome/Edge existente; perfil y temporales bajo el runtime de Syka en F. No usa el perfil personal ni envía formularios, archivos o credenciales. Es consulta pública, no automatización de cuentas. El navegador no se descarga automáticamente.

El registro en la biblioteca enlaza el PNG/JPEG/WebP del proyecto, evita duplicados y espera las cargas/importaciones activas para preservar el manifiesto. La tarjeta del chat permite usar el asset. Generación nativa y registro local son pasos distintos.

No se habilitaron automáticamente todas las apps, plugins, shell o agentes de Codex. Las skills del editor necesitan su propio catálogo/contexto; no aparecen por compartir el login. Groq sigue siendo el proveedor de transcripción previsto; no se realizó una transcripción real nueva sin la cuenta propia configurada.

Referencias primarias: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [imágenes en Codex](https://learn.chatgpt.com/docs/image-generation). El soporte se verificó además con el CLI instalado y pruebas reales de la cuenta.

## Verificación local

- Runtime de audio real con `OfflineAudioContext`: 10 casos Solo; antes fallaban 5. Control de fader real: 4 posiciones verificadas.
- Suites host: 121 tests desktop y 69 agent-chat; incluyen journal, SourceTools, dos procesos, conflictos y recuperación. Informe detallado en `.runtime/diffusion/qa/SHARED_HISTORY_2026-09-29.md`, fuera de este repositorio.
- Pruebas de timeline, separación y writer; protección del historial; TypeScript y builds web/desktop.
- Electron aislado, con proyecto QA independiente: CLI sin CTA, toolbar, snapping, separación y undo/redo, split, duplicado/borrado, F2, cambios manual→SourceTools del chat→manual, recarga con historial persistido. Sin errores de página. Esta prueba de cambios de fuente usa la herramienta real del host; no simula que el modelo haya decidido esas ediciones.
- Cuenta Codex real: búsqueda web, una imagen generada e importada al proyecto, y navegador con lectura/captura solicitado por el modelo. Los reportes se guardan bajo `.runtime/diffusion` del workspace.

No se publicó ni se hizo una nueva prueba completa de exportación MP4 en esta entrega. La validación del editor se realizó sobre persistencia, preview y herramientas, con fixtures separados del proyecto del usuario.

## Propuesta para la derecha — pendiente

Mantener **Propiedades** como inspector contextual. Seleccionar texto, video, audio o escena cambia los controles disponibles: el inspector ya existe.

Sumar luego una pestaña **Agente** con:

1. Skills activas y qué aportan al proyecto.
2. Perfiles de video, por ejemplo Reel, Video largo o Motion; combinan instrucciones, skills y parámetros del agente.
3. Automatizaciones locales, con horario, estado, pausa/cancelación y resultado. Ejecutar con la app cerrada requiere una estrategia de escritorio adicional.

El glosario va en Configuración. **Brand Kit, primera edición automática y nuevos sistemas de motion se posponen** por decisión del usuario. No se añadieron botones vacíos ni cronjobs operativos.
