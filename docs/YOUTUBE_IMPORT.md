# Importar un video de YouTube en Syka Studio

Implementado y validado el 6 de octubre de 2026. Usa yt-dlp y FFmpeg locales; el video termina en el proyecto nativo de Diffusion.

## Uso

1. En Inicio, pegá un enlace de YouTube en el mismo composer donde escribís el pedido. Se admiten `watch`, enlaces `youtu.be`, Shorts y directos terminados.
2. Syka lee el título, canal, duración y capítulos antes de descargar. Podés escribir el resto del pedido mientras tanto.
3. En videos cortos, elegí **Importar video** o **Elegir sólo un fragmento**. En un directo terminado, un video de más de 30 minutos o una duración desconocida, elegí un inicio y un final. Los tiempos admiten segundos, `mm:ss` o `hh:mm:ss`.
4. Esperá la descarga. **Cancelar** termina el descargador y su FFmpeg y limpia los temporales de esa importación. El pedido del composer sigue ahí.
5. **Abrir proyecto** abre el video editable y traslada el mensaje y el adjunto al chat sin enviarlos a un modelo. También podés completar el pedido en Inicio y enviarlo cuando estés listo.

En un proyecto vacío se crea una escena con el video. En un proyecto que ya tiene edición, se incorpora a Assets → Importados y se conserva su timeline. Se puede quitar el adjunto y volver a adjuntarlo desde la ficha sin descargarlo de nuevo. Varios enlaces se preparan de a uno.

## Directos y transcripción

Cada importación admite hasta 30 minutos y un límite de 2 GB; no se descarga silenciosamente un directo de 12 horas. Podés traer otro intervalo después. Una emisión activa, programada o todavía en procesamiento se rechaza con una explicación.

Importar **no transcribe** ni llama a Groq, OpenRouter ni otro modelo. El agente recibe el archivo local, el enlace original y el rango elegido. Así, puede transcribir sólo el fragmento que le pedís. La cola persistente de transcripción y el reparto por cuota de Groq siguen siendo trabajo separado, descrito en `DIRECTOS_GROQ_PLAN.md`.

## Persistencia y límites

- El MP4 vive en `assets/imported/`. Su ficha queda en `.syka/imports/<id>.json`, y la biblioteca lo registra en `assets.yml`.
- La ficha conserva URL, título, capítulo/rango, duración local y mapa temporal. Para un recorte de 1:00:00 a 1:00:30, el segundo local 5 corresponde al segundo original 3605.
- No se guardan URLs firmadas de las pistas ni metadata completa de yt-dlp. No se leen cookies del navegador ni se inicia sesión automáticamente. Si YouTube restringe un video, la interfaz propone importar un archivo local.
- H.264/AAC hasta 1080p cuando está disponible; se conserva la resolución del original si es menor. FFprobe verifica duración, tamaño y pistas antes de integrarlo.
- El historial compartido permite deshacer la creación de la escena inicial. Importar a una edición existente no la reemplaza.
- La cancelación y los fallos limpian sus temporales. Reanudar una descarga parcial después de cerrar la aplicación aún no está implementado; el MP4 terminado y su origen sí permanecen al reabrir.
- Windows tiene una prueba completa real. Los caminos de herramientas y la cancelación por grupo de procesos son portables a macOS, pero todavía falta validarlo en una Mac.

## Dependencias

Se reutilizan las herramientas detectadas por Syka. No se instala ni actualiza ningún ejecutable al pegar un enlace.

- Windows: `winget install yt-dlp.yt-dlp` y una instalación de FFmpeg con FFprobe.
- macOS: `brew install yt-dlp ffmpeg`.
- Rutas manuales opcionales: `SYKA_YT_DLP_PATH`, `SYKA_FFMPEG_PATH`, `SYKA_FFPROBE_PATH`. Syka también busca binarios administrados y en PATH.
- Si hay Node local, se ofrece a yt-dlp como runtime JavaScript. Se deshabilitan configuraciones/plugins del descargador y descargas automáticas de componentes remotos.

Referencia técnica oficial: [opciones de descarga de yt-dlp](https://github.com/yt-dlp/yt-dlp#download-options).

## Evidencia de esta entrega

Proyecto reabrible: **15 · YouTube · intervalo 0:03–0:10**, ID `vEEAOOy9WSQtXvOFC8PkR`.

Carpeta local: `F:/Coding Proyects/Syka Clips/Pruebas Syka/15-youtube-import/fast-forest-6-oct`.

La prueba importó por la interfaz el video público [Me at the zoo, jawed](https://www.youtube.com/watch?v=jNQXAC9IVRw), intervalo 3–10 s. FFprobe confirmó 7.000 s, 320×240, 15 fps y audio estéreo. Es una prueba de importación, no una edición creativa. No hubo transcripción ni turnos de IA.

Capturas y resultados en `Pruebas Syka/resultados/youtube-import/`: lectura del enlace, selector de rango, descarga terminada y editor nativo. La reapertura y una edición nativa con deshacer se verificaron. `result.json` registra el estado, el rango, el chequeo nativo sin issues y el borrador preservado al abrir el proyecto.

Pruebas automáticas: validación de URLs, directo activo/archivo/12 h/sin duración, límites de rango, tiempos, metadata saneada, persistencia del mapa temporal, cancelación de procesos reales de prueba, eliminación de temporales y rechazo de doble inicio. Las pruebas de red son la importación real descrita arriba; los casos de 12 h y cancelación usan fixtures locales controlados.
