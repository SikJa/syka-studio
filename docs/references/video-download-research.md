# Descargas y referencias de video — 2026-10-08

Se eligió **yt-dlp**, ya instalado y utilizado por la importación de YouTube de Syka. Su lista oficial incluye Instagram, TikTok, Twitter/X y YouTube; eso prueba disponibilidad de extractores, no que cada enlace público pueda descargarse. Instagram/TikTok también pueden pedir sesión, sufrir bloqueos o devolver publicaciones sin video. No se leen cookies ni configuraciones personales: `--ignore-config`, sin plugins remotos, sin playlists y sin caché global.

- [Repositorio y documentación de yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Extractores soportados](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- [Cobalt](https://github.com/imputnet/cobalt): alternativa si se decide alojar una instancia propia. Su API pública usa protección contra bots y no está habilitada para integraciones de terceros sin permiso. Se evitó agregar un servicio remoto o contenedor para duplicar una herramienta que ya funciona localmente.
- [gallery-dl](https://github.com/mikf/gallery-dl): candidato para publicaciones de imágenes/carruseles; no se añadió como dependencia para el primer flujo de video. El proyecto indica que su desarrollo activo se trasladó a Codeberg.

El link de ejemplo `https://www.instagram.com/p/DeK6sw9CbIT/` respondió con tres elementos y errores «No video formats found» en la consulta real anónima. No se pudo descargar un video de esa publicación. No se conectaron cuentas ni se usaron cookies para forzarlo.

Pruebas locales: extracción con FFmpeg/FFprobe de una grabación real del usuario, reapertura de capturas, preparación de MP3 y conservación del original. Pruebas simuladas: transferencia remota, limpieza de descarga exitosa/fallida, retención explícita, recuperación de proceso caído y rechazo de URLs fuera del alcance. Descargas reales completas de TikTok, X y YouTube quedan sujetas a probar enlaces públicos concretos; no se presentan como validadas por los fixtures.

Memoria editorial y limpieza: eliminar el original temporal tras extraer evidencia; conservar el análisis y los cuadros sin vencimiento. Guardar fuente completa solo si se usará en la edición. Ningún temporizador borra clips que una composición usa. Los iconos conocidos reutilizan la familia Remix de Mirel; sitios restantes intentan su favicon y conservan un icono genérico cuando no hay uno disponible.

## Corrección de intención y fichas de enlaces

La regla inicial hablaba de videos y el agente investigó un post de imágenes de Instagram ante un pedido genérico de análisis. Se amplió el contrato a todos los enlaces y se recuerda en cada mensaje dirigido al proveedor, incluidas las sesiones ya abiertas. La decisión de intención sigue siendo del modelo, sin un clasificador de palabras o formatos. No debe abrir la referencia antes de preguntar si el objetivo no está definido.

Validación real: se repitió el pedido original del usuario en su mismo chat con GPT-6.1-Sol y esfuerzo xhigh. El proveedor llamó `syka_ask_user` y se verificó la tarjeta visible en el editor, esperando respuesta. No se respondió por el usuario. Es evidencia de ese turno, no una garantía de cumplimiento de todos los modelos en cualquier contexto.

El composer muestra los enlaces pegados como fichas con logo, nombre del sitio y eliminación individual; oculta la URL en el texto sin perderla en el envío. Los mensajes del usuario también muestran fichas compactas. Se probaron pegado, query string intacta, edición de texto y saltos de línea, eliminación de una entre varias, envío de URL oculta y anchos de 240 a 480 px. Las descargas reales completas pendientes siguen separadas de esta validación de intención.
