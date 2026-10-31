# Handoff — sesión del 29 y 30/10/2026 (Claude Code)

Para retomar en una sesión nueva. Leé esto primero.

## Dónde está cada cosa

- **Código:** `E:\Syka Studio\Desarrollo\syka-studio`. La carpeta se renombró desde `diffusion-studio` el 30/10. Se actualizaron los accesos internos de `node_modules`, los `.lnk`, `Start-Syka-Diffusion.ps1`, el directorio seguro de git, los 9 worktrees, el Python de Graphify y su `pyvenv.cfg`.
- **App instalada:** `B:\Apps\Programas propios\Syka Studio\Aplicacion`. Se abre con `Abrir Syka Studio.ps1`; los datos están en `E:\Syka Studio\Datos` y los proyectos en `E:\Syka Studio\Motions`.
- **Backups de la app:** `B:\Apps\Programas propios\Syka Studio\Backups\app-antes-*` (uno por cada instalación).
- **Compilar e instalar:** `node .runtime/model-catalog-cache-20261029/build.mjs` compila web, host, main, preloads y `resource-worker.js` sobre una copia de la app instalada. Para instalar, con Syka cerrado: mover `Aplicacion\resources\app` a `Backups` y copiar `.runtime\model-catalog-cache-20261029\app` en su lugar. **Siempre pedirle a la persona que cierre Syka antes.**
- **No publicar en GitHub** sin pedido explícito. El repositorio `SikJa/syka-studio` es privado.

## Lo que se hizo (todo instalado)

Detalle en `docs/AUDITORIA_RENDIMIENTO_BACKEND_2026-10-29.md` y `docs/CONTEXTO_PRIMER_MENSAJE_2026-10-30.md`.

- **Proveedores:**
  - Lista de modelos guardada (`provider-catalogs-v1.json`), así el selector aparece al instante.
  - Las comprobaciones corren de a dos: primero el proveedor más usado, Hermes al final y el elegido pasa adelante. Se recomprueban cada 15 min si están conectados y cada 1 min si fallaron.
- **Perfil:** `launch-roots.json` en `AppData\Roaming\Syka Studio` fija la carpeta de datos y la de proyectos, para que la app no vuelva a abrir un perfil vacío. Esa era la causa de que se "perdieran" Groq, Zernio y los chats.
- **Actualizaciones:** si el repositorio es privado, la app lo avisa en lugar de decir "estás al día".
- **Chats:**
  - Las capturas se guardan como archivos en `chats/<id>/images` y los chats viejos se migran al abrirlos (respaldo en `events.jsonl.inline-images.bak`).
  - Al abrir un chat solo se mandan los elementos visibles.
  - La reconstrucción del historial bajó de 159 ms a 5 ms.
- **Biblioteca:**
  - Corre en un worker (`resource-worker.ts`).
  - Usa el índice guardado al instante y reutiliza la lista ordenada entre páginas.
  - Vistas previas por streaming (`syka-resource://`) y skeletons.
- **GPU en reposo:** mascota a 10 fps en reposo. El metal anima con la ventana activa y se pausa en segundo plano.
- **Configuración → Diagnóstico:** CPU y RAM por proceso, tiempos de cada proveedor y tamaño del historial.
- **Proyectos:**
  - El escaneo entra en carpetas de lote y vuelve a escanear al abrir, respetando los proyectos que se sacaron de la lista.
  - Los proyectos con nombre al azar toman un título del modelo chico del proveedor (Luna o Haiku) en su primer mensaje, sin mover la carpeta.
- **Primer mensaje:** fase de investigación y resumen `<app_context>` del proyecto (`first-turn.ts`), adaptados de HyperFrames.
- **Entorno de procesos:** se agregaron `SYSTEMDRIVE` y `PROGRAMDATA` a las listas de variables permitidas. Su falta creaba carpetas `%SystemDrive%` dentro de los proyectos.
- **Limpieza:** 65 carpetas de pruebas en la papelera; los informes quedaron en `docs/historial-runtime`. Se copiaron los 15 chats del lote desde el perfil viejo al perfil real.
- **Tests:** 1.424 de 1.425 pasan. `projects-history` falla solo con la máquina cargada.

## En curso: prueba Syka vs HyperFrames

- **Protocolo:** `docs/PRUEBA_SYKA_VS_HYPERFRAMES.md`.
- **Pedido:** `E:\Syka Studio\Pruebas\lanzamiento-syka-referencias\PROMPT-LANZAMIENTO-SYKA.md`, un video de lanzamiento de Syka Studio y Recorder protagonizado por la mascota. Se adjunta la misma carpeta de referencias en las dos apps.
- **La persona corre la prueba.** Después hay que comparar:
  - Registros de Syka: `E:\Syka Studio\Datos\profile\agent-chat\chats\<id>\events.jsonl` y las sesiones de Codex en `E:\Syka Studio\Datos\codex-runtime\profile\sessions`.
  - Registros de HyperFrames: sus agentes usan los CLIs del usuario (`~/.codex/sessions` en el caso de Codex). Datos de la app en `%APPDATA%\HyperFrames`.
  - Qué medir: tiempo total, tokens (con y sin caché), preguntas, errores, cumplimiento del pedido, y capturas en los mismos segundos de los dos videos.
- La app de HyperFrames está en `B:\Code Apps\HyperFrames Studio\Aplicacion`; su código de prompts se puede extraer de `app.asar` con `npx @electron/asar extract-file`.

## Pendiente (decisión de la persona)

1. Perfil viejo `AppData\Roaming\Syka Studio`: sus chats ya están copiados, falta decidir si se recicla el resto.
2. Backups de la app: dejar el último y reciclar los otros.
3. Las 12 carpetas `%SystemDrive%` dentro de los proyectos: reciclarlas.
4. Lo regenerable de `.runtime` (2,6 GB) y el respaldo de la mudanza de HyperFrames (688 MB).
5. GPU en reposo: perfilar el ~12 % que queda con las animaciones en pausa (desenfoques o transparencia de la ventana). Requiere abrir Syka con `--remote-debugging-port=9333` y cerrarlo después.
6. Releases públicos para que funcionen las actualizaciones.
7. Pasada a fondo de Configuración, Perfil (en inglés, solo menciona Codex) y Chat (dos opciones).
8. Borrar el código muerto `settings/brand-kit.tsx` y la acción `save-brand`.
