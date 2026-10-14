# Política de licencias de Syka Studio

El código de este repositorio se publica bajo **[Mozilla Public License 2.0](LICENSE)**, salvo materiales que conservan una licencia específica. El texto original de `LICENSE` se mantiene intacto. Esta política explica el alcance y las excepciones; no reemplaza ninguna licencia.

## Código de Diffusion y cambios de Syka

La base es [diffusionstudio/editor](https://github.com/diffusionstudio/editor), commit `5310ff0324c186d78d3f8af8186fe57bf84d22be`. Sus autores y avisos siguen vigentes.

Si un archivo MPL cambia, el archivo modificado continúa bajo MPL. Un archivo nuevo que incorpora código MPL también queda cubierto: copiarlo, dividirlo, renombrarlo o moverlo a un paquete distinto no elimina esa obligación. Conservá los avisos de licencia, copyright y garantías.

Al distribuir binarios o código minificado, ofrecé el código fuente cubierto correspondiente e informá cómo obtenerlo. Las releases de Syka deben identificar su tag/commit y enlazar la fuente exacta. Estas condiciones vienen de [MPL §§1.10 y 3.1–3.4](https://www.mozilla.org/en-US/MPL/2.0/); Mozilla explica la distribución y el alcance por archivo en su [FAQ, Q8–Q11 y Q16](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Archivos independientes y desarrollo futuro

MPL permite combinar su código con archivos independientes bajo otras licencias. Que un módulo sea nuevo en Git, no tenga imports del motor o esté en otra carpeta no demuestra que sea original ni que se pueda cerrar.

En esta publicación, los archivos de Syka sin una excepción explícita siguen la licencia MPL del repositorio. La lista de candidatos en [Fronteras de licencias](docs/LICENSING_BOUNDARIES.md) es una propuesta de arquitectura, **no una reserva automática de módulos propietarios**.

Para ofrecer después una licencia distinta sobre código propio hay que comprobar todos los derechos y aportes involucrados. Los contribuidores conservan sus derechos: aceptar un PR bajo MPL no equivale a recibir una cesión ni permiso para relicenciarlo en términos propietarios. Las versiones ya distribuidas conservan los derechos que recibieron sus destinatarios. Cualquier licencia adicional debe respetar el código de terceros y las partes de Diffusion.

Una futura extensión cerrada debería usar una interfaz documentada y archivos independientes, con procedencia revisada. El adaptador que modifique archivos MPL seguirá siendo MPL. No se certifica aquí ningún candidato como exclusivamente propio.

## Excepciones identificadas

| Material | Licencia específica | Alcance |
| --- | --- | --- |
| BridgeClip | MIT | Presets originales y avisos conservados; integración del motor sujeta a MPL |
| Helper de captura de Whispera | MIT | `apps/desktop/native/screen-recorder`, incluidos los avisos de SikJa y Whispera contributors |
| HyperFrames y referencias copiadas | Apache-2.0 | Paquete y referencias públicas indicadas en su [aviso de procedencia](docs/THIRD_PARTY_NOTICES_HYPERFRAMES.md) |
| React Bits Depth Carousel | MIT + Commons Clause | Componente adaptado; restricciones sobre redistribuir el componente como producto/pack/port |
| Rare UI Grid Reveal y Proximity Sidebar | MIT + Commons Clause + Attribution | Componentes adaptados; conservar avisos y enlace visible a [Rare UI](https://rareui.com) |
| GSAP | Standard License de GSAP | Dependencia independiente; revisar su alcance según el uso |
| Fonts de BridgeClip | SIL OFL 1.1 | Binarios de Archivo Black, Instrument Serif, Montserrat y Poppins |
| Chewy | Apache-2.0 | Binario de fuente y su aviso |
| Logos SVGL/LobeHub | MIT sobre los archivos cubiertos; marcas de sus titulares | Conservar bytes, origen y avisos; no implica derechos de marca |
| Sonidos Kenney | CC0 | Packs identificados en los avisos del catálogo |
| Cuelume | MIT | Recetas y renderer de Daniel Belyi, snapshot fijado, 168 WAV derivados y notices conservados; no incluye el agente fx |
| Sonidos de Syka y opus-sound-layer | MIT según cada aviso | Material indicado en el catálogo y referencias; no licencia general para bibliotecas privadas |
| FFmpeg/FFprobe y yt-dlp | Licencias específicas de sus builds | Herramientas descargadas directamente de upstream por el bootstrap; distinguir descarga del usuario de binarios redistribuidos en un instalador Syka |

Los textos completos y rutas se encuentran en [CREDITS.md](CREDITS.md). Las excepciones con Commons Clause y GSAP no deben presentarse como MIT sin restricciones ni como si todo el árbol tuviera una única licencia abierta.

## Recursos, modelos y marcas

Las cuentas, medios y bibliotecas personales quedan bajo sus propios derechos. Exportar un video con Syka no transfiere su autoría ni resuelve licencias del material utilizado.

La licencia de un programa no prueba la licencia de sus pesos de modelos, sonidos, imágenes o fuentes. Cada recurso distribuido necesita una procedencia verificable. Tampoco incluye créditos gratuitos de servicios externos.

MPL no concede derechos sobre marcas. Se mantiene la exclusión upstream de los assets de marca de Diffusion en `apps/desktop/assets`. El nombre y los recursos de identidad de Syka no autorizan a presentar un fork como una versión oficial o avalada.

## Contribuciones

Las contribuciones propias se reciben bajo la licencia aplicable a cada archivo y, por defecto, MPL-2.0. El contribuidor conserva sus derechos. Al aportar material ajeno, indicá origen, versión/commit, cambios y texto de licencia; no elimines headers ni avisos.

No hay en esta política una cesión de derechos ni un CLA implícito. Un eventual acuerdo diferente deberá ser explícito. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Antes de distribuir una release

- Vincular el binario con su fuente exacta y conservar `LICENSE`, créditos y avisos.
- Verificar las licencias de dependencias efectivamente incluidas, no sólo las declaradas en manifests.
- Registrar versiones, hashes y licencias de las herramientas descargadas. Si se incluyen FFmpeg/FFprobe en un futuro paquete, revisar su build y fuente correspondiente; una URL genérica no basta como evidencia de redistribución.
- Revisar los avisos de binarios nativos, modelos y recursos, incluyendo OFL y Commons Clause.
- Excluir credenciales, perfiles, proyectos y bibliotecas privadas del desarrollador.

El inventario actual es técnico y preliminar. No constituye una certificación legal ni un dictamen de autoría completa.
