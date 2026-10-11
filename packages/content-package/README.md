# Paquete de contenido local

**Flujo vigente: sólo dentro del chat/composer.** Sikora descartó las pantallas de `preview/`. No integrarlas al producto ni usarlas como onboarding. La entrada actual es `docs/skills/syka-content-package/SKILL.md`; ver `docs/CONTENT_CHAT_HANDOFF_2026-10-05.md`. Los módulos de persistencia/derivados pueden reutilizarse sin UI. Las secciones de preview siguientes quedan como documentación histórica del prototipo.

Módulo independiente, sin dependencias de producción. Node 22+. Ninguna llamada externa ni conexión con Electron/DAPI. `contracts.d.ts` define la frontera propuesta; los entrypoints son `core.mjs` y `cover.mjs`.

## Flujo vigente: estilo primero, contenido por cuenta

Actualización solicitada por Sikora el 05/10/2026: el límite anterior de «sin onboarding» queda reemplazado por una configuración de estilo específica de este apartado. No es onboarding de instalación ni cambia el editor.

La preview abre una guía con respuestas libres sobre marca/público, voz, descripciones, portadas y diferencias por red. Permite guardar múltiples estilos de marca con revisiones, adjuntar PNG/JPG, enlaces y textos anteriores, distinguir material propio de inspiración, indicar su propósito y explicar qué gusta del ejemplo. Links se guardan sin fetch; no se atribuye análisis visual/web que no ocurrió. La conversación actual es una guía local por temas; no es un chat con modelo ni infiere preferencias por IA.

`social.mjs` implementa `StyleStore`, `prepareSocial`, `editTarget`, `socialFreshness`, `socialDraft` y `generateSocial`. Un snapshot del frente Publicación determina todos los destinos conectados, incluidos varios de una misma red. Cada cuenta conserva título, descripción, portada opcional y revisión independientes. Cambiar estilo, video o cuentas bloquea handoff. El paquete incluye snapshot portable del estilo y copias por hash de las imágenes referenciadas; versiones anteriores se conservan.

Los logos de Instagram/TikTok/YouTube/Facebook/LinkedIn se sirven desde los SVG originales de la biblioteca existente. No se recrean marcas. Otras plataformas siguen apareciendo por nombre y sigla hasta disponer de logo en catálogo.

La preview normal no inventa conexiones. Lee opcionalmente `.runtime/content-package/account-snapshot.json`, escrito por una futura integración de confianza con Publicación:

```json
{ "source": "publication", "accounts": [{ "id": "id-estable", "platform": "instagram", "label": "@cuenta", "status": "connected" }] }
```

El botón «Ver ejemplo con Instagram y TikTok» activa explícitamente fixtures marcados como demo. El borrador v2 conserva `demo: true`; Publicación debe rechazarlo para envío. No hay credenciales ni consultas a cuentas desde esta preview. El snapshot de archivo es un puente de integración local, no prueba de cuenta conectada ni reemplazo de verificación de salud inmediata antes de enviar.

La composición local adapta estructura por red (`direct`, `story`, `detail`) y permite editarla, pero **no aplica automáticamente la voz, referencias visuales o instrucciones libres**. `generateSocial` define la interfaz neutral para un proveedor de texto configurado: pasa dirección/referencias como datos y exige una respuesta para cada cuenta. No trae modelo activado ni dispara generación paga. La portada local sigue siendo una composición fija de fotograma y texto; los logos de marca subidos quedan como referencia, no se colocan automáticamente. El borrador v2 incluye todos los destinos revisados, sin subir/publicar/programar.

QA vigente: `node --test packages/content-package/core.test.mjs packages/content-package/social.test.mjs packages/content-package/preview/server.test.mjs`. El navegador usa `preview/verify-social.py` sobre puerto 5307 y `.runtime/content-package-qa`; `preview/verify.py` redirige a esa misma prueba. Para preparar y servir el entorno de QA, definir `SYKA_CONTENT_RUNTIME_ROOT=.runtime/content-package-qa` antes de `prepare-example.mjs`, y también `SYKA_CONTENT_PORT=5307` antes de `preview/server.mjs`. Los datos del usuario en 5306 quedan separados.

## Uso

Desde el worktree:

```powershell
node --test packages/content-package/core.test.mjs
node packages/content-package/prepare-example.mjs '[local reference omitted from public source]'
node packages/content-package/preview/server.mjs
```

Abrir `http://127.0.0.1:5306`. `SYKA_CONTENT_PORT` permite elegir otro puerto. No se usa el launcher principal. La preparación es explícita: extrae un fotograma con ffmpeg y copia fuentes seleccionadas a `.runtime/content-package`; no corre por exportar. Repetir preparación crea otro paquete, sin borrar anteriores. La preview muestra ese único ejemplo; no es un explorador de proyectos.

Para QA de navegador: instalar Playwright en `.runtime/content-package/python-deps` y ejecutar `preview/verify.py` con ese directorio en `PYTHONPATH`, `PYTHONIOENCODING=utf-8` y Chrome instalado, con el servidor de QA en 5307. Se usa un perfil efímero headless. La prueba escribe revisiones reales sólo en el paquete de QA. No modifica proyectos fuente. Las capturas quedan en `.runtime/content-package-qa/qa`.

## Contrato y persistencia

`captureContext(input)` calcula SHA-256 de export, brief canónico y cada material seleccionado. `exportVerified` es una atestación del host/editor: este módulo no verifica codecs, duración ni calidad del export. `expectedVideoHash` permite detectar cambios desde esa verificación. La receta puede acompañar el brief y sus recursos para entrar al fingerprint. Transcript ausente es válido; contexto editorial incompleto bloquea preparación.

`newPackage` → `editCopy` / composición opcional → `PackageStore.save` → `reviewPackage` → `publicationDraft`. Estados persistidos: `draft`, `reviewed`; vigencia se calcula con `freshness`. Estados de trabajo: `idle`, `running`, `completed`, `cancelled`, `failed`. `PackageJob` pasa AbortSignal al proveedor, impide trabajos solapados y rechaza resultados tardíos. Cancelar antes del commit de persistencia no agrega revisión. Después del rename, el commit ya ocurrió y no se revierte.

Cada paquete guarda `revision-000001.json`, etc., y `assets/<sha256>.<ext>`. Paths de los assets son relativos; se conserva procedencia, timestamp del fotograma y hash del export, no una copia del MP4. Para mover el paquete se copia toda su carpeta y se vuelve a enlazar el video por hash. El host decide la raíz de escritura de confianza; no aceptar rutas de proveedor para `PackageStore`. Lock exclusivo y control de revisión previenen sobrescrituras. Un lock dejado por una caída requiere diagnóstico del host antes de retirarlo; no hay recuperación automática ni recolección de assets huérfanos.

Cambio de video/brief/materiales bloquea handoff. `rebase` prepara revisión vacía con referencia a fingerprint anterior, sin borrar historia. Para un nuevo export el host debe renovar verificación y hash esperado; no se revalida automáticamente un archivo alterado. Cambiar copy/portada revoca revisión. El sello de revisión incluye copy, portada y fingerprint, por lo que una mutación directa también bloquea el borrador.

`localVariants` es composición extractiva del brief, identificada como `local-extractive`. No es fixture disfrazada ni IA. `generateCopy` es enchufable; necesita adapter `configured` y no invoca ningún proveedor incluido por defecto. Entrega brief y referencias de procedencia; no lee/sube transcript a un proveedor automáticamente. La política exige hechos respaldados y fuentes como datos. Esa política no garantiza veracidad de un modelo: siempre queda borrador para revisión humana. Los fixtures existen sólo en tests.

Portada: SVG editable autocontenido con raster del fotograma y logo original embebidos. No es render Diffusion, ni imagen generada. Rechaza SVG activo/externo, limita texto y escapa XML. La receta conserva hashes y textos; puede renderizarse otra vez con sus assets portables. `imageRoute` sólo habilita una capacidad configurada explícita: no hay generador implementado ni gasto automático.

## Integración acotada propuesta (no aplicada)

1. Export/router: ofrecer **Preparar portada y publicación** sólo después de un export exitoso y por click explícito. Exportar solo no crea paquetes.
2. Desktop/preload/main-channels: tres operaciones nuevas estrechas (`prepare`, `saveRevision`, `readPackage`) y un trabajo cancelable de copy. Resolver rutas y comprobar hashes en host; nunca confiar en paths del renderer/proveedor. Elegir raíz `.syka/content-packages` por proyecto sólo al integrar, no en esta preview.
3. Modelos: adaptar su registry a `TextCapabilityAdapter` / `ImageCapability`; separar proveedor de texto y herramienta de imagen. No asumir capacidad por marca, arnés, suscripción o modelo. No hay imports ni cambios al protocolo/harness.
4. Publicación/Zernio: recibir `PublicationDraft` y resolver el export por hash. Revalidar origen y revisión inmediatamente antes de cualquier upload. El borrador no incluye cuentas, tokens, destinos ni agenda. Una portada es receta: el frente de publicación necesita resolver/renderizar un asset final y validar requisitos del destino antes de ofrecer envío.
5. UI: portar la pantalla aislada a componentes Solid y conectar el host. El ejemplo no agrega rutas al editor, ni escribe en package.json/lockfiles compartidos. Mantener Inter/tokens Syka y reduced-motion.

Carruseles: segunda etapa, slides editables derivados de la misma revisión; no implementados. No hay instalador ni cambios al motor Diffusion. La configuración de estilo del apartado está implementada según el pedido posterior.
