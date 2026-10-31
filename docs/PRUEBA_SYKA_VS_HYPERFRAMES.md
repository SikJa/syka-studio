# Prueba: Syka Studio vs HyperFrames Studio

Objetivo: medir el nivel actual de Syka contra HyperFrames con **el mismo pedido, el mismo motor, el mismo modelo y el mismo esfuerzo**, en un proyecto nuevo y vacío en cada app.

## Por qué es comparable

HyperFrames Studio no trae un modelo propio: corre los mismos CLIs oficiales que Syka (Codex, Claude Code, Antigravity, OpenCode). Con Codex, cada app usa su propia carpeta de datos: Syka usa `E:\Syka Studio\Datos\codex-runtime` y HyperFrames usa `~/.codex`. En los dos casos quedan las sesiones con el conteo de tokens, así que se pueden medir sin depender de lo que muestre cada interfaz.

Diferencia de fondo: HyperFrames escribe composiciones HTML y GSAP; Syka escribe JSX nativo para su motor. Se compara el resultado visible, no el código.

## Configuración

| | Valor |
|---|---|
| Motor y modelo | El mismo en las dos apps, por ejemplo **Codex · gpt-5.6-terra · esfuerzo alto** |
| Proyecto | Nuevo y vacío en cada app, sin brand kit ni recursos personales |
| Adjuntos | Ninguno (o exactamente el mismo archivo en las dos) |
| Respuestas a preguntas | Si la app pregunta, responder siempre **"Decidí vos"** |
| Correcciones | Ninguna durante la prueba; se evalúa la primera entrega |
| Tiempo máximo | 30 minutos por app |

## Pedido (copiar tal cual en las dos)

El pedido lo elige la persona, por ejemplo de [prompt-motion.com](https://prompt-motion.com/) o [motionvideo.xyz](https://motionvideo.xyz/es). Lo importante es pegar **exactamente el mismo texto** en las dos apps y guardarlo junto a los resultados. Si el prompt de esas páginas trae un video de referencia, se adjunta el mismo archivo en las dos o en ninguna. Un ejemplo, por si hace falta:

> Creá un video vertical 1080×1920 de 15 segundos que presente una app ficticia llamada "Pulso", un tracker de hábitos. Estructura: gancho con el nombre y una frase fuerte (0–3 s), tres beneficios con iconos animados (3–11 s) y cierre con el logo y "Descargala hoy" (11–15 s). Estilo moderno, oscuro, con un color de acento verde lima. Animaciones fluidas y transiciones entre escenas. Incluí música de fondo y efectos de sonido sutiles en las transiciones. Textos en español.

Cubre texto, motion, transiciones, iconos, color, audio y timing, que son las cosas que las dos apps dicen saber hacer.

## Qué se mide

| Medida | Cómo |
|---|---|
| Tiempo hasta la primera respuesta y tiempo total | Registro de cada app |
| Tokens de entrada (con y sin caché) y de salida | Sesiones de Codex de cada app |
| Preguntas que hizo y pasos de investigación | Registro de la conversación |
| Errores, reintentos y si terminó sin ayuda | Registro de la conversación |
| Cumplimiento del pedido | Duración, formato, las 3 escenas, el texto exacto, el verde lima, música y efectos |
| Calidad visual | Capturas en 0,5 s / 2 s / 5 s / 8 s / 11 s / 14 s, puntaje de 1 a 5 en composición, tipografía, motion y pulido |
| Audio | Hay música, efectos en las transiciones, volumen equilibrado |

## Cómo correrla

1. En **Syka**: Inicio → elegir Codex · gpt-5.6-terra · alto → pegar el pedido → enviar. No tocar nada hasta que termine.
2. En **HyperFrames Studio**: proyecto nuevo → mismo motor, modelo y esfuerzo → pegar el pedido → enviar → responder "Decidí vos" si pregunta.
3. Anotar la hora de inicio de cada una.
4. Avisarme. Leo los registros y las sesiones, tomo las capturas de las dos entregas y armo el informe comparativo.
