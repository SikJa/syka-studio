# Almacenamiento y conservación de medios

Configuración → Almacenamiento controla una política local, guardada por usuario
con escrituras atómicas y revisión para evitar cambios perdidos entre ventanas.

| Ajuste | Valor inicial |
|---|---|
| Limpieza automática | Activada mientras Syka está abierta |
| Revisión | Un minuto después de abrir y cada hora |
| Caché de transcripciones sin uso | 30 días |
| Tamaño máximo de esa caché | 2 GB |
| Temporales registrados de trabajos interrumpidos | 1 día |
| Papelera de descartes explícitos | 7 días |
| Aviso en Almacenamiento | Menos de 5 GB libres en el disco de Syka |

El plazo de caché se reinicia al reutilizar un resultado. El límite elimina los
resultados más antiguos primero, conservando los que se usaron en la última hora.
"Sin vencimiento" y "Sin límite" son opciones independientes. Una medición parcial
no se utiliza para decidir eliminaciones por tamaño.

Los videos importados, audios, fotos, capturas y referencias guardadas, fuentes,
exportaciones, historial, borradores, credenciales y modelos instalados nunca
entran en la limpieza automática. Un proyecto cerrado o inactivo conserva sus
medios. Las descargas normales se eliminan al terminar; el plazo configurable
cubre restos registrados tras interrupciones. Los temporales antiguos sin un
registro de propiedad no se eliminan por suposición.

Los trabajos registran PID del host y de sus procesos de descarga. Un PID vivo
protege su carpeta. La limpieza espera durante grabación, descarga o transcripción,
aprovecha al menos 30 segundos de inactividad de entrada del sistema,
revalida propiedad y rutas inmediatamente antes de eliminar, rechaza enlaces y
uniones de carpetas y conserva elementos que no puede verificar. Se recorren
directorios concretos con límites y cesiones al bucle de eventos; no se inspecciona
todo el disco ni todas las carpetas de proyectos cada hora.

Las referencias descartadas con `syka_reference_video dispose` y las grabaciones
descartadas mientras se graba pasan a una papelera recuperable. El video descartado
se finaliza para conservar una toma reproducible. Cerrar la previsualización de
una grabación terminada conserva el adjunto. El contenido de papelera queda en
`.syka/storage-trash` dentro de su proyecto: moverlo no duplica videos entre discos.
El índice de la papelera permanece en los datos de Syka. Recuperar no sobrescribe
contenido existente y requiere que la carpeta original del proyecto esté disponible.

"Revisar limpieza" muestra lo elegible sin modificar archivos. La confirmación
vuelve a comprobar su estado. "Limpiar toda la caché" sólo afecta caché de
transcripciones, sin vaciar anticipadamente la papelera ni borrar medios del chat.
Los resultados de limpieza indican el espacio lógico eliminado y los fallos;
el espacio físico libre puede variar por otras aplicaciones o archivos compartidos.

## Guías consultadas

- [Adobe: caché por edad y por tamaño](https://helpx.adobe.com/ca/premiere/desktop/troubleshooting/media-issues/automatically-manage-your-media-cache-files.html)
- [Apple: conservar originales al eliminar archivos generados](https://support.apple.com/es-es/guide/final-cut-pro/verb8e5f6fd/mac)
- [Electron: ciclo de vida, userData y sessionData](https://www.electronjs.org/docs/latest/api/app)
- [Node: lstat, realpath y operaciones de archivos](https://nodejs.org/api/fs.html)

La recuperación no depende de un evento de cierre: Electron documenta que varios
eventos de salida no se emiten durante el apagado o cierre de sesión de Windows.

## Verificación

`apps/desktop/src/storage/storage.test.ts` prueba conservación, caducidad, cuota,
procesos activos, rutas alteradas, enlaces, preferencias dañadas y recuperación.
La suite de almacenamiento, referencias, descarga, transcripción y grabación pasó
56 pruebas. El ciclo de descarte de grabaciones se verificó con un motor simulado;
no se hizo una nueva captura real de pantalla o micrófono.
`node scripts/qa-storage-settings.mjs` usa Electron oculto e IPC real, con su
propio perfil y archivos mínimos. Nunca utiliza proyectos o proveedores personales.
Se verificaron guardado y recarga, revisión sin borrar, limpieza confirmada,
recuperación, atajos, preferencias de grabación, temas y errores recuperables.

La activación de desarrollo sólo recompila `build:main` y `build:agent-host` y
reutiliza el runtime existente. No genera un instalador ni copia dependencias.
