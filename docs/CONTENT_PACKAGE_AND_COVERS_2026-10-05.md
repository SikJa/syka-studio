# Paquete de contenido y portadas · 05/10/2026

## Decisión vigente: sólo dentro del chat/composer

Corrección posterior de Sikora: el onboarding es **un proceso conversacional**, no un apartado ni pantalla. Las dos previews anteriores fueron rechazadas como superficie del producto. No portar sus pantallas al editor. Sus módulos de paquetes/versiones y copy por cuenta pueden reutilizarse detrás del chat; no es autorización para integrar UI de perfil/dashboard.

Entregado `docs/skills/syka-content-package/SKILL.md`: descubrible por `syka_skills`, preguntas contextuales sin secuencia obligatoria, referencias por los adjuntos existentes, memoria por marca/proyecto, aceptación/rechazo de derivados, borradores por red dentro del mismo hilo y artefactos adjuntos. Usa el modelo del chat para escribir; no requiere un generador de texto aparte.

La skill consume un contrato de contexto aprobado (`references/approved-context.md`) para coordinar con el frente Memoria/Graphify. No implementa Graphify ni inyección global de prompts. El helper local de respaldo está separado en commit **`9cd40aa`** para revisión conjunta; no activar dos fuentes de memoria. Sólo memoriza decisiones y ocasiones del proceso de contenido, con revisión e historial local `.syka/content-memory`. No se crearon preferencias reales del usuario ni se guardaron datos de QA como acuerdos.

Verificado: skill válida; seis tests del helper (rechazo tras reinicio, opt-out, aceptación explícita, finalización sin duplicados, decisiones parciales, alcance por pieza/marca, hashes, concurrencia, referencias y bloqueo de junction); `WorkspaceTools` real del worktree descubre/lee entrypoint, contrato, guía y script y crea un request de proyecto en fixture aislado. Evidencia: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-chat-qa\discovery.json`.

Esto **no es** un turno real del modelo dentro de Electron ni una activación en el principal. No se modificaron composer, harness, router, export, otras skills ni memoria global. La activación post-export requiere que el integrador entregue contexto de export exitoso al chat existente y cargue la skill; copiar archivos por sí solo no instala ese evento. Ver handoff `docs/CONTENT_CHAT_HANDOFF_2026-10-05.md` con commits y puntos compartidos.

Las secciones siguientes son historial de implementación y QA de prototipos descartados; no describen el recorrido a integrar.

---

## Actualización: configuración de estilo y entrega por red

Sikora rechazó la presentación inicial y pidió onboarding específico para este apartado: preguntar cómo quiere portadas/descripciones, recibir referencias propias o ajenas y preparar cada red conectada. Este pedido reemplaza el límite anterior de no construir onboarding en este frente. No implica un instalador ni onboarding general del editor.

Implementado en la misma preview `http://127.0.0.1:5306/`:

- «Tu estilo»: guía de respuestas libres para marca/público, voz, descripciones, portadas y diferencias entre redes. Guarda perfiles de marca versionados y reutilizables. No simula interpretación de IA.
- Referencias: subida local PNG/JPG, enlaces sin fetch y textos anteriores. Cada una conserva propósito, procedencia propia/inspiración y qué gusta de ella. El paquete lleva snapshot del estilo e imágenes portables por hash.
- «Para tus redes»: pestañas por cuenta con logos SVG originales, texto editable propio, portada opcional y vista orientativa del post. Incluye todas las cuentas activas del snapshot y admite varias cuentas en una misma red. No reduce las conexiones a Instagram/TikTok hardcodeadas; esas dos se usan sólo en demo explícita.
- Cambiar estilo, fuente o cuentas invalida revisión/handoff. Borrador v2 contiene todos los destinos revisados. Demo queda marcada en el artefacto y debe ser rechazada por Publicación para enviar.
- La preview sin integración muestra cero cuentas. Ejemplo Instagram/TikTok se activa por botón y queda identificado. Sin login, credenciales, consultas remotas ni publicación.

Verificación de esta actualización: **16 tests Node + 16 comprobaciones de navegador Chrome**, sin pageerrors ni errores de CSP. QA usa `.runtime/content-package-qa` y puerto 5307, separado de la preview del usuario. Incluye imagen/texto/link, respuestas persistentes, preferencias por red, copy independiente, conservar borradores al cambiar pestaña, revisión de todos los destinos, recarga, invalidación por cambio de estilo, portabilidad de las imágenes y móvil 390 px sin overflow.

Capturas actuales (material y respuestas de ensayo, no preferencias del usuario):

- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\01-onboarding.png`
- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\02-references.png`
- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\03-instagram.png`
- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\04-tiktok.png`
- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\05-mobile.png`
- `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package-qa\qa\result.json`

Límite vigente: perfiles/referencias y entregas por cuenta tienen persistencia real; interpretación generativa de esas instrucciones está pendiente de proveedor configurado. La composición local cambia la estructura de descripción por red, no aplica tono libre ni analiza referencias. Se implementó `generateSocial` y se probó con fixture para conectar ese proveedor sin cambios al harness. Las portadas locales siguen siendo bases fijas; no automatizan el estilo visual aún. Cuentas reales dependen del frente Publicación y del contrato `AccountSnapshot`; no se está usando el conector de Codex como si perteneciera a Syka.

Archivos principales nuevos: `social.mjs`, `social.test.mjs`, `preview/verify-social.py`. Rehechos HTML/CSS/JS de la preview; ampliados servidor, contratos y documentación. Todo en el worktree asignado; sin cambios al principal/otros frentes. Las secciones siguientes documentan la primera entrega y sus evidencias históricas.

---

Primer flujo local implementado en `syka/paquete-contenido`, sobre captura `8c72f5471b497d21a2cca8796d04a9e20c48adb9`. Sólo archivos nuevos en `packages/content-package` y este informe. No se modificaron el principal, otros worktrees, skills existentes, protocolo/harness, timeline, export, preload, main, router, Zernio ni package/lockfiles compartidos.

## Resultado revisable

- Preview aislada: **http://127.0.0.1:5306**. Servidor Node propio; no Electron, DAPI/MCP3275, perfil del editor ni launcher principal. Requiere mantener abierto ese proceso; instrucciones de reinicio en `packages/content-package/README.md`.
- Entrada opcional → textos con variantes editables → portada opcional → revisión → borrador JSON local. «Conservar sólo el video» no escribe revisiones. El ejemplo se prepara explícitamente desde CLI, nunca desde el export.
- Persistencia real: revisiones inmutables con conflicto optimista y lock, fuentes con SHA-256 y assets relativos. Se conservan video/revisión, brief editorial, transcript existente, fotograma y logo elegidos. Cambios de contexto invalidan el pase a publicación; rebase crea una revisión vacía y preserva las anteriores.
- Copy local extractivo del brief, identificado como tal; interfaz enchufable para texto con proveedor configurado. No se generó copy mediante IA. No se usa el título técnico del proyecto como título editorial.
- Portada SVG autocontenida, editable, con fotograma real a 3,6 s y logo original de Vercel de la biblioteca incluida. Es un ejemplo de uso de biblioteca, no un claim sobre Vercel ni una frase atribuida al hablante. Receta guarda texto y hashes. El video sigue siendo el export Diffusion aprobado.
- `PackageJob` maneja estados/cancelación y rechaza resultados tardíos. No hay generación remota implementada en la UI; la cancelación visible descarta ediciones locales sin guardar.

## Evidencia y límites

| Nivel | Verificado | Límite |
| --- | --- | --- |
| Implementación | Contrato, hashes, revisiones, bloqueo de desactualizados, revisión, copy enchufable, SVG editable, preview y borrador local | No integrado en la app principal |
| Tests simulados | 11 tests Node: video/brief cambiado, contexto incompleto, export no verificado, falta de frame, capacidad de imagen ausente, cancelación tardía, concurrencia, paths, persistencia portable, revisión revocada, SVG activo y protección HTTP | Fixture de proveedor; no login/turno real de modelo |
| Navegador real | Chrome headless, 9 checks: export solo sin escritura, edición/descarte, save/reload, carga SVG, revisión/borrador, revocación al editar, portada opcional, móvil 390 px sin overflow, reduced-motion; cero pageerrors | Preview independiente; no prueba del editor Electron ni de Zernio |
| Material real | Lectura del export existente, extracción con ffmpeg, copia del logo original y transcript existente, SVG rasterizado por Chrome, inspección visual desktop/móvil | No nuevo render de video, no render Diffusion de portada, no IA de imagen |
| Producción/publicación | Ninguna llamada de publicación, upload, programación, login o generación paga | Borrador JSON local sólo para revisar el contrato |

Hash del export fuente antes y después de preparar el ejemplo:

`7d3c4173cf89450e7eb6c999502bdfa0ba151ade8ed527f98af92091ff286ee6`

Paquete de ejemplo: `2508661c-eac5-443e-9191-b2a9f4e885cf`. La QA agrega revisiones propias y deja el paquete como borrador, no como aprobación editorial del usuario. Los borradores JSON producidos en QA son artefactos de ensayo; no implican autorización de publicación.

Rutas absolutas de resultados locales (ignorados por Git, incluyen material privado del proyecto):

- Portada editable: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\example-cover.svg`
- Render PNG: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\cover-render.png`
- Pantalla de entrada: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\01-entry.png`
- Edición de copy: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\02-copy.png`
- Portada: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\03-cover.png`
- Revisión: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\04-review.png`
- Móvil: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\05-mobile.png`
- Procedencia/hash: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\evidence.json`
- Resultado de navegador: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\qa\result.json`
- Revisiones y fuentes portables: `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido\.runtime\content-package\packages\2508661c-eac5-443e-9191-b2a9f4e885cf`

## Integración propuesta, separada

Contrato detallado y tipos en `packages/content-package/README.md` y `contracts.d.ts`.

1. Export emite referencia verificada; un click explícito prepara el paquete. El host vuelve a comprobar hash. No conectar al evento automático de export.
2. IPC mínimo para preparar, leer y guardar revisiones; raíz de escritura resuelta por host. La preview no agrega esos handlers compartidos.
3. Capacidades provienen del frente Modelos. Adapter neutral con estado `configured`, AbortSignal y datos delimitados; no hardcodea Codex ni supone que Claude produce imágenes. Generación de imagen queda deshabilitada hasta tener herramienta real configurada y autorización de uso.
4. Publicación consume `PublicationDraft` revisado, vuelve a comprobar video/fingerprint y prepara sus cuentas/destinos/render final según requisitos. No recibe secretos ni autorización de envío desde el paquete. El sello de revisión se invalida ante cambios de copy/portada/origen.
5. Portar UI a Solid conservando estética Syka y reduced-motion. Carruseles editables quedan como segunda etapa. No onboarding/instalador.

Limitaciones explícitas: el host atesta verificación de export; este módulo verifica bytes, no calidad audiovisual. No hay selector general de archivos/frames/proyectos en la preview. Contexto modificado exige nueva revisión; export modificado exige renovar verificación del host. Copy de proveedor requiere revisión factual humana. Portadas usan composición fija 16:9 editable; adaptar tamaños por destino es trabajo posterior. Locks de procesos caídos necesitan diagnóstico antes de retirar; no hay limpieza automática de assets.

## Cambios para integrar

- `cbefe80` — `feat(content-package): add local versioned drafts and isolated cover preview`: módulo, contratos, ejemplo, UI, tests y protocolo propuesto; 12 archivos nuevos. Aplicar este commit posterior a la captura, no mezclar la captura completa.
- El commit documental inmediatamente posterior agrega sólo este informe. Consultar `git log 8c72f5471b497d21a2cca8796d04a9e20c48adb9..syka/paquete-contenido --oneline` para ambos IDs.
- Sin dependencias de producción ni build nuevo; sintaxis Node comprobada. Playwright de QA instalado sólo en `.runtime/content-package/python-deps`; no se instaló nada en el principal ni se compartió node_modules.

Comprobación reproducible:

```powershell
node --test packages/content-package/core.test.mjs packages/content-package/preview/server.test.mjs
node --check packages/content-package/preview/server.mjs
node --check packages/content-package/preview/app.mjs
$env:PYTHONPATH = (Resolve-Path '.runtime/content-package/python-deps').Path
$env:PYTHONIOENCODING = 'utf-8'
python packages/content-package/preview/verify.py
```

Se aplicaron `frontend-design` para composición adaptada al estilo actual y `transitions-dev` para panel reveal con reduced-motion. Verificación de UI con `webapp-testing`. No se crearon ni editaron otras skills.
