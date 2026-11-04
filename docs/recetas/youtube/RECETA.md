# Receta de fábrica: video de YouTube

Edita una grabación de una persona hablando en un video de YouTube: recortes,
ritmo, b-roll, títulos de capítulo y subtítulos.

Se usa con `syka_receta action:usar slug:youtube`. `syka_plan` lleva el video:

1. **Brief**: la idea, el público, qué se recorta, cuánto gráfico y la música.
2. **Material**: el video fuente y su transcripción real (`media_transcribe`).
   Las escenas salen de lo que se dice, con sus tiempos.
3. **Escenas**: gancho, intro, un bloque por idea y cierre, con sus planos
   (plano medio o primer plano), los gráficos y el b-roll.
4. **Construir y gate**.

Acá los cortes secos están permitidos: son parte del ritmo de un video
hablado. Las reglas completas están en `receta.json`.
