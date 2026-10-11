<p align="center">
  <img src="apps/desktop/syka-assets/icon.png" alt="Orbe de Syka Studio" width="116" />
</p>

<h1 align="center">Syka Studio</h1>

<p align="center"><b>Editá video. Trabajá con agentes. Conservá el control.</b></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/c%C3%B3digo-MPL--2.0-blue" alt="Código MPL-2.0" /></a>
  <img src="https://img.shields.io/badge/escritorio-Windows%20x64-0078D4" alt="Windows x64" />
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/desarrollo-Node%20%E2%89%A522.12-339933" alt="Node 22.12 o posterior para desarrollo" /></a>
</p>

<p align="center">
  <b>Español</b> · <a href="README.en.md">English</a> · <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#instalación">Instalación</a> · <a href="docs/reference/tools/README.md">Herramientas</a> ·
  <a href="docs/reference/jsx/README.md">Composiciones</a> · <a href="CREDITS.md">Créditos</a> ·
  <a href="CONTRIBUTING.md">Contribuir</a> · <a href="https://github.com/SikJa/syka-studio/issues">Issues</a>
</p>

Syka Studio es un editor de video de escritorio construido a partir de [Diffusion Studio](https://github.com/diffusionstudio/editor). Combina edición visual, composiciones como código y un chat para trabajar con agentes usando tus propias cuentas.

El motor, la línea de tiempo y los proyectos editables vienen de Diffusion; Syka agrega su entorno de trabajo, conexiones de agentes, biblioteca de recursos y herramientas locales. El origen y las licencias se conservan en [Créditos](CREDITS.md).

## Instalación

**Versión inicial: 0.208.0 para Windows x64.** Es una beta con instalador **sin firma digital**; Windows puede mostrar una advertencia de seguridad. Este comando descarga un instalador público compatible y comprueba su SHA-256: usa la última estable si existe o una beta publicada si todavía no hay estable, nunca un borrador. Si no hay una release compatible publicada, informa el motivo y no instala.

Abrí PowerShell y copiá:

```powershell
irm https://raw.githubusercontent.com/SikJa/syka-studio/main/scripts/install.ps1 -OutFile "$env:TEMP\Install-Syka.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\Install-Syka.ps1"
```

También podés elegir una versión desde [Releases](https://github.com/SikJa/syka-studio/releases).

Podés [leer el script](scripts/install.ps1) antes de ejecutarlo. `-ExecutionPolicy Bypass` se aplica sólo a ese proceso de PowerShell; no cambia la política persistente del equipo.

El primer arranque configura las herramientas locales faltantes y descarga Node, FFmpeg/FFprobe y yt-dlp desde sus proyectos originales, con versiones y SHA-256 fijados. Necesita Internet para esa preparación inicial; los proveedores también requieren su propia conexión y cuenta.

La interfaz está disponible en **español, inglés y portugués de Brasil**, desde **Ajustes → Idioma de la interfaz**. El idioma no cambia tus proyectos ni el contenido de las conversaciones.

Se verificaron el empaquetado, el arranque con un perfil aislado y la descarga y ejecución de las tres herramientas en el equipo de desarrollo. Sigue pendiente la instalación completa en otra PC.

macOS está en preparación y su instalación todavía no está validada. Consultá [la preparación de distribución](docs/INSTALLATION_PREPARATION.md) para conocer los límites actuales.

## Qué incluye

- **Edición visual y como código:** escenas, clips, texto, subtítulos, animaciones y audio sobre el motor de Diffusion.
- **Chat con agentes:** conexiones con herramientas y cuentas del usuario; la disponibilidad depende de la instalación y del proveedor.
- **Biblioteca local:** recursos incluidos y carpetas propias para logos, sonidos y motions, con sus avisos de origen.
- **Herramientas de trabajo:** inspección de medios, capturas y acciones del editor mediante CLI/MCP.
- **Publicación opcional:** integración con Zernio para preparar borradores y trabajar con las cuentas que conectes.

Los servicios externos conservan sus precios, cuotas y condiciones. Syka no incluye claves compartidas ni créditos de proveedores. La instalación de una herramienta y una cuenta conectada no garantizan que todas sus capacidades estén disponibles.

## Probalo desde el código

Necesitás **Git, Node.js 22.12 o posterior y npm**:

```sh
git clone https://github.com/SikJa/syka-studio.git
cd syka-studio
npm ci
npm run dev
```

El arranque de desarrollo usa el puerto **5188**. La configuración del runtime, las dependencias opcionales y el empaquetado están en [Configuración local](OPEN_SOURCE_SETUP.md) y [Contribuir](CONTRIBUTING.md).

Para publicar una actualización, el proceso es **versión → tag `vX.Y.Z` → release en borrador → revisión de instalador y checksums → publicación**. Un push de código por sí solo no publica ni actualiza el instalador. Los comandos y el workflow están en [Releases de Windows](docs/RELEASING.md).

Podés empezar con pedidos como:

> Editá estos clips para un video vertical, conservá el audio original y dejá los subtítulos editables.

> Prepará una animación de título con los colores de este proyecto.

> Revisá la composición y señalá recursos faltantes antes de exportar.

Los resultados dependen del material y del agente conectado; revisá el proyecto y el export antes de compartirlos.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Configuración local](OPEN_SOURCE_SETUP.md) | Desarrollo, herramientas y recursos incluidos |
| [Referencia de herramientas](docs/reference/tools/README.md) | CLI, MCP y acciones del editor |
| [Referencia JSX](docs/reference/jsx/README.md) | Elementos, tiempos, efectos y composición |
| [Ejemplos](docs/examples/README.md) | Composiciones para explorar el motor |
| [Preparación de instalación](docs/INSTALLATION_PREPARATION.md) | Empaquetado y validaciones pendientes |
| [Créditos](CREDITS.md) | Autores, dependencias y avisos |
| [Política de licencias](LICENSE_POLICY.md) | MPL y excepciones de terceros |
| [Fronteras de licencias](docs/LICENSING_BOUNDARIES.md) | Auditoría preliminar de módulos y separación futura |
| [Seguridad](SECURITY.md) | Reportar un problema sin exponer datos privados |

## Repositorio

| Ruta | Función |
| --- | --- |
| `apps/web` | Interfaz del editor |
| `apps/desktop` | Aplicación Electron y servicios locales |
| `apps/cli` | CLI de las herramientas del editor |
| `packages/runtime` | Motor de escenas, medios y reproducción |
| `packages/reconciler` · `packages/jsx` | Composiciones como código |
| `packages/assets` · `packages/encoder` | Recursos y exportación |
| `packages/agent-chat` | Chat, adaptadores y herramientas de agentes |
| `docs` | Referencias, skills y recursos públicos |

Los nombres internos `@diffusionstudio/*` se conservan para mantener la compatibilidad y reconocer la base del proyecto.

## Licencia y créditos

El código cubierto se publica bajo [MPL-2.0](LICENSE). Las modificaciones de archivos de Diffusion siguen bajo MPL; los autores originales conservan sus derechos. Hay materiales de terceros con licencias independientes, incluidas restricciones adicionales: consultá [la política](LICENSE_POLICY.md) antes de redistribuir componentes o recursos por separado.

Las vistas de imágenes usan **[Grid Reveal de Rare UI](https://rareui.com)** y el lector de documentos usa **[Proximity Sidebar de Rare UI](https://www.rareui.com/components/proximitysidebar)**. Copyright © 2026 Swami Malode; [MIT + Commons Clause + Attribution](docs/licenses/RARE_UI_LICENSE.txt).

Syka Studio es un proyecto independiente. Las marcas Diffusion Studio, HeyGen y las de los proveedores pertenecen a sus titulares; los créditos no implican afiliación ni aval.
