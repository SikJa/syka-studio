# Cuelume como SFX editable del video

Syka incluye 168 WAV: los 14 cues de Cuelume 0.2.8 en cuatro materiales y tres
arreglos de intensidad. Se renderizaron con el script offline oficial y sus
recetas MIT, fijados al commit `2a1ba4fc1b67e8371c9f37e37a51e61353166335`.
No requieren Internet, npm ni un AudioContext adicional para usarlos en un edit.

## Elegir por acción

| Evento del video | Cue | Familia de biblioteca |
|---|---|---|
| Botón, contacto o envío | tap | tap |
| Escritura ilustrada | type | click |
| Elegir una opción | select | click |
| Activar/desactivar | toggle | switch |
| Abrir/cerrar un panel | open / close | open-close |
| Cambiar de pantalla | navigate | whoosh |
| Confirmación real | success | success |
| Error mostrado | error | error |
| Aviso mostrado | warning | notification |
| Inicio de trabajo | loading | notification |
| Resultado disponible | ready | notification |
| Pregunta o atención | attention | notification |
| Número animándose | count | texture |

Elegí una familia coherente: `default` es cálida (vidrio/madera/aire), `mech` es
seca y mecánica, `bubble` es orgánica/lúdica y `press` es una pulsación de hardware
con cuerpo grave. `subtle`, `normal` y `strong` cambian capas y envolventes; no son
tres copias con el volumen cambiado. En el resultado se identifican con `theme`
y `variant`. No mezcles las cuatro familias al azar dentro de una misma escena.

```json
{"action":"list","kind":"sounds","query":"Cuelume press","audioType":"sfx","audioFamily":"tap","limit":20}
```

Ese pedido a `syka_resources` devuelve las tres intensidades del toque press,
con ruta absoluta real, duración, licencia y `soundProfile`. Para ver todo,
buscá `query:"Cuelume"`, `limit:200`. También hay aliases en castellano, y los
filtros `brightness`/`attack` usan mediciones del WAV publicado.

## Llevarlo a la timeline

1. Escuchá el candidato y compará su carácter con la escena y la música.
2. Importá con la herramienta nativa `assets`:
   `{"action":"import","source":"<ruta devuelta>","folder":"Audio/Cuelume","copy":true}`.
3. Usá el `path`/`id` devuelto, sin inventar rutas ni vincular a la instalación:
   `<audio id="sfx-boton" name="Cuelume · Botón" src="<path>" start={cueSeconds} volume={-6} />`.
   El volumen nativo está en dB. −6 es un punto inicial para una prueba, no un
   nivel obligatorio ni una mezcla terminada.
4. Para un acento medido, calculá el inicio como
   `eventoSeconds - (cuePoint - sourceIn) / playbackRate`. No recortes el ataque
   para forzar un comienzo negativo: revisá ese primer evento por escucha.
5. Conservá el origen, cue, material, intensidad y licencia en el audio-plan.
   El notice MIT completo y la URL del commit viajan dentro de cada WAV como
   metadata INFO/ICMT; incluí también los créditos en entregas de assets.

La aplicación reproduce el WAV con su motor nativo, con volumen editable,
seek y export. No llames `cuelume.bind()` o `play()` desde un overlay HTML para
hacer el audio del video: producirían sonidos de interacción de esa página.

Son sonidos de UI sintetizados; no son música ni grabaciones de foley real.
Las variantes WAV están congeladas, sin el azar/cadencia de cada pulsación del
motor en vivo. `count` conserva su duración original de 800 ms de animación
más su cola; no se estira automáticamente a cualquier contador.
Conservá una sola confirmación por resultado y agrupá ráfagas de escritura.
Las microacciones siguen el brief `detailed`/`selective`/`none`, con jerarquía
y espacio para la voz. Esto no configura los sonidos de notificación de Syka.

Fuentes: [documentación](https://cuelume.dev/docs),
[recetas y renderer oficial](https://github.com/danielwh2/cuelume/tree/2a1ba4fc1b67e8371c9f37e37a51e61353166335),
[licencia MIT](https://github.com/danielwh2/cuelume/blob/2a1ba4fc1b67e8371c9f37e37a51e61353166335/LICENSE).
