# Criterios de adaptación del chat — 2026-10-01

## Requisitos confirmados por Sikora

Conservar los componentes actuales de Mirel con sus animaciones, efectos, funciones y comportamiento. No reemplazarlos por imitaciones estáticas. Cambiar el tratamiento de fotografías y adjuntos en una iteración posterior, manteniendo el resto de la experiencia.

Skills y MCPs pertenecen a una superficie propia de Syka, fuera del chat. Se eliminó el acceso Skills/MCPs del menú del composer; la gestión existente sigue en configuración.

## Correspondencias de backend

- Sesión: conversación persistida con proveedor, modelo, esfuerzo, historial y cursor para reanudar. Cambiar de sesión no debe mezclar borradores, adjuntos ni resultados. El historial por proyecto actual se conserva.
- Proyecto: proyecto creativo local de Syka, con su carpeta, assets y composición principal. Las agrupaciones de conversaciones de Mirel no deben crear carpetas de video automáticamente ni modificar la composición al seleccionar un chat.
- Programadas: tareas nativas de Syka, vinculadas a proyecto y agente. Requieren persistencia, próxima ejecución, pausa, cancelación, registro del resultado y política para evitar ejecuciones duplicadas. No usar endpoints de rutinas de Mirel ni sustituirlo por automaciones de la aplicación Codex. La programación y su UI aún no están implementadas.
- Proveedor: cada adaptador debe declarar modelos, esfuerzos, herramientas, capacidades multimedia y recuperación de sesión reales. Codex es el adaptador conectado. Claude y Hermes requieren conectores funcionales y comprobación de su autenticación; no quedan habilitados simplemente por agregar sus nombres al selector.
- Funciones que un proveedor no soporta: explicar la disponibilidad sin inventar ejecución, contexto, velocidad o créditos. No rebajar las funciones disponibles de otro proveedor.

## Comprobación de esta iteración

El composer TSX, su CSS y el lightbox coinciden con los archivos actuales de Mirel después de excluir la directiva local de compilación JSX React. Se preservan MetalFx, CRTWarp, animaciones de menús, interacciones y reducción de movimiento. La adaptación se realiza alrededor de los componentes, mediante el puente.

Esta iteración retira el acceso Skills/MCPs del composer y fija estos criterios; no afirma haber migrado todavía toda la navegación de sesiones, proyectos y programadas, ni tener conectores Claude/Hermes activos.
