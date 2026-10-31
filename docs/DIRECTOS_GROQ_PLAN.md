# Directos largos: importación integrada y plan de transcripción

Revisión: 2026-10-06. Groq STT, no Grok/xAI. El usuario quiere trabajar con VOD de hasta 12 h sin mandar todo como una petición.

Actualización de implementación: ya funciona pegar YouTube en el composer inicial, leer metadata y capítulos, elegir un intervalo de hasta 30 minutos, descargarlo y abrirlo como proyecto nativo editable. No se transcribe automáticamente. Se persisten el enlace y el mapa al tiempo original. Ver `YOUTUBE_IMPORT.md` para flujo, límites y evidencia real. La cola por cuota y la reanudación de transcripciones descritas abajo siguen siendo un plan.

Fuentes: https://console.groq.com/docs/rate-limits y https://console.groq.com/docs/speech-to-text. Free Tier Whisper: 7200 segundos/hora y 28800 segundos/día (2 h/h, 8 h/día), por organización. El límite exacto de una organización puede variar y se consulta en su panel. Tamaño free: 25 MB. Cortar archivos no elimina la cuota de audio. Las respuestas 429 pueden incluir retry-after.

## Flujo recomendado

1. Leer metadata del link con yt-dlp sin descargar todo. `is_live`, `live_status`, `was_live` y duración distinguen emisiones actuales, archivo de directo y video largo; manejar metadata faltante. La duración dispara el flujo largo aunque no haya indicador de directo.
2. Preguntar en el composer: intervalo, capítulos o archivo completo. Recomendar empezar por 15–30 min o capítulos elegidos. Un intervalo de ejemplo es una opción, no una selección silenciosa del usuario.
3. Extraer audio local mono 16 kHz FLAC. Crear tramos de 5–10 min con solapamiento corto (1–2 s) y comprobar el tamaño antes de enviar; subdividir si excede el máximo. Conservar mapa de tiempos al original.
4. Persistir manifest por hash del original, modelo e idioma: intervalo solicitado, tramo, estado, intentos, resultado y timestamps absolutos. Al reabrir, reanudar pendientes sin volver a gastar en tramos terminados. Cambiar modelo/idioma invalida sólo ese resultado.
5. Una cola por organización: presupuesto de audio/hora/día conservador y límites reales, concurrencia reducida, backoff y retry-after. Si se agota, mostrar pausa y hora estimada; la estimación local no sustituye cuota real. No cambiar de cuenta o proveedor silenciosamente.
6. Unir resultados y deduplicar palabras del solapamiento por timestamps; no eliminar repeticiones legítimas. Emitir candidatos de clips progresivamente mientras sigue la transcripción.
7. Opcional: detectar silencios para omitir intervalos sin voz, conservando mapa temporal. Revisar ruido/música y no confundir poca energía con silencio. No es sustituto de transcribir palabras.

## Dos cuentas y opción local

Dos API keys de una misma organización comparten cuota. Dos organizaciones pueden tener límites distintos; no se comprobó elegibilidad ni se configuraron cuentas adicionales. No diseñar el producto alrededor de multiplicar cuotas gratuitas. Permitir selección explícita de una cuenta autorizada y su cuota, con identidad visible, si se implementa multi-cuenta.

Whisper local puede usar modelos grandes y turbo oficiales (https://github.com/openai/whisper); local no significa obligatoriamente menor calidad. Modelo, decodificación, idioma y recursos cambian calidad/velocidad. Comparar un intervalo de este usuario antes de recomendar hardware o descargar pesos grandes. Una estrategia híbrida de búsqueda local + Groq en clips elegidos es propuesta, no soporte validado.

Un VOD de 12 h de voz excede la cuota diaria genérica de 8 h: reducir el intervalo, repartir la cola entre ventanas de cuota, usar una capacidad local aprobada o un plan mayor seleccionado expresamente. No prometer que chunking lo resuelve.

## Pruebas necesarias antes de integrar

Metadata VOD/live/no duración y validación de rangos ya tienen pruebas locales; una descarga pública breve, reapertura y edición se probaron de verdad. Para la futura cola de transcripción faltan: fronteras de palabras entre tramos; reconexión y reinicio; 429 real o fixture aislado; archivo de más de 25 MB; cancelación sin perder completados; timestamps después de omitir silencio; cuenta y modelo visibles. Esa cola todavía no está implementada.
