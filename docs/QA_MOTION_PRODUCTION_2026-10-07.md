# Motion de Syka: producción y revisión integradas

Fecha local: 2026-10-07. Pedido: profundizar el artículo de seeco e incorporar
reglas/referencias útiles a Syka Studio, manteniendo Diffusion y el entorno existente.
Cambios locales; sin publicación, instalación de librerías ni cambio de proveedor.

## Resultado implementado

Las instrucciones compartidas del host dirigen pedidos de motion amplio a
`syka-visual-direction/references/motion-production.md` y
`syka-edit-review/references/motion-evidence.md`. Las skills de referencias,
transiciones y la plantilla `frame.md` enlazan este flujo. Un ajuste pequeño
conserva revisión proporcional y no inicia todo el recorrido.

Reglas añadidas o reforzadas: lectura por beat, estados de entrada/salida,
ancla persistente, causa/respuesta, preparación del foco, holds, cierre,
conducta por tipo de objeto, continuidad en costuras, semillas por elemento,
audio sobre reloj real de composición cuando existe, adaptación de layout por
formato y conservación de decisiones/componentes útiles en la receta.
No se impuso una paleta, familia, dos fuentes, movimiento perpetuo, prohibición
universal de cortes/fades, autoscore objetivo ni seis nuevas aprobaciones.

Nueva herramienta del agente: `syka_motion_review`, disponible en los
WorkspaceTools de Codex y el puente MCP usado por otros harnesses. Lee un
export local del proyecto (hasta 180 s), usa FFmpeg/FFprobe configurados y crea:

- Contact sheets temporales, cerca de 2 muestras/s; máximo 120, incluido final.
- Burst de 12 cuadros decodificados consecutivos alrededor de `focusTime` elegido.
- Holds de lectura a 360 px de ancho conservando aspecto; etiquetas fuera de la imagen.
- Manifest con índices, timestamps reales, streams, hash del video y snapshot
  limitado de fuente. Reporte de revisión inicialmente pendiente.

Entrega hasta seis PNGs originales acotados al proveedor para visión y conserva
rutas de toda la evidencia. Los tool results de Codex retienen esas previews;
el puente MCP devuelve bloques de imagen. El chat terminado oculta actividad
de herramientas por diseño: el resultado al usuario presenta antes/después,
enlaces y límites, sin pared de logs. No cambiamos esa presentación global.

La herramienta preserva el video y no renderiza otra composición. Cada llamada
escribe una carpeta UUID nueva en `reviews/`; valida entrada y salida canónicas
del proyecto antes de escribir, no acepta URLs ni ejecuta shell. No mide gusto,
no detecta automáticamente la transición más rápida, no escucha sonido y no
certifica cuál fuente produjo un export viejo. Repetir decode tampoco prueba
determinismo del motor. Esos límites están explícitos en herramienta/skills.

## Investigación y decisiones de adaptación

| Fuente primaria leída | Evidencia y uso | Límite |
| --- | --- | --- |
| [Artículo de seeco](https://x.com/i/article/2106091215502422016), [post](https://x.com/seeconvm/status/2106096193235259564) | Leí las ocho secciones y todos los bloques embebidos desde [FXTwitter público](https://api.fxtwitter.com/seeconvm/status/2106096193235259564). Orientó la revisión y persistencia de decisiones. | X directo/sesión dieron 403 en consulta anterior. Sin reautenticar ni cambiar cuentas. Anécdotas de modelos, views y costos no se verificaron como benchmarks. No se redistribuyó el artículo. |
| [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase/blob/0ac8bf2b31942376cb6b8c4074715595d512acd2/ANIMATION_GUIDE.md) | Guía de lectura, preparación del foco, anticipación, follow-through, continuidad y revisión en distintas escalas. También inspeccioné core.js. MIT, commit fijado. | No se incorporaron código, personaje, assets, p5.brush, prohibición de texto, boil ni cámara permanente. |
| [PDoomVideo](https://github.com/JohnHeibel/PDoomVideo/tree/fa546a38092e75f2b079e6a86d6abc54dd525d17) | README, ANIMATION_GUIDE y secciones del STORYBOARD: consulta de plan global, motivos y continuidad entre capítulos. | Sin licencia declarada en GitHub al consultar. No copiamos código/guía/canción. No activamos sus subagentes ni su renderer. |
| [Anime.js springs](https://animejs.com/documentation/easings/spring/), [Remotion spring](https://www.remotion.dev/docs/spring) | Contraste técnico para elegir curvas y distinguir masa/settle de movimiento lineal. El contrato que enseñamos es el JSX de Diffusion existente. | El motor ya tiene springs de segmento. No agregamos un solver acumulativo ni fingimos continuidad de velocidad entre todos los segmentos. |
| [FFmpeg tile](https://ffmpeg.org/ffmpeg-filters.html#tile) | Referencia de extracción y composición de evidencia; implementación propia con los binarios locales. | Decodifica el export, no sustituye el render nativo. |
| [What Ships](https://whatships.com/) | Confirmado como directorio opcional de lanzamientos; enlazado para investigar según el brief. | No se descargó su catálogo ni se afirmó haber analizado sus videos. |

La consulta adicional de Material Design no devolvió texto utilizable; no se
tomó como evidencia. Agent Reach doctor confirmó rutas disponibles; la revisión
de actualización indicó que v1.5.0 está al día. Sin nuevas instalaciones.

## Prueba real y mejora observable

Proyecto independiente:
`F:\Coding Proyects\Syka Clips\Pruebas Syka\QA-motion-review-2026-10-07`

Se copió la composición propia anterior preservando textos, Inter, paleta,
tarjeta/mint, softRise, tres beats, duración y export. Una escena, seis textos
y dos rectángulos nativos editables, sin HTML ni video reemplazando la fuente.

El host real, privado, inició una sesión oficial Codex con `gpt-6.1-sol`,
esfuerzo `medium`, verificados en harnesses.list y solicitud registrada.
La prueba no usó un modelo alternativo ni subagentes. El agente leyó las
skills/soportes nuevos y ejecutó `syka_motion_review` dos veces, recibió cinco
previews por llamada y abrió todas las imágenes, incluida la segunda contact sheet.

Defectos/correcciones observadas:

1. Apoyo pequeño en holds a 360 px: 38 → 48 px, mismas cajas/copy/color/peso.
2. Desfase final: texto terminaba en 9.75 s mientras la tarjeta salía hasta
   10 s. Alineó ambas salidas a 10 s. Comparó cuadros del cierre para justificar
   la corrección; el último cuadro sigue casi vacío por la salida deliberada.

El burst elegido de 3.5 a 3.683333 s no mostró solape/pop; conservó esa entrada.
La corrección mejora la muestra; no garantiza que 48 px sirva para todos los
canales o que el usuario prefiera este diseño. No se hizo una nueva pieza de
lanzamiento ni se cambió la identidad general de Syka.

Exports del agente:

- `02 Finales/review-before.mp4`: 2,923,614 bytes.
- `02 Finales/review-after.mp4`: 3,179,208 bytes.

Ambos: 10 s, 1920×1080, 60/1 fps, 600 cuadros, sin audio. FFprobe, hashes y
decode completo de ambos verificados independientemente. Fuente/export y
defectos: `qa-evidence/review-cycle.json`; verificación adicional:
`qa-evidence/independent-export.json`.

Seek real de UI: 3.6 → 1.2 → 5.6667 → 2.5667 → 3.6 s. Comparación de píxeles
del mismo canvas tras retroceder: idénticos. Reapertura y check de la escena
sin issues. Player nativo a 1× recorrió los tres beats y llegó a 10 s;
capturas tomadas durante playback, no inspección visual de cada uno de sus
600 cuadros. No se evaluó audio porque el brief es silencioso.

Evidencia:

- `qa-evidence/phone-before-after.png`: tres holds del export, antes/después,
  contenido conservado a 360 px por columna.
- `reviews/motion-57f8da90-78c4-4bdf-947f-410311cadbf3/manifest.json`: antes.
- `reviews/motion-535cf4d4-1ecd-4386-97db-a5d700f7a46c/manifest.json`: después.
- `qa-evidence/independent/`: seek, canvas, final decodificado y reapertura.
- `qa-evidence/live-playback/ui-review.json`: playback y entrega en chat real.
- `qa-evidence/live-playback/native-review-chat.png`: conversación visible
  con resultado/enlaces locales; logs técnicos ocultos en conversación terminada.
- Repo `docs/references/prompt-motion/evidence/motion-review-integration.json`
  y `motion-review-verification.json`: modelo, tool calls y verificación.

## Validación técnica y estado de entrega

- 22 tests pasaron: evidencia de timestamps VFR/bordes, 24 fps real, PNG360,
  preservación del video, previews acotadas, junction fuera del proyecto,
  descubrimiento de skills y routing existente.
- TypeScript de agent-chat y desktop pasó.
- Build del host privado y `apps/desktop/dist/agent-host.mjs` pasó.
- El bundle local del host queda preparado para el próximo inicio. La instancia
  compartida no fue reiniciada, ni se interrumpieron sus chats/proyectos.
- Las skills/soportes están bajo los árboles públicos existentes que distribuye
  stage-docs. No se ejecutó un reemplazo global de staging ni se generó un instalador.
- Los exports y evidencia son locales. No se subieron nuevos archivos a Drive.
  Aprobación estética pendiente; validación técnica y revisión propia no la sustituyen.

## Archivos y reversibilidad

Implementación: `packages/agent-chat/src/host/motion-review.ts`, registro en
workspace-tools, entorno/imagen en codex y editor-tool-bridge, routing en
editorial-instructions. Tests: `test/motion-review.test.ts`.
Docs: INSTRUCTIONS, cuatro skills existentes, frame-template y dos soportes nuevos.
QA: scripts `qa-motion-review*.mjs`, sólo instancia/proyecto privados.

Backup anterior de archivos tocados y host compilado:
`C:\Users\Sikora\AppData\Local\Temp\syka-motion-review-20261007-224948`.
Para revertir, comparar/restaurar sólo esos archivos y retirar los nuevos
soportes/tool/test de esta tarea; no resetear el repo, que contiene mucho trabajo
ajeno previo. No hay commit ni push. No se editaron memorias globales.
