# Quitar fondo y separar capas: entrega local

Se integró el procesamiento de HyperFrames 0.8.140 con ONNX Runtime 1.21.1 y u2net_human_seg. El inspector permite procesar, cancelar, revisar y aplicar el resultado. El agente dispone de `syka_remove_background` con trabajos persistentes. No se probó un turno real nuevo de Codex solicitando esta herramienta.

## Validación

- 22 pruebas automatizadas de recorte y herramientas del workspace; typechecks web, escritorio y agent-chat y build desktop.
- Video real del usuario: tramo de dos segundos, sujeto transparente, voz original independiente, un deshacer/rehacer, reapertura y export nativo 1080×1920. Se inspeccionó un fotograma del MP4 exportado.
- Separación real de video en dos secuencias PNG sincronizadas y una única pista de audio, guardadas y reabiertas.
- Retrato real: sujeto y fondo en dos imágenes, un deshacer/rehacer y reapertura.
- Los proyectos 17 y 18 se registraron y reabrieron en la aplicación principal. El canal IPC principal recuperó un trabajo terminado.

Evidencia: `output/background-removal/verification.json`, `layers-verification.json`, `main-verification.json` y sus capturas. El MP4 `../Pruebas Syka/17-recorte-personas-v2/exports/recorte.mp4` corresponde a la prueba de sujeto sobre fondo verde; el proyecto guardado actualmente contiene las dos capas separadas.

## Límites

Segmentación de personas, no recorte universal de productos. Los bordes del pelo, manos y movimientos rápidos requieren revisión. El fondo tiene un hueco transparente: no reconstruye lo que había detrás. Máximo 30 segundos por trabajo de video. Las secuencias PNG requieren más disco y conservan el alpha que WebCodecs pierde al decodificar VP9. La primera ejecución descarga el modelo, después el procesamiento es local. Pruebas realizadas en Windows con CPU; empaquetado y ejecución en Mac no validados en esta entrega.

Guía: `guides/background-removal.md`. Fuente primaria: https://github.com/heygen-com/hyperframes/blob/main/docs/guides/remove-background.mdx
