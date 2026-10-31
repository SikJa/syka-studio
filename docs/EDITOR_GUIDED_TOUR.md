# Recorrido guiado del editor

Guía voluntaria en español, dentro del proyecto actual. La primera apertura ofrece «Ver recorrido» o «Ahora no». Se puede reabrir desde el menú del proyecto → Ayuda → Recorrer el editor, o desde Configuración → Ayuda. No inicia conversaciones, exportaciones ni cambios de edición.

Los 13 pasos explican el proyecto, chat, modelo, dictado, archivos, preview, selección de componentes, captura, timeline, biblioteca, propiedades, deshacer y exportar. El último apunta al botón **Exportar** visible en la cabecera: usa el mismo `exportScene` del menú y del atajo existente.

El avance y cierre se recuerdan en `syka.editor-tour` por perfil local, con versión de contenido. Completar y luego reabrir/cerrar no degrada la finalización. No es memoria editorial ni entrenamiento del modelo.

## Interacciones

- Siguiente / Atrás; flechas sólo cuando el foco está dentro del recorrido.
- Omitir / cerrar / Escape conservan el borrador y el proyecto.
- Resaltado no bloqueante; se puede escribir durante el recorrido.
- Dictado apunta al `button[data-tour-target="dictation"]` real, configurado o deshabilitado. Prefiere el composer enfocado y descarta clones de transición, nodos ocultos e inertes.
- Al desacoplar, mantiene el indicador mientras termina la animación y después sigue el botón real.
- Animaciones Transitions.dev: apertura de 400 ms, cierre de 350 ms; respeta reducción de movimiento del sistema y de la app.
- `editorTourVisible` permite posponer otras sugerencias, incluida la oferta posterior a la exportación, mientras esta guía está en pantalla.

## Verificación realizada

Electron aislado, sin reiniciar 5188 ni tocar los proyectos 12–15. Proyecto propio bajo `.runtime/tour-qa-projects/1791330628631`.

- Los 13 objetivos encontrados y tarjeta dentro de la ventana de 1200×720.
- Omitir, recargar, reabrir desde Ayuda, completar, reiniciar Electron y reabrir desde Configuración.
- Navegación con teclado, restauración de foco y borrador conservado; fuente del proyecto idéntica antes/después.
- Micrófono real en ocho variantes: fijo/flotante, 1200×720/940×700, estado Groq configurado/sin configurar. La geometría resaltada coincide con la del botón, no un wrapper. Los dos estados de conexión son fixtures de respuesta de estado: no se guardó ninguna clave, no se grabó ni se llamó a transcripción.
- Exportar visible en ambos anchos y temas; el click recorre el comando real hasta el diálogo nativo de guardar. La prueba responde Cancelar al diálogo y verifica que el botón se habilite de nuevo. Esta comprobación no pretende ser otra validación del render final.
- Tres pruebas unitarias de persistencia, versión, almacenamiento fallido y posición.

Evidencia: `Pruebas Syka/resultados/editor-tour/` (en la carpeta superior del repositorio), `result.json`, `mic-export-result.json`, capturas 01–08. Scripts reproducibles locales: `.runtime/editor-tour-qa.mjs`, `.runtime/editor-tour-reopen-qa.mjs`, `.runtime/editor-tour-mic-export-qa.mjs`.

No se validó macOS en un equipo Mac. La cabecera ofrece un acceso equivalente en plataformas sin barra Windows, pero esa rama necesita QA nativa antes de considerarla confirmada.
