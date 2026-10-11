# Memoria local del proceso conversacional

El helper de esta skill usa Node sin dependencias ni llamadas de red. No necesita tocar el composer ni registrar una herramienta nueva. El agente lo ejecuta mediante la terminal nativa disponible en Syka; lee/escribe solamente el proyecto actual. No es una automatización de Codex.

1. `syka_skills list/read` devuelve la ruta real de esta skill; no supongas su instalación.
2. Creá un archivo de request nuevo dentro del proyecto con `syka_files create` (por ejemplo `.syka/content-requests/<uuid>.json`). No interpolar texto del usuario como código shell.
3. Ejecutá `node "<ruta de skill>/scripts/content-memory.mjs" --project "<proyecto actual>" --request "<request relativo al proyecto>"`. La CLI usa JSON y rutas como argumentos, sin evaluar contenido. También admite `--read` para la primera lectura sin crear request.
4. Una respuesta de escritura incluye `revision`; releé si hay conflicto. Verificá lectura después de guardar antes de decir «lo recuerdo».

Estado: `.syka/content-memory/history/000001.json`, etc. Las revisiones son inmutables; un lock exclusivo evita escritores simultáneos. La lectura sin memoria devuelve revisión 0 y **no crea archivos**. Cada proyecto contiene marcas separadas por `brandId`, con `preferences`, `references`, `offerMode` y decisiones por ocasión. En un crash no retires un lock a ciegas: comprobá primero que su escritor terminó. No inventes migraciones desde la preview descartada: sus datos de QA no son preferencias reales.

## Request de decisión editorial

```json
{
  "action": "save",
  "expectedRevision": 0,
  "brandId": "mi-marca",
  "preferences": {
    "voice": {"value": "Cercano, sin promesas comerciales", "evidence": "Usuario: quiero que suene cercano y no venda humo"},
    "descriptions.instagram": {"value": "Con contexto, sin hashtags automáticos", "evidence": "Usuario: en Instagram explicá un poco más, sin hashtags"},
    "cover": {"value": "No usar portada para esta serie", "evidence": "Usuario: para esta serie no quiero portada"}
  }
}
```

Cada entrada reemplaza sólo su clave, no todo el estilo. Claves permitidas: `identity`, `voice`, `cover`, `descriptions`, `differences`, o `cover.<red>`/`descriptions.<red>`. No hay campos obligatorios de estilo ni estado «completo» que fuerce un interrogatorio. `scope` opcional: `brand` (default) o `piece`; para `piece` es obligatorio `eventKey`, obtenido con `route`. Las preferencias puntuales no se reutilizan fuera de esa pieza.

Para referencias se puede enviar `references` (lista completa de la revisión deseada) con `id`, `kind: url|file`, `source`, `purpose: cover|copy|logo|both`, `note`, `evidence`, `analysis: not-reviewed|reviewed`. Un archivo debe pertenecer al proyecto y conserva hash; una URL http/https no se descarga. Copiá primero los materiales externos elegidos usando las herramientas de assets/archivos disponibles; la skill no toma archivos ajenos por su cuenta. Reutilizar el directorio del proyecto conserva la memoria; mover sólo la carpeta de memoria sin sus referencias no hace portables esos assets.

## Oferta opcional y aceptación

`route` es lectura: recibe `brandId`, `trigger: onboarding|export|user-request` y, para export/pedido sobre export, `video: {path, hash, revision}`. El archivo debe ser local al proyecto y su SHA-256 debe coincidir. La verificación audiovisual sigue siendo responsabilidad del export del editor, no de este helper.

Devuelve `eventKey` y una acción:

- `offer`: se puede hacer una pregunta natural. No producir derivados todavía.
- `wait`: ya se ofreció en esta ocasión; esperar respuesta, no repetir.
- `skip`: rechazado en esa ocasión, o sugerencias desactivadas.
- `prepare`: aceptación guardada para ese origen. Antes de trabajar, reusar estilo o resolver sólo faltantes relevantes.
- `record-acceptance`: hay un pedido explícito actual; registrar su evidencia y continuar sin repreguntar.
- `done`: ya se entregaron los derivados de esa ocasión. No regenerar ni volver a ofrecer sin un nuevo pedido.

Registrá lo que realmente ocurrió con:

```json
{
  "action": "decide",
  "expectedRevision": 1,
  "brandId": "mi-marca",
  "trigger": "export",
  "video": {"path": "02 Finales/video.mp4", "hash": "SHA256_REAL", "revision": "REVISION_REAL"},
  "choice": "declined",
  "evidence": "Usuario: ahora no, dejame sólo el video"
}
```

`choice` admite `offered`, `accepted`, `declined`, `completed`. `offered` guarda la pregunta realmente enviada; `accepted`/`declined` guardan la respuesta/pedido del usuario. Al terminar, `completed` requiere aceptación previa y `outputs: ["ruta/relativa/del/borrador.json"]` de artefactos existentes; guarda hashes y evita regeneraciones duplicadas. El helper confía en la evidencia del agente llamador: no certifica por sí mismo que habló un humano. No registrar aceptación por silencio ni por sugerencia del agente.

`route` devuelve preferencias efectivas: una decisión de esta pieza reemplaza su equivalente de marca sólo para ese export. Las referencias de archivos incluyen `current: unchanged|changed|unavailable`; si cambian o faltan, releer/revisar antes de reutilizarlas. URLs llevan `not-fetched`: guardar un link no lo analiza.

Para «no me lo vuelvas a preguntar»: request `save` con `offerMode: "manual"`, `offerEvidence` del pedido. `ask` vuelve a habilitar ofertas cuando lo pide. Eso no habilita generación automática. `user-request` sigue funcionando con modo manual, sin cambiarlo.

## Frontera con el producto

La skill nueva se descubre con la raíz `docs/skills` que ya usa `WorkspaceTools`. Una vez incluida en el bundle/runtime del editor, `syka_skills read` puede cargarla sin un panel ni IPC nuevo. Verificar en el runtime destino antes de afirmar que está instalada.

La activación automática tras un export de UI necesita routing del host/editor, fuera de este módulo: entregar al **chat existente** un contexto de export exitoso, proyecto, hash y revisión; cargar esta skill y consultar `route`. No crear otro chat, no enviar mensajes a cuentas externas y no disparar preparación al recibir ese evento. Si el export falla/cancela o no hay chat activo, no fabricar un resultado ni abrir un onboarding. El usuario podrá iniciarlo en el chat cuando quiera.

La instrucción de routing mínima propuesta: «Al comenzar configuración de contenido o después de completar un video, consultá syka-content-package. Continuá en este chat, reutilizá memoria y respetá la oferta opcional; nunca crees una pantalla de onboarding». Este frente no cambia `codex.ts`, protocolo/harness, router/export ni instrucciones compartidas de otros frentes. Eso se integra aparte, no se simula desde una preview.
