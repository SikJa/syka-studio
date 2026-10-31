# Zernio y Settings — entrega local

Worktree: `F:\Coding Proyects\Syka Clips\worktrees\publicacion-zernio`. Branch: `syka/publicacion-zernio`. Base: `ee55302acec47dd282c6446e72efb7369d080dcf`. No integrar automáticamente en el principal.

## Orden de integración

1. Commit de Electron: adaptador REST, OAuth MCP/PKCE, credenciales cifradas, borradores persistentes, almacenamiento del brand kit opcional y tipos IPC. Los registros están en `apps/desktop/src/main.ts`; los dos canales nuevos, en `main-channels.ts`.
2. Commit de UI: Social Button instalado por CLI de BoardUI, logos oficiales, vistas de publicación, modal de Settings, navegación y scripts de QA. Mantiene los tokens, Inter, escala y componentes existentes de Syka.

## Hooks compartidos para unir con Onboarding y Personalización

- `openSettings(page)` / `closeSettings()` de `apps/web/src/components/settings/state.ts` funcionan desde el dashboard, el editor y las publicaciones. El modal se monta una sola vez en `app.tsx`, debajo de `AuthProvider`.
- `SettingsModal({ isOpen, onClose, defaultPage, panes })` mantiene el contrato de apertura de la referencia de BoardUI. `SykaSettingsRoot({ panes })` usa el estado global. `SettingsPanes` es `Partial<Record<SettingsPage, Component>>`.
- **Insertar los apartados aprobados de Onboarding/Personalización con `panes`** para conservar sus almacenes actuales. Ejemplo: `<SykaSettingsRoot panes={{ 'brand-kit': SykaOnboardingSettings, appearance: PersonalizationSection }} />`. Un pane provisto sustituye completamente al fallback; el fallback de BrandKit no se monta ni lee/escribe otro almacén.
- Las páginas disponibles son `general`, `profile`, `appearance`, `brand-kit`, `zernio`, `codex`, `plugins`, `skills`, `tools`, `storage`, `glossary`, `help`. La navegación está centralizada en `groups` / `pages` de `settings/modal.tsx`.
- Alias anteriores `?dashboard=settings|account|mcp|zernio|preferences` abren el mismo modal. `PublicationView` abre Zernio sin desmontar el editor de borradores ni perder cambios locales.
- `DashboardScrollView` conserva su layout original fuera del modal. `data-slot="dashboard-scroll"` permite aplicar espaciado compacto exclusivamente dentro de Settings.
- `ProviderSocialButton` es el puente Solid → React del componente BoardUI instalado, usando `brand="custom"`, `config.icon`, `appearance="white"` y `size="small"`. Vite excluye `boardui-react` del compilador Solid. Sus colores son locales y no requiere importar los estilos globales de BoardUI.
- `AgentSettings section="skills"|"plugins"` conserva los endpoints existentes. Plugins gestiona servidores MCP del agente; no modifica los plugins de la aplicación Codex Desktop.

## Verificación y límites

- Desktop: 33 suites / 196 tests pasaron (22 de publicación y 6 de brand kit/storage, además de los existentes).
- Web: build de producción pasó. Las advertencias de sourcemap/use-client de Mirel y tamaño de chunks ya existían.
- El adaptador de publicación tiene pruebas de OAuth/DCR/PKCE, refresh, cifrado, CAS, publicación ambigua/idempotencia, 207 por plataforma, media/fecha, cancelación y revisión de permisos.
- Las pruebas con proveedores son simuladas. Ningún post real, programación real o nueva cuenta autorizada. La conexión que está en Codex Desktop no se hereda ni se extrae hacia Syka.
- OAuth se inicia solamente al usar la UI; las claves se ingresan en la aplicación y se cifran con `safeStorage`, nunca en el renderer persistente.
- Se admiten varias conexiones, con destinos separados. El free tier de Zernio aplica al total de cuentas sociales del equipo; no se implementó rotación para eludir cuotas.
- El QA de Electron usa el perfil aislado de `.runtime/publication`, puerto web 5298, MCP 3298 y CDP 9338. Los perfiles de fixtures son independientes y bloquean solicitudes reales a Zernio.
- BridgeClip sigue abierto como referencia. No se modificó su código ni el checkout/proceso principal de Syka (5188/3275).

## Fuentes

- [Social Button](https://www.boardui.com/components/social-button) y [Settings Modal](https://www.boardui.com/components/settings-modal). Instalación ejecutada: `npx -y boardui@latest add social-button --dir apps/web --path src/boardui-react --yes`; los archivos fueron ubicados en `apps/web/src/boardui-react` y se ajustaron solamente los imports al directorio aislado.
- [OAuth MCP](https://docs.zernio.com/mcp/setup), [API](https://docs.zernio.com/api/openapi), [idempotencia](https://docs.zernio.com/guides/idempotency), [media](https://docs.zernio.com/guides/media-uploads), [precios](https://docs.zernio.com/pricing).
- El icono de Zernio proviene de `https://zernio.com/icon.svg?v=4`; OpenAI, YouTube y Threads reutilizan los recursos ya incluidos en `docs/resources/logos`. Los logos de Social Button conservan su fuente y avisos originales.
