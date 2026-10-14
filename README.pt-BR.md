<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/desktop/syka-assets/readme-orb-dark.webp" />
    <img src="apps/desktop/syka-assets/readme-orb-light.webp" alt="Orbe original animado do Syka Studio" width="116" height="116" />
  </picture>
</p>

<h1 align="center">Syka Studio</h1>

<p align="center"><b>Edite vídeos. Trabalhe com agentes. Mantenha o controle.</b></p>

<p align="center">
  <a href="https://github.com/SikJa/syka-studio/releases/latest/download/Syka-Studio-x64-Setup.exe"><img src="apps/desktop/syka-assets/download-pt-BR.svg" alt="Baixar última versão · Windows" width="400" height="87" /></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/c%C3%B3digo-MPL--2.0-blue" alt="Código MPL-2.0" /></a>
  <img src="https://img.shields.io/badge/desktop-Windows%20x64-0078D4" alt="Windows x64" />
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/desenvolvimento-Node%20%E2%89%A522.12-339933" alt="Node 22.12 ou posterior para desenvolvimento" /></a>
</p>

<p align="center">
  <a href="README.md">Español</a> · <a href="README.en.md">English</a> · <b>Português (Brasil)</b>
</p>

<p align="center">
  <a href="#instalação">Instalação</a> · <a href="docs/reference/tools/README.md">Ferramentas</a> ·
  <a href="docs/reference/jsx/README.md">Composições</a> · <a href="CREDITS.md">Créditos</a> ·
  <a href="CONTRIBUTING.md">Contribuir</a> · <a href="https://github.com/SikJa/syka-studio/issues">Issues</a>
</p>

Syka Studio é um editor de vídeo para desktop desenvolvido a partir do [Diffusion Studio](https://github.com/diffusionstudio/editor). Combina edição visual, composições como código e um chat para trabalhar com agentes usando suas próprias contas.

O motor, a linha do tempo e os projetos editáveis vêm do Diffusion. Syka acrescenta seu ambiente de trabalho, conexões com agentes, biblioteca de recursos e ferramentas locais. A origem e as licenças são preservadas em [Créditos](CREDITS.md).

## Instalação

**Versão atual: 0.209.0 para Windows x64.** Inclui 28 skills, conhecimento de motion e fluxos de lançamento, 2.052 entradas de logos e 602 recursos de áudio. Mantém as correções de preview, notificações e atualização da versão 0.208.2. O app baixa quando solicitado e pede confirmação antes de reiniciar e instalar. O instalador continua **sem assinatura digital**; o Windows pode mostrar um aviso de segurança.

Abra o PowerShell e copie:

```powershell
irm https://raw.githubusercontent.com/SikJa/syka-studio/main/scripts/install.ps1 -OutFile "$env:TEMP\Install-Syka.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\Install-Syka.ps1"
```

Você também pode escolher uma versão em [Releases](https://github.com/SikJa/syka-studio/releases).

Você pode [ler o script](scripts/install.ps1) antes de executá-lo. `-ExecutionPolicy Bypass` vale apenas para esse processo do PowerShell; não altera a política persistente do computador.

A primeira execução configura as ferramentas locais ausentes e baixa Node, FFmpeg/FFprobe e yt-dlp dos projetos originais, com versões e SHA-256 fixados. É necessário ter Internet nessa preparação inicial; os provedores também precisam de conexão e conta próprias.

A interface está disponível em **espanhol, inglês e português do Brasil**, em **Configurações → Idioma da interface**. A mudança de idioma não altera seus projetos nem o conteúdo das conversas.

O empacotamento, a abertura com um perfil isolado e o download e a execução das três ferramentas foram verificados no computador de desenvolvimento. A instalação completa em outro PC ainda está pendente.

O suporte a macOS está em preparação; a instalação ainda não foi validada. Consulte [a preparação da distribuição](docs/INSTALLATION_PREPARATION.md) para conhecer as limitações atuais.

## O que inclui

- **Edição visual e composições como código:** cenas, clipes, texto, legendas, animações e áudio sobre o motor do Diffusion.
- **Chat com agentes:** conexões com ferramentas e contas do usuário; a disponibilidade depende da instalação e do provedor.
- **Biblioteca local:** recursos incluídos e pastas pessoais para logos, sons e componentes de movimento, com avisos de origem.
- **Ferramentas de trabalho:** inspeção de mídia, capturas e ações do editor via CLI/MCP.
- **Publicação opcional:** integração com Zernio para preparar rascunhos e trabalhar com as contas conectadas.

Os serviços externos mantêm seus preços, limites e condições. Syka não inclui chaves compartilhadas nem créditos de provedores. Instalar uma ferramenta e conectar uma conta não garante acesso a todas as funcionalidades.

## Executar a partir do código

Você precisa de **Git, Node.js 22.12 ou posterior e npm**:

```sh
git clone https://github.com/SikJa/syka-studio.git
cd syka-studio
npm ci
npm run dev
```

O ambiente de desenvolvimento usa a porta **5188**. A configuração do runtime, as dependências opcionais e o empacotamento estão em [Configuração local](OPEN_SOURCE_SETUP.md) e [Contribuir](CONTRIBUTING.md).

O processo para publicar uma atualização é **versão → tag `vX.Y.Z` → release em rascunho → revisão do instalador e dos checksums → publicação**. Um push de código, por si só, não publica nem atualiza o instalador. Os comandos e o workflow estão em [Releases de Windows](docs/RELEASING.md).

Experimente pedidos como:

> Edite estes clipes para um vídeo vertical, preserve o áudio original e mantenha as legendas editáveis.

> Prepare uma animação de título com as cores deste projeto.

> Revise a composição e identifique recursos ausentes antes da exportação.

Os resultados dependem do material e do agente conectado. Revise o projeto e o vídeo exportado antes de compartilhá-los.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Configuração local](OPEN_SOURCE_SETUP.md) | Desenvolvimento, ferramentas e recursos incluídos |
| [Referência de ferramentas](docs/reference/tools/README.md) | CLI, MCP e ações do editor |
| [Referência JSX](docs/reference/jsx/README.md) | Elementos, tempos, efeitos e composições |
| [Exemplos](docs/examples/README.md) | Composições para explorar o motor |
| [Preparação de instalação](docs/INSTALLATION_PREPARATION.md) | Empacotamento e validações pendentes |
| [Créditos](CREDITS.md) | Autores, dependências e avisos |
| [Política de licenças](LICENSE_POLICY.md) | MPL e exceções de terceiros |
| [Fronteiras de licenças](docs/LICENSING_BOUNDARIES.md) | Auditoria preliminar e futura separação de módulos |
| [Segurança](SECURITY.md) | Relatar um problema sem expor dados privados |

A maior parte da documentação técnica está em espanhol ou no idioma do projeto original.

## Repositório

| Caminho | Função |
| --- | --- |
| `apps/web` | Interface do editor |
| `apps/desktop` | Aplicação Electron e serviços locais |
| `apps/cli` | CLI das ferramentas do editor |
| `packages/runtime` | Motor de cenas, mídia e reprodução |
| `packages/reconciler` · `packages/jsx` | Composições como código |
| `packages/assets` · `packages/encoder` | Recursos e exportação |
| `packages/agent-chat` | Chat, adaptadores e ferramentas de agentes |
| `docs` | Referências, skills e recursos públicos |

Os nomes internos `@diffusionstudio/*` são mantidos para preservar a compatibilidade e reconhecer a base do projeto.

## Licença e créditos

O código coberto é publicado sob [MPL-2.0](LICENSE). Modificações em arquivos do Diffusion continuam sob MPL; os autores originais mantêm seus direitos. Materiais de terceiros têm licenças independentes, incluindo restrições adicionais. Consulte [a política](LICENSE_POLICY.md) antes de redistribuir componentes ou recursos separadamente.

As visualizações de imagens usam **[Grid Reveal da Rare UI](https://rareui.com)**. O leitor de documentos usa **[Proximity Sidebar da Rare UI](https://www.rareui.com/components/proximitysidebar)**. Copyright © 2026 Swami Malode; [MIT + Commons Clause + Attribution](docs/licenses/RARE_UI_LICENSE.txt).

Syka Studio é um projeto independente. As marcas Diffusion Studio, HeyGen e as dos provedores pertencem a seus respectivos titulares. Os créditos não implicam afiliação ou endosso.
