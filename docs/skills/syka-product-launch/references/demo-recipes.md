# Recetas nativas de demostración

Los componentes incluidos son implementación original de Syka. La coreografía
se inspira en el catálogo de planos de Abubakr y las recetas de Charlie; no llevan
UI, música, fotografías ni código de sus films de ejemplo.

Copiá `ProductDemo.tsx`, `ProductFocus.tsx`, `LaunchCover.tsx` y `launch-time.ts`
desde examples/ a components/. Importá el componente necesario con su default.
Todas las posiciones/tamaños están en píxeles de composición; start/end son
segundos absolutos. Los helpers son puros y se recalculan al hacer seek.

## ProductDemo: acción y cambio de estado

Props: id,start,end,beforeSrc,afterSrc,action,result; opcionales x,y,width,height,
revealAt,accent,reducedMotion. beforeSrc/afterSrc son URLs locales que la preview
puede cargar, resueltas desde assets ya copiados al proyecto. No enviar rutas
personales del desarrollador ni depender de capturas remotas.

- **Búsqueda → resultados:** antes con query visible, después con resultados;
  action describe la búsqueda y result describe lo encontrado.
- **Acción → preview:** antes con el pedido, después con la imagen o pieza lista.
- **Tarjeta → editor:** antes con la idea/proyecto, después con el workspace real.
- **Tabs → paneles:** mismo encuadre y ventana; cambia el panel útil.

No todas necesitan una transición igual: adaptar revelado, cámara y continuidad a
la historia. `revealAt` es relativo al start y coincide con el evento real del plan.
El rótulo explica una acción ya verificada; no simula una función inexistente.
El cuadro inicial ya muestra el estado anterior. Los resultados se sostienen para
leer. Si hace falta corregir solo una palabra como Source independiente, poné esa
capa fuera del html del componente.

## ProductFocus: señalar el componente preciso

Props: id,start,end,label,target:{x,y,width,height}; opcionales x,y,width,height,
accent,reducedMotion. target se mide en coordenadas locales de esta capa, después
de contemplar escala/recorte de la captura. El marco y cursor se colocan sobre el
control indicado; el cursor llega y realiza una pulsación breve. El marco permanece
estable en lectura. El callout no sigue por sí solo un control que cambia de lugar:
recalcular target o animarlo desde la geometría real.

Combinar con una captura real en otra capa. Para un acercamiento de cámara,
transformar captura y overlay dentro del mismo grupo y conservar transform-origin.

## LaunchCover: portada, cierre o clip de identidad

Props: id,start,end,title,subtitle; opcionales brand,logoSrc,x,y,width,height,accent,
ambient,reducedMotion. title/subtitle quedan quietos; ambient mueve solo la luz
de fondo desde el reloj. El frame inicial ya está compuesto. No promete un loop
automático: para un loop elegido, verificar la costura con duración y cadencia
compatibles. El CTA tiene que reflejar disponibilidad real del producto.

## Revisar

Verificar carga de assets/fuentes, bounds de control y layout de cada destino.
Avanzar y retroceder al mismo instante devuelve el mismo estado. reducedMotion
presenta el resultado legible, sin cursor/actividad repetitiva. Los textos son
props editables, no texto quemado dentro del video de referencia. Estas recetas
no importan ni exportan medios solas.
