# Créditos y avisos de origen

Syka Studio es desarrollado por SikJa y los contribuidores de Syka sobre el editor de **[Diffusion Studio](https://github.com/diffusionstudio/editor)**. Este documento reconoce el material incorporado; no sustituye los textos completos de licencia ni acredita una revisión exhaustiva de todas las dependencias transitivas.

## Diffusion Studio

La base local inspeccionada corresponde al commit [5310ff0324c186d78d3f8af8186fe57bf84d22be](https://github.com/diffusionstudio/editor/commit/5310ff0324c186d78d3f8af8186fe57bf84d22be), versión de paquete **0.207.0**. La interfaz, el motor, el reconciliador, la API JSX, el encoder, la biblioteca de assets, las herramientas y partes del chat derivan de ese proyecto.

Copyright de Diffusion Studio Inc. y sus respectivos contribuidores. Se conserva [MPL-2.0](LICENSE), sus avisos en los archivos, la atribución y el commit de base indicado arriba. Este repositorio publica una instantánea sin la historia privada local; la [historia pública original de Diffusion](https://github.com/diffusionstudio/editor/commits/main/) sigue disponible upstream. Las modificaciones de Syka no transfieren a Syka la autoría del original.

Los assets originales de marca de Diffusion, incluidos los de `apps/desktop/assets`, estaban excluidos de la licencia de código en el README upstream. No se concede aquí permiso para reutilizar su marca, banner, capturas ni identidad como si fueran Syka. La presentación pública usa el orbe existente de `apps/desktop/syka-assets/icon.png`.

## Material incorporado y adaptado

| Origen y autoría | Uso en Syka | Licencia y aviso conservado |
| --- | --- | --- |
| [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs), Copyright © 2026 Jakub Antalik, versión `0.3.1` | Motor del orbe de Syka y exportación animada para los README | [MIT y aviso original](apps/desktop/syka-assets/LICENSE.thinking-orbs.txt); [procedencia del orbe](apps/desktop/syka-assets/README-orb.md) |
| [Thinking Logos](https://github.com/enesozturk/thinking-logos), Jakub Antalik y Enes Ozturk, snapshot `c18bc9c6470766f9a615303d35b43f446f0342b9` | Motor de puntos de 110 marcas, conversión previa e indicadores de herramientas | [MIT completo](apps/web/syka-public/licenses/thinking-logos/LICENSE.txt); [procedencia y adaptaciones](apps/web/src/mirel-chat/features/agents/thinking-logos/vendor/PROVENANCE.md); [fuentes de las marcas](docs/resources/thinking-logos/manifest.json) |
| [BridgeClip](https://github.com/bridge-mind/bridgeclip), Copyright © 2026 BridgeMind LLC, snapshot `b996820ef80fa324a3ad233bef1aac5cc6936804` | Estilos de subtítulos en `packages/runtime/src/media/caption/bridgeclip.ts`; integración con el motor Diffusion | Original MIT; [aviso fuente](packages/runtime/src/media/caption/LICENSE.BridgeClip.txt) y [copia pública](apps/web/syka-public/licenses/bridgeclip-captions/LICENSE.BridgeClip.txt). El código del motor y sus modificaciones siguen MPL |
| Whispera, Copyright © 2026 SikJa and Whispera contributors | Helper Windows de captura en `apps/desktop/native/screen-recorder` | [MIT y aviso de Whispera](apps/desktop/native/screen-recorder/LICENSE-Whispera); sus archivos declaran la adaptación |
| [HyperFrames](https://github.com/heygen-com/hyperframes), HeyGen y contribuidores | Worker de recorte local mediante `hyperframes@0.8.140` y referencias públicas de diseño | [Apache-2.0](docs/licenses/hyperframes-APACHE-2.0.txt); [procedencia y snapshots](docs/THIRD_PARTY_NOTICES_HYPERFRAMES.md). No se incorpora una licencia general sobre música, demos o servicios de HeyGen |
| [React Bits Depth Carousel](https://reactbits.dev/components/depth-carousel), Copyright © 2026 David Haz | `apps/web/src/mirel-chat/features/agents/depth-carousel.tsx` y CSS | [MIT + Commons Clause](docs/licenses/react-bits-license.txt); [nota de adaptación](docs/licenses/react-bits.md). No redistribuir el componente como producto, pack o port independiente |
| **[Grid Reveal de Rare UI](https://rareui.com)**, Copyright © 2026 Swami Malode | Vistas de imágenes; `apps/web/src/mirel-chat/features/agents/grid-reveal.tsx` | [MIT + Commons Clause + Attribution](docs/licenses/RARE_UI_LICENSE.txt). Este enlace y los del README satisfacen la atribución visible declarada en el aviso |
| **[Proximity Sidebar de Rare UI](https://www.rareui.com/components/proximitysidebar)**, Copyright © 2026 Swami Malode | Navegación del lector de documentos; `apps/web/src/mirel-chat/components/ui/proximity-sidebar.tsx` | [MIT + Commons Clause + Attribution](docs/licenses/RARE_UI_LICENSE.txt); se conserva su header de origen |
| [use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom), StackBlitz; port de conciv | Scroll del chat en `apps/web/src/agent-chat/stick-to-bottom.ts`, adaptado desde `@conciv/solid-stick-to-bottom@0.0.19` | MIT completo en el header; Copyright © 2024–present StackBlitz y © 2026 conciv contributors |
| [opus-sound-layer](https://github.com/Bodila51/opus-sound-layer), Copyright © 2026 Bodila51, snapshot `52ac266a24b7dfd3cd06a28c34d5af360a8d7586` | Criterios adaptados de selección/mezcla/revisión sonora y referencias de packs | [MIT](docs/licenses/LICENSE.opus-sound-layer.txt); el aviso no cambia la licencia de los sonidos Kenney |

## Tipografías

Los binarios de fuentes conservan sus licencias; nombrar una familia en un preset no implica incluirla ni dar permiso para redistribuirla.

| Familia incluida | Autoría del aviso | Licencia |
| --- | --- | --- |
| Archivo Black | The Archivo Black Project Authors, 2017 | [SIL OFL 1.1](apps/web/syka-public/licenses/bridgeclip-captions/ArchivoBlack-OFL.txt) |
| Instrument Serif | The Instrument Serif Project Authors, 2022 | [SIL OFL 1.1](apps/web/syka-public/licenses/bridgeclip-captions/InstrumentSerif-OFL.txt) |
| Montserrat | The Montserrat.Git Project Authors, 2024 | [SIL OFL 1.1](apps/web/syka-public/licenses/bridgeclip-captions/Montserrat-OFL.txt) |
| Poppins | The Poppins Project Authors, 2020 | [SIL OFL 1.1](apps/web/syka-public/licenses/bridgeclip-captions/Poppins-OFL.txt) |
| Chewy | Autores de la familia y avisos del recurso upstream | [Apache-2.0](packages/runtime/src/fonts/assets/Chewy-LICENSE.txt) |

La integración y los controles de subtítulos no cambian esas licencias ni los nombres reservados aplicables a modificaciones de las fuentes.

## Logos y sonidos

- **[SVGL](https://github.com/pheralb/svgl)**: Copyright © 2022 Pablo Hdez, [MIT](docs/resources/logos/LICENSE-SVGL.txt); snapshot fijado y origen en [NOTICE](docs/resources/logos/NOTICE.md).
- **[LobeHub Icons](https://github.com/lobehub/lobe-icons)**: Copyright © 2023 LobeHub, [MIT](docs/resources/logos/LICENSE-LOBEHUB.txt); snapshot `@lobehub/icons-static-svg@1.95.1`.
- **[Kenney](https://kenney.nl/assets)**: packs de sonidos bajo CC0. Se conservan [Interface](docs/resources/sounds/LICENSE-KENNEY-INTERFACE.txt), [UI](docs/resources/sounds/LICENSE-KENNEY-UI.txt), [Impact](docs/resources/sounds/LICENSE-KENNEY-IMPACT.txt), [Casino](docs/resources/sounds/LICENSE-KENNEY-CASINO.txt), [Sci-Fi](docs/resources/sounds/LICENSE-KENNEY-SCIFI.txt) y [RPG](docs/resources/sounds/LICENSE-KENNEY-RPG.txt), además del [NOTICE](docs/resources/sounds/NOTICE.md).
- **[Cuelume](https://cuelume.dev)**: Copyright © 2026 Daniel Belyi, [MIT completo](docs/resources/sounds/LICENSE-CUELUME.txt), versión `0.2.8`, snapshot `2a1ba4fc1b67e8371c9f37e37a51e61353166335`. Sus recetas y renderer offline producen los 168 SFX de interfaz incluidos como WAV editables. [Procedencia, ajustes y hashes](docs/resources/sounds/sources/cuelume.json); el notice MIT también se conserva dentro de cada WAV. No se incorpora el agente `vercel-labs/fx`.
- **Sonidos de Syka**: Copyright © 2026 Syka contributors, [MIT](docs/resources/sounds/LICENSE-SYKA.txt), según el aviso y la procedencia del catálogo.

Los SVG de marcas pertenecen a sus titulares. Las bibliotecas personales que un usuario conecta no pasan a ser recursos de Syka ni quedan cubiertas por la licencia del repositorio.

## Dependencias y distribución

El lockfile identifica, entre otras dependencias, React, SolidJS, Electron, Three.js, koota, ONNX Runtime, thinking-orbs, mediabunny y GSAP. Sus licencias y avisos se deben conservar en el paquete final.

**GSAP 3.15.0** figura bajo la [Standard License de GSAP](https://gsap.com/standard-license/), no MIT ni MPL. La importación directa inspeccionada está en el carrusel de la interfaz. Su licencia incluye límites para determinados productos visuales de animación; no se declara aquí autorización para un builder basado en GSAP.

**FFmpeg/FFprobe y yt-dlp** son herramientas independientes. Para la distribución inicial de Syka, el bootstrap prepara las herramientas faltantes en el entorno local del usuario mediante descargas desde sus proyectos originales, con versiones y SHA-256 fijados. Esta descarga directa debe distinguirse de incluir los ejecutables y DLLs dentro del instalador de Syka: no se redistribuye en ese instalador el FFmpeg GPL encontrado en el PATH del desarrollador.

Las herramientas descargadas mantienen sus propias licencias. La de FFmpeg depende del build y de sus opciones; revisar [FFmpeg Legal](https://ffmpeg.org/legal.html). Si una futura release incorpora estos binarios directamente, deberá conservar sus textos y registrar configuración y fuente correspondiente; una URL genérica no acredita por sí sola el cumplimiento. Node, cuando se incluye como runtime, conserva su licencia completa y avisos de terceros.

Estos créditos son un inventario de avisos identificados. El cierre de distribución debe verificar también dependencias transitivas, binarios nativos, modelos y recursos; ver [Fronteras de licencias](docs/LICENSING_BOUNDARIES.md).

## Marcas

Syka Studio, Diffusion Studio, HeyGen y las marcas del catálogo identifican a sus respectivos proyectos o titulares. La licencia de código no concede derechos de marca ni implica afiliación, patrocinio o aval.
