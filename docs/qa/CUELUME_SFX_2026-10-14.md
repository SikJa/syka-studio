# Cuelume SFX · integración local · 2026-10-14

La documentación y el repo de Cuelume describen sonidos de interacción
sintetizados con Web Audio, no una descarga de samples. Se reutilizó su renderer
offline oficial MIT, fijado a `2a1ba4fc1b67e8371c9f37e37a51e61353166335`, versión
0.2.8. `vercel-labs/fx` es un agente de código que usa sonidos derivados de
Cuelume para avisos; no se instaló ni se cambió el arnés de Syka.

## Resultado

- 168 WAV (14 cues × 4 materiales × 3 arreglos): PCM 16-bit, 48 kHz, estéreo.
- 26.545.888 bytes nuevos, 25,32 MiB. No es una medición de tamaño del instalador.
- Los 434 recursos previos permanecen: catálogo total 602, 86,11 MiB.
- Búsqueda por `Cuelume` o `Cuelume press`, con familia de audio, ataque/brillo
  medidos, duración, cue point, material, intensidad, licencia y SHA-256.
- Uso mediante assets `copy:true` y audio nativo editable, sin un motor de
  sonido adicional en la UI ni eventos HTML para el audio del video.
- MIT completo en cada WAV (INFO/ICMT), notice separado, procedencia/hash,
  créditos del producto e inventario de licencias de distribución.
- Referencia nueva en syka-local-audio y enlace desde syka-media-use. Se conservan
  las 28 skills existentes, sin instalar skills personales ni autenticaciones.

## Verificación realizada

- 31 pruebas en 5 archivos: búsqueda real mediante WorkspaceTools, filtros,
  preview, bundle reubicado, derechos/procedencia corruptos y biblioteca nativa.
- El import del WAV usa el probe real de Syka/Mediabunny, sin mock del audio.
  La prueba copia bytes exactos, desconecta el original y reabre el asset;
  conserva el notice dentro del archivo. El filesystem de esa prueba es una
  fixture aislada; no se editó el proyecto abierto del usuario.
- Typecheck de agent-chat y assets: ambos pasaron.
- FFprobe reconoce PCM 16-bit/48 kHz/2 canales y el notice en metadata;
  FFmpeg decodifica un cue fuerte sin error.
- stage-docs verifica los 602 sonidos, hashes y licencias en el árbol preparado
  para distribución. Catálogo fuente y staged idénticos; 28 skills con hashes
  correctos; Cuelume figura como material de audio MIT en inventory.json.
- Muestra audible local de 16 s: tap/open/success de default, mech, bubble y
  press, a ganancia nativa 0 dB, sin alterar los assets incluidos. Cue sheet en
  output/cuelume-20261014/cues.json. Es una audición de archivos, no un export de
  un proyecto nativo ni una aprobación estética por un modelo.

No se generó instalador, se ejecutó una sesión de modelo ni se modificó el
proyecto abierto. La reproducción estética se evalúa escuchando la muestra o
la mezcla del edit real. Los WAV congelan la variación/cadencia de la síntesis
en vivo; el preset count no se adapta automáticamente a cualquier duración.
