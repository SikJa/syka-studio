# Bencho público: 24 sonidos locales

Los 24 sonidos del repo público están en Biblioteca → Sonidos, proveedor Bencho.
Buscá `syka_resources action:list kind:sounds audioType:sfx query:Bencho` y
refiná por acción/familia: selección, notificación, confirmación, movimiento,
inicio, cierre o espera. No se instala Bencho ni se llama a su web al utilizarlos.
No convertir esta colección en una preferencia obligatoria frente a otros sonidos.

Son síntesis de interfaz con el carácter aprobado en la preview, en WAV de
48 kHz/24 bits estéreo, perfiles medidos y cuePoint. Conservan nivel relativo
y el gain de escucha de esa preview. Beacon y Plop derivan de Cuelume; no se
presentan como grabaciones originales o dos familias completamente nuevas.

Importá con `assets copy:true`, verificá la copia por hash y usá `<audio>` nativo.
Esto conserva los archivos en el proyecto y permite editar, buscar en timeline
y exportar. No copies `play()` a un componente HTML para sonorizar el video:
los eventos de mouse no sustituyen la sincronización con el reloj de la escena.
La licencia MIT y el aviso de Cuelume se conservan también dentro de cada WAV.

Fuente fijada: https://github.com/cabralorenzo/bencho/tree/30ab35a575eb83eed8f086a6893d4d6426f4fa91
Los sonidos Pro y la identidad/fotografías del sitio están excluidos. No activar
una compra, cuenta o MCP de Bencho como requisito para esta colección.
