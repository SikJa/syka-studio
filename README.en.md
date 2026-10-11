<p align="center">
  <img src="apps/desktop/syka-assets/readme-orb.gif" alt="Original animated Syka Studio orb" width="116" height="116" />
</p>

<h1 align="center">Syka Studio</h1>

<p align="center"><b>Edit video. Work with agents. Stay in control.</b></p>

<p align="center">
  <a href="https://github.com/SikJa/syka-studio/releases/download/v0.208.0/Syka-Studio-x64-Setup.exe"><kbd>⬇ Download latest version · Windows</kbd></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-MPL--2.0-blue" alt="MPL-2.0 code" /></a>
  <img src="https://img.shields.io/badge/desktop-Windows%20x64-0078D4" alt="Windows x64" />
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/development-Node%20%E2%89%A522.12-339933" alt="Node 22.12 or later for development" /></a>
</p>

<p align="center">
  <a href="README.md">Español</a> · <b>English</b> · <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#installation">Installation</a> · <a href="docs/reference/tools/README.md">Tools</a> ·
  <a href="docs/reference/jsx/README.md">Compositions</a> · <a href="CREDITS.md">Credits</a> ·
  <a href="CONTRIBUTING.md">Contribute</a> · <a href="https://github.com/SikJa/syka-studio/issues">Issues</a>
</p>

Syka Studio is a desktop video editor built from [Diffusion Studio](https://github.com/diffusionstudio/editor). It combines visual editing, compositions as code, and a chat for working with agents through your own accounts.

The engine, timeline, and editable projects come from Diffusion. Syka adds its workspace, agent connections, resource library, and local tools. Their origins and licenses are retained in [Credits](CREDITS.md).

## Installation

**Initial version: 0.208.0 for Windows x64.** This is a beta with an **unsigned installer**; Windows may display a security warning. This command downloads a compatible public installer and checks its SHA-256: it uses the latest stable release if available, or a published beta if no stable release exists, never a draft. If no compatible release has been published, it explains why and does not install anything.

Open PowerShell and copy:

```powershell
irm https://raw.githubusercontent.com/SikJa/syka-studio/main/scripts/install.ps1 -OutFile "$env:TEMP\Install-Syka.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\Install-Syka.ps1"
```

You can also choose a version from [Releases](https://github.com/SikJa/syka-studio/releases).

You can [read the script](scripts/install.ps1) before running it. `-ExecutionPolicy Bypass` applies only to that PowerShell process; it does not change the computer's persistent policy.

The first launch sets up missing local tools and downloads Node, FFmpeg/FFprobe and yt-dlp from their original projects, using pinned versions and SHA-256 checksums. Internet is required for this initial setup; providers also require their own connection and account.

The interface supports **Spanish, English, and Brazilian Portuguese**, under **Settings → Interface language**. Changing the language does not change your projects or conversation content.

Packaging, launch with an isolated profile, and downloading and running all three tools were verified on the development machine. A complete installation on another PC remains pending.

macOS is being prepared; installation has not been validated yet. See [distribution preparation](docs/INSTALLATION_PREPARATION.md) for current limitations.

## What's included

- **Visual editing and compositions as code:** scenes, clips, text, captions, animations, and audio on the Diffusion engine.
- **Agent chat:** connections to the user's tools and accounts; availability depends on the installation and provider.
- **Local library:** bundled resources and personal folders for logos, sounds, and motion components, with origin notices.
- **Work tools:** media inspection, captures, and editor actions through CLI/MCP.
- **Optional publishing:** Zernio integration to prepare drafts and work with accounts you connect.

External services retain their own pricing, quotas, and terms. Syka does not include shared API keys or provider credits. Installing a tool and connecting an account does not guarantee access to every capability.

## Run from source

You need **Git, Node.js 22.12 or later, and npm**:

```sh
git clone https://github.com/SikJa/syka-studio.git
cd syka-studio
npm ci
npm run dev
```

Development uses port **5188**. Runtime settings, optional dependencies, and packaging are documented in [Local setup](OPEN_SOURCE_SETUP.md) and [Contributing](CONTRIBUTING.md).

The update release process is **version → `vX.Y.Z` tag → draft release → installer and checksum review → publication**. Pushing code alone does not publish or update the installer. See [Windows releases](docs/RELEASING.md) for commands and the workflow.

Try requests such as:

> Edit these clips into a vertical video, preserve the original audio, and keep the captions editable.

> Prepare a title animation using this project's colors.

> Review the composition and identify missing resources before export.

Results depend on the material and connected agent. Review the project and exported video before sharing them.

## Documentation

| Document | Contents |
| --- | --- |
| [Local setup](OPEN_SOURCE_SETUP.md) | Development, tools, and bundled resources |
| [Tool reference](docs/reference/tools/README.md) | CLI, MCP, and editor actions |
| [JSX reference](docs/reference/jsx/README.md) | Elements, timing, effects, and compositions |
| [Examples](docs/examples/README.md) | Compositions for exploring the engine |
| [Installation preparation](docs/INSTALLATION_PREPARATION.md) | Packaging and pending validation |
| [Credits](CREDITS.md) | Authors, dependencies, and notices |
| [License policy](LICENSE_POLICY.md) | MPL and third-party exceptions |
| [License boundaries](docs/LICENSING_BOUNDARIES.md) | Preliminary module audit and future separation |
| [Security](SECURITY.md) | Report a problem without exposing private data |

Most technical documentation is currently in Spanish or in its upstream language.

## Repository

| Path | Purpose |
| --- | --- |
| `apps/web` | Editor interface |
| `apps/desktop` | Electron application and local services |
| `apps/cli` | Editor tools CLI |
| `packages/runtime` | Scene, media, and playback engine |
| `packages/reconciler` · `packages/jsx` | Compositions as code |
| `packages/assets` · `packages/encoder` | Resources and export |
| `packages/agent-chat` | Chat, adapters, and agent tools |
| `docs` | References, skills, and public resources |

Internal `@diffusionstudio/*` names are retained for compatibility and to acknowledge the project's foundation.

## License and credits

Covered code is published under [MPL-2.0](LICENSE). Modifications to Diffusion files remain under MPL; the original authors retain their rights. Third-party materials have independent licenses, including additional restrictions. Read [the policy](LICENSE_POLICY.md) before redistributing components or resources separately.

Image views use **[Grid Reveal by Rare UI](https://rareui.com)**. The document reader uses **[Proximity Sidebar by Rare UI](https://www.rareui.com/components/proximitysidebar)**. Copyright © 2026 Swami Malode; [MIT + Commons Clause + Attribution](docs/licenses/RARE_UI_LICENSE.txt).

Syka Studio is an independent project. Diffusion Studio, HeyGen, and provider trademarks belong to their respective owners. Credits do not imply affiliation or endorsement.
