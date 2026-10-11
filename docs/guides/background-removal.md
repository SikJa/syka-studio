# Quitar fondo y separar capas

Seleccioná una imagen o un video. En Propiedades → Básico → Appearance,
abrí **Quitar fondo**. Elegí **Quitar fondo** o **Separar capas**, esperá el
procesamiento y compará el original con el recorte. **Aplicar recorte** cambia
el recurso del elemento; **Aplicar dos capas** crea sujeto y fondo superpuestos.
Ambas acciones conservan el original y comparten un paso de Deshacer/Rehacer.
Las secuencias de clips requieren mover el clip a un contenedor superpuesto antes
de separar capas. No se toca automáticamente un contenedor incompatible.

El motor es `hyperframes@0.8.140`, con `u2net_human_seg` y ONNX local. La primera
vez descarga aproximadamente 168 MB de pesos; las siguientes reutilizan la caché.
No sube medios, no usa una API ni la suscripción del agente. En CPU puede demorar.
Sólo para personas: no es un removedor universal de productos, animales o logos.
Revisá pelo, manos, fondos complejos y movimientos rápidos antes de aprobarlo.

Los videos se procesan sólo en el tramo fuente que reproduce el clip, máximo
30 segundos por trabajo, hasta 4K y 120 fps. Para un directo dividí o recortá
primero. El archivo original no se sobrescribe ni se elimina.

Los resultados quedan dentro de `assets/Recortes/<id>/`. PNG para retratos;
WebM transparente y secuencias PNG para video. Diffusion utiliza las secuencias
para conservar alpha en preview y exportación, porque su decodificador WebCodecs
descarta alpha de VP9. Se respeta la tasa original mediante `frameRate`; el audio
original queda en una única pista independiente con el mismo trim y ritmo.
Las secuencias requieren más espacio que un video comprimido.

Separar capas crea un fondo con un hueco transparente donde estaba la persona.
**No reconstruye lo oculto**. Poné una escena opaca debajo y textos/motions entre
fondo y sujeto. No prometas un fondo limpio o bordes de calidad VFX.

Los estados finales del trabajo se guardan en `.syka/background-removal/` dentro
del proyecto. Si Syka se cierra durante el proceso, al reabrir informa interrupción;
el original permanece intacto y podés iniciar otro. No se reinicia a escondidas.

## Desde el chat

`syka_remove_background` está en las herramientas locales del agente:

```json
{"action":"start","source":"assets/persona.mp4","start":2,"end":6,"separate":true,"quality":"best"}
```

Consultá `{"action":"status","id":"<id devuelto>"}` hasta `done` o error;
`cancel` permite detenerlo. Los paths del resultado son relativos al proyecto.
Importá `subjectFrames` y `backgroundFrames` con `assets`, usá `frameRate` del
resultado y ajustá `sourceIn` a 0. Conservá la ubicación temporal del clip y su
audio fuente con el trim original. Para un retrato usá `subject`/`background` PNG.
Antes de modificar el JSX leé el estado actual; aplicá con el historial normal.

Instalación local de desarrollo: `npm run setup:background`. Los instaladores
incluyen el worker y las dependencias nativas mediante `stage:runtime`; el modelo
se descarga al primer uso. Un fallo de instalación se muestra como error real.

Fuentes: [implementación y guía de HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/docs/guides/remove-background.mdx),
[modelo rembg](https://github.com/danielgatis/rembg).
