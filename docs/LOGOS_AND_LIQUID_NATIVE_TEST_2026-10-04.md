# Biblioteca de logos y prueba editorial nativa — 04/10/2026

## Colección personal encontrada

La carpeta indicada por Sikora sí existe:

`D:\Syka Media\02 🎬 Biblioteca de edición\_Importado desde Syka Scratch 2026-08-14\Biblioteca de edición\Logos para videos\LobeHub`

Contiene 141 SVG, 53 Markdown, un manifiesto JSON y un JPG. El manifiesto registra 52 marcas solicitadas, descargas y variantes faltantes: es una selección previa de LobeHub, no todo su catálogo. Sus rutas históricas mencionan Syka Scratch en F y un espejo de El Mago en `C:\Coding\Syka Beginning\Marca Personal`. Se buscó también en esas ubicaciones. La colección original no se movió ni se incorporó como biblioteca privada a una distribución pública.

Ambas carpetas personales originales siguen conectadas. La búsqueda anterior con Supabase 0 consultaba esas carpetas; no demostraba ausencia en todos los discos. El inventario actual de D:\Syka Media examinó 6.822 archivos. Las búsquedas adicionales de D/F tuvieron exclusiones y errores de acceso en directorios de sistema, documentados en el runtime: no deben describirse como acceso exhaustivo a todo el disco.

## Catálogo público incluido

- SVGL: commit `ecb9adaafe41c578742e94fce90e6cc03c48a574`, repositorio https://github.com/pheralb/svgl.
- LobeHub: `@lobehub/icons-static-svg@1.95.1`, repositorio https://github.com/lobehub/lobe-icons. Verificado el SHA-512 del tarball contra la integridad publicada por npm. La licencia MIT se recuperó del commit `82e641b4fece9d1028a127149af9ded00df5ac0c`.
- 2.052 archivos SVG, 948 nombres de marca normalizados sin distinguir mayúsculas, 5.686.359 bytes. Son nombres del catálogo, no una auditoría de 948 compañías independientes. Hay 2.045 hashes distintos antes de combinar con las carpetas personales.
- Los 2.052 hashes coinciden con sus SVG; no se modificaron símbolos, colores ni geometrías. Dos archivos SVGL (`litecoin.svg`, `googleMaps.svg`) se excluyeron por el validador pasivo actual.
- `docs/resources/logos/catalog.json` conserva variante, tema, categoría, origen público, ruta original y hash. `NOTICE.md` y las dos licencias acompañan los recursos. No se ejecutó TypeScript descargado: el script de preparación acepta datos literales.

El catálogo es offline y portátil. La UI y `syka_resources` usan la misma biblioteca; la configuración personal almacena sólo las carpetas del usuario. Los SVG personales idénticos tienen prioridad; se filtra por nombre antes de deduplicar y se aceptan nombres como Hugging Face / hugging-face. Las variantes se copian al proyecto al importarlas. La carpeta incluida no muestra «Desconectar»; las personales conservan ese control.

La app reabierta devolvió Supabase 3 variantes, Vercel 6, Hugging Face 4 y Claude 9 sin advertencias. Las tres variantes de Supabase se previsualizaron por IPC. Total combinado local: 2.083 SVG distintos, con tres raíces (dos personales y la incluida). Esto no es el total que verá una instalación limpia, que no tiene las carpetas de Sikora.

## Edición real aislada

Proyecto: `projects/Prueba Liquid y logos - 2026-10-04`, chat `Prueba Liquid · logos, captions y audio`, modelo `gpt-6.1-sol`, esfuerzo `xhigh`, modo rápido apagado.

Se copiaron el footage original de 11,35 s, dos transcripciones existentes, la skill privada `edicion-liquid`, un ejemplo de estilo y cinco frames del ensayo que Sikora prefirió. Watch analizó esa referencia localmente, sin transcripción ni subida. La skill privada sirve como referencia de diseño y proceso; no se convirtió en una base pública ni se usó su render HyperFrames. El plan añade un cierre gráfico intencional hasta 15 s para probar los logos, conservando toda la voz.

El agente buscó, eligió e importó Supabase y Vercel con `copy:true`. Verificación independiente: los hashes de `supabase_wordmark_dark.svg` y `vercel_wordmark_dark.svg` copiados coinciden con el catálogo. Los logos aparecen en un cierre identificado como demostración de biblioteca, no como marcas supuestamente nombradas en la voz.

La composición es Diffusion/Solid: footage, captions, SVG y audio nativos; tarjetas/diagrama HTML editables en fuente y animación desde el reloj de escena. No hay un MP4 renderizado por HyperFrames reimportado. Los nodos de composición no se admiten dentro de HTML: el primer montaje puso keyframes allí, falló y el agente lo corrigió envolviendo HTML en un grupo nativo. Capturas posteriores mostraron cara libre, diagrama y captions separados y logos originales legibles. La refracción óptica de la referencia privada no se declara idéntica a la aproximación nativa.

Entrega verificada: `04 Entregables/liquid-native.mp4`, export completo por Diffusion, H.264/AAC 128 kb/s, 1920×1080/60, 900 cuadros y 15,000 s de video; contenedor de 15,0187 s por padding AAC. Se decodificaron los 900 cuadros sin cuadros completamente negros. Holds y transiciones del MP4 revisados; seek de ida/vuelta devolvió tres imágenes idénticas. Mezcla con pico real −7,6 dBTP, −19,4 LUFS, sin muestras recortadas; ambient unos 20,3 dB debajo de la voz. Correlación de señal de voz 0,99853 y presencia medida de ambos acentos. Estas mediciones no equivalen a escucha humana. `04 Entregables/INFORME.md` y `QA/export-verificado.json` contienen la evidencia.

El primer export expuso un bloqueo: el rechazo de AAC 256 kb/s podía dejar el worklet offline esperando muestras, consumiendo CPU y afectando el siguiente export. Se recuperó sólo el renderer, conservando host y archivos. El core ahora verifica `canEncodeAudio` antes de crear el worklet y libera contador, puertos, nodos y output al fallar/cancelar. Prueba real: rechazo de 256 inmediato, export nativo de un segundo con voz a 128 exitoso, luego export completo de 15 s con video y mezcla nativa exitoso. No se combinó externamente el MP4 con audio mediante FFmpeg. Las opciones del usuario no se sustituyen silenciosamente: una configuración no admitida devuelve un error concreto.

## Verificación técnica

120 tests de agent-chat y 168 de escritorio pasaron. TypeScript de web, encoder, agent-chat y escritorio y build del host/escritorio pasaron. Se añadió al check del encoder la declaración File System Access ya usada por web: su check aislado antes fallaba en `Window.showSaveFilePicker` de assets. El build web final de producción pasó con avisos preexistentes de directivas `use client` y tamaño de chunks. `stage:docs` incorpora el catálogo público y sus licencias; no se construyó un instalador ni se publicó el proyecto.

UI real de Biblioteca: Supabase devuelve tres tarjetas con las variantes correctas, imágenes cargadas y fondos de contraste por tema. Dos botones Desconectar sólo para las carpetas personales, y «Logos incluidos» visible. Se corrigió el padding del nombre al incorporar una segunda línea de metadatos y el cursor de los recursos que se insertan por clic. El hash de la composición no cambió durante esta prueba. Evidencia: `ui-results.json` y `library-supabase.png` en el runtime del catálogo.

Evidencia local: `.runtime/logos-catalog-2026-10-04/verification.json`, `live-catalog.json`, `media-logo-files.json`; `.runtime/liquid-native-test-2026-10-04/production.json`, `logo-copy-verification.json` y capturas del propio proyecto.

## Mejora siguiente de recetas

Conservar una base genérica de montaje/sincronía/recursos/revisión y separar la elección de estilo por proyecto. Una receta útil necesita referencia concreta con tiempos, diseño resuelto para los estados de máxima información, componentes editables, ejemplos de qué evitar y decisiones de voz/música/captions. Registrar observación → corrección → evidencia permite mejorar el siguiente intento sin convertir cada preferencia inferida en una regla. Sólo un resultado aprobado por el usuario se vuelve una skill personal permanente; no se guardó esta prueba como estilo aprobado.
