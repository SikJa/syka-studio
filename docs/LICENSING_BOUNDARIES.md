# Fronteras de licencias y módulos de Syka

Fecha de inspección: **2026-10-11**. Base local: Diffusion Studio `5310ff0324c186d78d3f8af8186fe57bf84d22be` / paquete `0.207.0`. El checkout contiene cambios locales extensos; este informe es una clasificación técnica preliminar, no una certificación de copyright ni una extracción de módulos.

## Resultado

**La base del editor y los cambios en sus archivos continúan MPL.** Hay módulos añadidos con una separación técnica razonable, especialmente el núcleo de `packages/content-package`. Pueden servir de frontera para un desarrollo futuro independiente, después de revisar procedencia y derechos de todos los aportes. Este informe no los declara cerrados ni cambia la licencia de su publicación actual.

Los avisos identificados están en [CREDITS.md](../CREDITS.md) y las condiciones de publicación en [LICENSE_POLICY.md](../LICENSE_POLICY.md).

## Método y límites de evidencia

Se consultó Graphify primero y luego la implementación de `syka_code_graph` de `packages/agent-chat/src/host/code-graph.ts`. Las queries de `local-tools`, `publication` y `resource-library` devolvieron índice vigente sobre **236 archivos** de la allowlist de `scripts/graphify-scope.json`, generación `e88a2fa059e54aafaa23e85e2d48efa3`. La cobertura es parcial; el índice no cubre todo el repositorio.

`content-package` quedó fuera de esa cobertura, por lo que se inspeccionaron directamente sus rutas, imports y documentación. Se comparó la existencia de rutas contra `git ls-tree HEAD`, se leyeron headers y textos de licencia locales y se verificaron fuentes oficiales de MPL, GSAP y FFmpeg. Que una ruta no exista en la base sólo prueba que fue añadida en este checkout.

No se hizo una comparación de similitud de cada archivo contra todos los repositorios externos, una auditoría completa de la historia de aportes ni una revisión jurídica de titularidad. Tampoco se validaron todos los recursos de un instalador final. La documentación histórica que afirma “original” es un dato de procedencia por verificar, no evidencia suficiente por sí sola.

## Archivos que siguen sujetos a MPL

| Área | Rutas concretas | Motivo |
| --- | --- | --- |
| Interfaz y timeline | `apps/web/src/engine`, `apps/web/src/components/timeline`, `apps/web/src/components/sidebar-right/inspector` | Código del editor de Diffusion con modificaciones locales |
| Escritorio y puentes | `apps/desktop/src/main.ts`, `main-channels.ts`, `preload.ts`, `projects.ts`, `agent-chat.ts` | Archivos de la base modificados; incluir nuevos handlers no los convierte en propietarios |
| Host y protocolo de chat | `packages/agent-chat/src/host/host.ts`, `harness.ts`, `codex.ts`, `packages/agent-chat/src/protocol.ts` | La arquitectura y archivos ya existen en la base MPL |
| Motor de medios y captions | `packages/runtime/src/media`, `packages/runtime/src/systems`, `packages/runtime/src/traits` | Modificaciones al motor MPL; el material externo conserva además sus avisos |
| Composición y export | `packages/reconciler/src`, `packages/jsx/src`, `packages/encoder/src`, `packages/assets/src` | Paquetes de Diffusion y cambios sobre sus archivos |
| Contratos/handlers del editor | `packages/dapi/src`, `apps/desktop/src/dapi`, `apps/web/src/dapi` | API y handlers derivados de la base |

MPL define como modificaciones tanto los archivos existentes modificados como archivos nuevos que contengan código cubierto. Mover un archivo o copiar una función a otra carpeta no evita esa regla. Fuentes: [MPL §§1.10 y 3](https://www.mozilla.org/en-US/MPL/2.0/) y [FAQ de Mozilla, Q11](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Candidatos técnicos para una separación futura

“Candidato” indica una frontera posible. En este repositorio siguen la política de publicación MPL salvo excepción explícita. No es una declaración de autoría exclusiva ni un permiso para revocar licencias ya concedidas.

| Candidato y rutas | Evidencia actual | Frontera sugerida y trabajo pendiente |
| --- | --- | --- |
| **Paquetes de contenido:** `packages/content-package/core.mjs`, `social.mjs`, `cover.mjs`, `contracts.d.ts` | Rutas ausentes en HEAD base. Los módulos principales inspeccionados importan Node y módulos locales; sin imports del motor, Electron o DAPI | Candidato más independiente. Usar contratos de paquete/revisión/portada; revisar origen, similitud y aportes antes de una licencia adicional. `preview/` es prototipo histórico y no debe integrarse como pantalla del producto |
| **Cliente de publicación:** `apps/desktop/src/publication/client.ts`, `oauth.ts`, `store.ts`, `service.ts` | Rutas añadidas. Dependen de Node, MCP SDK, undici y mediabunny; `register.ts` conecta Electron y los canales de la app | Separar cliente/persistencia detrás de un contrato neutral. El registro y los cambios a los puentes MPL quedan en el editor. Revisar licencias de SDK/mediabunny y procedencia de tipos/protocolos |
| **Detección de herramientas:** `packages/agent-chat/src/host/local-tools.ts` | Ruta añadida; resolución de executables y rutas del entorno | Extraer un servicio de inventario sin copiar el harness. Revisar código y tipos compartidos; la integración con host/env MPL debe seguir abierta |
| **Análisis y diseño de audio:** `packages/agent-chat/src/host/audio-spectrum.ts`, `audio-analysis.ts`, `sound-design.ts` | Rutas nuevas y funciones de análisis/selección separables | Biblioteca neutral con entradas/salidas documentadas. Mantener los avisos de opus-sound-layer y de sonidos; revisar el ejecutable FFmpeg usado y no incluir colecciones privadas |
| **Biblioteca de recursos:** `packages/agent-chat/src/host/resource-library.ts`, `sound-categories.ts`, `skill-storage.ts` | Añadidos con lógica local de catálogo/persistencia | Posible servicio de catálogo. Separar enumeración, contratos y almacenamiento del harness; cada recurso conserva su licencia y no se vuelve exclusivo por catalogarlo |
| **Herramientas de proyecto:** `packages/agent-chat/src/host/project-delivery.ts`, `editing-recipe.ts`, `edit-journal.ts`, `storage-ledger.ts` | Archivos añadidos con funciones de entrega, receta o registro | Revisar copia de lógica/tipos del editor y procedencia de cada función. No trasladar modificaciones de `apps/desktop/src/projects.ts` como si fueran una implementación independiente |
| **Adaptadores de proveedores:** `packages/agent-chat/src/host/antigravity-cli.ts`, `claude-cli.ts`, `opencode.ts`, `external-harnesses.ts` | Rutas añadidas, conectadas al harness existente | Contrato futuro para proveedores independientes. Revisar derivación del harness/Codex y términos de APIs/CLIs. No cerrar `host.ts`, `harness.ts` ni cambios a protocolos originales |
| **Worker de recorte:** `scripts/background-removal-runner.mjs`, `packages/agent-chat/src/host/background-removal.ts` | Worker separado que invoca HyperFrames; adaptación al proyecto Diffusion | Separar sólo lógica propia revisada. HyperFrames, ONNX Runtime y pesos tienen licencias distintas; el diseño técnico no prueba derechos sobre modelos ni sus binarios |

## Áreas que requieren especial cuidado

- **`apps/web/src/mirel-chat`:** está fuera de la base local inspeccionada, pero mezcla código portado de otro entorno con React Bits y Rare UI. No se clasifica toda la carpeta como creación original ni como módulo que pueda cerrarse. Hay que verificar procedencia del port y cada componente.
- **BridgeClip:** `packages/runtime/src/media/caption/bridgeclip.ts` declara una adaptación MIT, pero usa tipos, acciones y utilidades del motor MPL. Conservar el copyright BridgeMind y el aviso MIT; no declarar propiedad exclusiva sobre el preset o el motor.
- **Grabador Whispera:** `apps/desktop/native/screen-recorder` ya tiene licencia MIT y autores de Whispera. Sus términos permiten usos más amplios que MPL, pero no borrar avisos ni presentar la adaptación como escrita íntegramente por Syka.
- **Skills y recursos:** hay copias Apache de presets FRAME de HyperFrames, referencias adaptadas de opus-sound-layer, sonidos CC0/MIT y componentes con restricciones. Tenerlos bajo `docs/` no los convierte en material propio.
- **Código nuevo con header MPL:** por ejemplo `scripts/dev-syka.mjs` y varios archivos nuevos de UI declaran MPL. “Nuevo” no significa “reservado”; respetar la licencia efectiva de cada distribución.

## Pendientes para una distribución de binarios

| Elemento | Evidencia encontrada | Pendiente concreto |
| --- | --- | --- |
| Fuente del editor | Base y lockfile presentes; LICENSE MPL conservado | Cada release debe enlazar tag/commit con la fuente cubierta correspondiente, incluyendo modificaciones |
| Avisos directos | Textos de BridgeClip, Whispera, Rare UI, React Bits, HyperFrames, fonts, logos y sonidos | Verificar que lleguen al instalador junto con créditos accesibles; no alcanza con que estén en el checkout |
| Npm/Rust y binarios | Manifest/lockfile y Cargo.lock | Inventario de lo efectivamente empaquetado, licencias completas y NOTICE; revisar dependencias transitivas y runtimes |
| FFmpeg/FFprobe y yt-dlp | La inspección inicial de `apps/desktop/scripts/stage-runtime.mjs` encontró copia de ejecutables/DLLs del PATH y un aviso genérico. Para la entrega inicial se eligió sustituirlo por bootstrap de herramientas faltantes mediante descarga directa upstream con versiones y SHA-256 fijados | Verificar el script final, su fuente, hashes y avisos. Distinguir esa descarga del usuario de la redistribución de binarios dentro del instalador de Syka. Si se incluyen binarios en una release futura, determinar LGPL/GPL/nonfree y atender la fuente correspondiente; [FFmpeg Legal](https://ffmpeg.org/legal.html). No se aprobó el build GPL del PATH para redistribución |
| GSAP | Lockfile: 3.15.0; import directo en Depth Carousel | Conservar aviso de versión y evaluar el uso bajo la [Standard License](https://gsap.com/standard-license/). El uso decorativo inspeccionado no autoriza cualquier futura función de creación visual |
| Modelos | HyperFrames worker indica `u2net_human_seg`; tracking tiene recursos propios | Revisar licencia, procedencia y mecanismo de descarga de cada peso, además de licencia de su código/runtime |
| Assets de marca upstream | Exclusión en README original de Diffusion | Usar marca Syka y mantener la exclusión; no distribuir identidad upstream como marca propia |
| Datos privados | Runtime y bibliotecas configurables | Verificar que perfiles, claves, cuentas, proyectos y carpetas privadas no entren al repo ni al instalador |

La lista es una revisión de componentes detectados, no un SBOM completo ni una aprobación de release.

## Cómo decidir una separación real

1. Fijar las rutas y la versión del módulo; mapear todo el código, tipos, tests, recursos y dependencias que se quieren extraer.
2. Revisar historia y procedencia: autorías, copias, ports, generación asistida y material de referencia. Registrar pruebas y dudas.
3. Comparar cada parte con Diffusion y otros orígenes. Mantener bajo MPL los archivos cubiertos y bajo sus condiciones los terceros.
4. Crear una interfaz documentada; dejar abiertos los cambios y adaptadores que pertenezcan al editor MPL.
5. Confirmar derechos de todos los autores antes de una licencia adicional. No inferir una cesión de un PR.
6. Identificar la licencia de la nueva entrega explícitamente, conservando derechos de las versiones ya distribuidas y todos los avisos de terceros.

## Fuentes primarias

- [Mozilla: texto MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
- [Mozilla: FAQ MPL, alcance por archivo, distribución y fuentes](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
- [Diffusion Studio: base inspeccionada](https://github.com/diffusionstudio/editor/tree/5310ff0324c186d78d3f8af8186fe57bf84d22be).
- [React Bits: licencia publicada por el autor](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md), verificada contra la copia local el 2026-10-11.
- [HyperFrames: licencia Apache del proyecto](https://github.com/heygen-com/hyperframes/blob/main/LICENSE).
- [GSAP: Standard License](https://gsap.com/standard-license/), consultada el 2026-10-11.
- [FFmpeg: consideraciones de licencia y distribución](https://ffmpeg.org/legal.html), consultadas el 2026-10-11.
