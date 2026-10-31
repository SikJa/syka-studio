# Handoff — contenido dentro del chat

Estado para integración coordinada del 05/10/2026. Worktree `F:\Coding Proyects\Syka Clips\worktrees\paquete-contenido`, rama `syka/paquete-contenido`; captura base `8c72f5471b497d21a2cca8796d04a9e20c48adb9`. No mezclar la captura completa ni llevar las pantallas descartadas al producto.

## Lo que pidió Sikora en este chat

Portadas, copy por red y referencias deben funcionar **sólo desde el chat/composer que ya existe**. Al iniciar configuración o terminar un video, ofrecer el proceso opcional; preguntar lo necesario, recordar acuerdos y respetar si decide no hacerlo. Rechazó ambos apartados visuales aunque valoró el sentido del segundo flujo. Logos y versiones por cuenta siguen siendo requisitos de presentación cuando el renderer actual permita mostrarlos. No crear otro composer, dashboard, formulario o pantalla de onboarding.

## Cambios para integrar

- `9cd40aa`: helper opcional de persistencia de contenido y seis tests. **Entrega separada para revisar junto al frente Memoria/Graphify**, no instalar como segunda memoria en paralelo. Archivo `docs/skills/syka-content-package/scripts/content-memory.mjs`; pruebas `packages/content-package/chat-memory.test.mjs`.
- Commit de skill/documentación posterior a `9cd40aa` (obtener ID con `git log -2 --oneline`): `SKILL.md`, `references/approved-context.md`, `references/persistence.md`, `packages/content-package/verify-chat-skill.mjs` y handoff. Puede consumir el backend de memoria acordado; helper local sólo como fallback. La prueba de lectura del script requiere el commit opcional; si se omite, ajustar esa comprobación al backend elegido.
- Históricos `cbefe80`, `99e83eb`, `77a6468`: paquetes locales, SVG, copy por cuenta y previews. **No cherry-pick de las previews como UI del producto.** Si se necesita el motor de paquetes, extraer/revisar `core.mjs`, `cover.mjs`, `social.mjs` y sus contratos/tests sin portar `preview/*`. La skill conversacional también puede producir artefactos con las herramientas existentes sin depender de esos módulos.

## Fronteras y shared hooks

1. **Distribución de skills:** `packages/agent-chat/src/host/workspace-tools.ts` ya descubre `docs/skills` según `docsDir` y permite leer soportes. Incluir sólo la nueva carpeta en el bundle/runtime configurado del editor y verificar `syka_skills list/read`. No se editó ese archivo ni se instalaron skills en perfiles globales.
2. **Routing conversacional:** `packages/agent-chat/src/host/codex.ts` compone instrucciones del chat; las editoriales están en `editorial-instructions.ts`. El integrador puede añadir una referencia breve a esta skill ante configuración de contenido/export completado. Se propone, no se aplicó en este frente. La instrucción compartida actual de no imponer onboarding sigue compatible: este proceso es opcional y contextual, no un formulario obligatorio.
3. **Export de UI:** entregar éxito verificado/path/hash/revisión al chat existente. Consultar estado de la ocasión antes de ofrecer. No generar automáticamente, no crear chat y no disparar nada tras cancelación/fallo. La skill sola no recibe eventos del export.
4. **Memoria/Graphify:** consumir `references/approved-context.md`: proyecto, marca, revisión, preferencias explícitas/evidencia/alcance, referencias observadas y estado de oferta/aceptación/entrega. El helper separado prueba un backend local; no es mandato de arquitectura. Graphify no debe convertir inferencias en aprobación ni mezclar clientes.
5. **Composer:** reutilizar mensajes y adjuntos existentes (`apps/web/src/mirel-chat/features/agents/agent-composer.tsx` en esta captura). Sin cambios de diseño/componentes. Retornar textos por red y portadas como artefactos del mismo hilo. No volver a enlazar la preview como proceso del usuario.
6. **Publicación:** obtener snapshot real de cuentas cuando su herramienta exista; mientras falte, destinos indicados por el usuario con etiqueta manual. Copy por cuenta y revisión sin uploads/envíos. Un paquete aceptado para preparar no autoriza publicar. La skill no inventa tools nuevos que el runtime no exponga.

## Evidencia

```powershell
node --test packages/content-package/chat-memory.test.mjs
node --experimental-transform-types packages/content-package/verify-chat-skill.mjs
python -X utf8 C:\Users\Sikora\.codex\skills\.system\skill-creator\scripts\quick_validate.py docs/skills/syka-content-package
```

Seis tests pasan; skill válida; descubrimiento/lectura con la clase `WorkspaceTools` real del worktree pasan. El modo transform-types de Node se usa sólo para ese ensayo de integración sin instalar dependencias. Fixtures y evidencia exclusivamente bajo `.runtime/content-chat-qa`; no se tocaron proyectos existentes ni memoria de usuario.

Pendiente de integración, no de código de la skill: elegir backend común, distribuir al runtime de la app, conectar la oferta contextual y probar un turno real del chat con «sí», «ahora no», reanudación y cambio de marca. No hubo login, llamadas de IA pagas, publicación ni modificaciones del principal.
