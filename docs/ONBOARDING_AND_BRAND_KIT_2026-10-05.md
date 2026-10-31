# Onboarding y Brand Kit — entrega del 05/10/2026

Implementado exclusivamente en `worktrees/onboarding-brand-kit`, rama `syka/onboarding-brand-kit`, sobre captura `139a40e6cc4789e5fe82c551e2436f273b2ec1f6`. No integrado en el principal ni en la app abierta. No se arrancó Electron, el launcher, un MCP ni un perfil compartido.

## Qué funciona

- Configuración contiene una guía libre, omitible y retomable. Omitir persiste en el host; no bloquea edición, export ni Brand Kit.
- Guías compactas de Groq y Zernio con enlaces oficiales. Groq reutiliza exactamente el almacenamiento `safeStorage` existente. La UI distingue clave guardada de acceso probado y no hace peticiones de prueba.
- Brand Kit: crear varios kits con ID y revisión, editar nombre, paleta HEX, nombres de fuentes, referencias HTTPS, tono y notas; elegir un predeterminado; eliminar con confirmación visible.
- Importación con selector nativo del host. PNG/JPEG/WebP/SVG estático, máximo 5 MB por recurso, 12 recursos por kit y 50 MB entre recursos referenciados. Se copian los bytes, nombre original, fecha y SHA-256; no se guarda la ruta de origen. Vista previa mediante `img`, nunca HTML/SVG inline ejecutable. SVG usa un subconjunto conservador: sin estilos, entidades, scripts, enlaces, imágenes ni foreignObject. SVG fuera del subconjunto pide una exportación estática o PNG.
- Recursos faltantes o alterados muestran aviso. Quitar un recurso elimina la copia administrada; las copias previas en proyectos se mantienen. No se redistribuyen archivos personales ni se modifican las bibliotecas de logos oficiales.
- «Usar en un proyecto» abre un selector nativo, verifica `package.json.projectId` y escribe snapshot y recursos en `.syka/brand-kit/`. Un cambio posterior del kit global no modifica la copia del proyecto. «Dejar un proyecto sin marca» guarda una decisión explícita que prevalece sobre el default.
- Preferencias aprobadas, propuestas, omitidas y desconocidas son estados distintos. La UI permite aprobar, omitir, responder «No sé» y corregir. No son memoria global de Codex ni entrenamiento.
- Persistencia JSON con reemplazo atómico, cola por instancia y revisión optimista para ventanas del mismo host. JSON corrupto no se reemplaza por un estado vacío. No se usa localStorage para estos datos.

## Contratos para integrar

`syka-onboarding-contract.ts` contiene los tipos públicos; nunca incluye secretos.

`ProjectPreferences` (`syka-onboarding-context.ts`) guarda respuestas por proyecto en `.syka/editing-preferences.json`, con revisión y reemplazo atómico. Su método `resolve(dir, defaults, project, relevant)` devuelve contexto aprobado, kit seleccionado/default, base de recursos y como máximo una próxima pregunta. El caller debe entregar un directorio de proyecto autorizado. Este módulo no invoca modelos ni está conectado al harness.

Precedencia: override del proyecto (incluido omitir/no sé) sobre defaults; destino del contrato de formato sobre preferencia general; kit del proyecto sobre default. Propósito/referencia disponibles en receta evitan preguntas repetidas. Las propuestas no se convierten automáticamente en respuestas aceptadas. `relevant` debe incluir sólo campos que cambien la próxima operación. Si ya existen propósito, destino/formato, kit y referencia, no se vuelven a pedir. Cambiar criterio se implementa guardando una nueva respuesta/revisión; un proyecto no cambia otro.

Formato se consume como `{ destination?, revision, source: 'manual' | 'detected' }`, sin detectar medios ni inferir plataforma a partir de dimensiones. El frente Formatos puede adaptar su contrato más completo a este subconjunto.

`publicationStatus` adapta evidencia suministrada por Publicación: `unconfigured`, `configured`, `verified`, `error`, `unknown`. Sin adaptador se muestra «Pendiente de integración». `verifiedAt` debe proceder de una comprobación real del frente Zernio; guardar una clave no lo establece. La UI acepta `publication` como prop. No se implementó transporte, OAuth ni almacenamiento de Zernio.

`referenceIntent(url, aspect)` prepara una intención `watch-reference`, transcript opcional, `requiresUserRequest:true`, `autoRun:false`, `upload:false`. Enlazar esa intención al flujo Watch existente queda para el integrador del chat; almacenar la referencia no ejecuta análisis ni subidas.

Los cambios compartidos son mínimos: una constante/correspondencia de tipos en `main-channels.ts`, import/registro en `main.ts`, import/montaje en `settings-view.tsx`. No hace falta cambiar preload: el bridge existente ya transporta las solicitudes tipadas. Van en commit separado. No se editaron `codex.ts`, autenticación del agente, protocolo/harness, skills, formatos ni otros worktrees.

## Evidencia local

Comandos ejecutados desde este worktree:

```powershell
node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.app.json --noEmit
node node_modules/vitest/vitest.mjs run apps/desktop/src/syka-onboarding.test.ts apps/desktop/src/syka-onboarding-host.test.ts apps/desktop/src/syka-groq.test.ts
```

Resultado: ambos TypeScript pasan; **22 tests pasan** en tres archivos. Cubren reapertura, copia tras eliminar origen, snapshot independiente, eliminación preservando proyecto, conflictos, corrupción conservada, formato/tamaño/SVG activo, recursos ausentes, aprobación/propuesta/omitir/no sé, cambios de criterio, aislamiento entre proyectos, default/sin marca, cancelación de selector, registro del host, ausencia de peticiones de red y contrato sin secretos. La suite Groq usa una clave falsa y `safeStorage`/fetch simulados: comprueba que guardar no hace red y que no queda texto plano; no demuestra un login real.

Build web Vite completo a `.runtime/onboarding-web-build`: pasa, con advertencias de `use client`/sourcemaps de Framer Motion y chunks grandes ya presentes en la base. Bundle de `main.ts` por esbuild a `.runtime/onboarding-main.cjs`: pasa.

Preview reproducible:

```powershell
node scripts/onboarding-preview.mjs
# http://127.0.0.1:5294/onboarding-preview.html?case=empty
```

Fixtures `empty`, `partial`, `complete`, `missing`, `error`. Estado y recursos propios en `.runtime/onboarding-qa`; puerto 5294 sólo loopback. El selector nativo se sustituye por un logo y un proyecto de QA declarados; las escrituras usan el mismo `BrandKitStore` real. No hay un puente hacia proyectos del usuario. Las fixtures conservan lo que se edita: `empty` puede dejar de estar vacío después de probar una creación. El script no es parte de la entrada de producción.

Verificación por navegador realizada:

1. Vacío visible, creación por formulario, paleta/fuentes/default, guardar y reabrir.
2. Importación del logo de fixture, preview real del SVG y asignación del snapshot al proyecto QA.
3. Guardar respuesta aprobada; omitir guía, recargar, ver «Retomar guía» y retomarla.
4. Estados parcial, completo, recurso faltante y error de lectura con reintento. Se corrigió durante QA la lectura de un `createResource` fallido que tapaba el aviso.
5. Accordion accionado por Enter; paneles cerrados tienen `inert` y `aria-hidden`. CSS `prefers-reduced-motion` preservado del snippet de transitions-dev; no se cambió la preferencia del sistema para simularla.
6. Viewports solicitados 520/900/1100 px; el navegador del entorno reportó 650 px CSS en la comprobación angosta y 1375 px en la amplia. Sin desborde horizontal en ambas mediciones. No afirmar un dispositivo móvil de 520 px verificado.

Capturas locales en `output/onboarding/`: `kit-900.jpg`, `kit-520.jpg` (nombre según viewport solicitado), `partial.jpg`, `complete.jpg`, `missing.jpg`, `error.jpg`, `connections.jpg`. Son fixtures, sin credenciales. El HTML/CSS usa fuente/tokens actuales, superficies oscuras y azul; acordeones con snippet de transitions-dev y campos accesibles por etiqueta.

## Fuentes oficiales comprobadas

Consultadas el 05/10/2026. Agent-reach se leyó y se intentó su lector Jina; al fallar el transporte local se usó navegación web directa a fuentes oficiales.

- [Groq Quickstart](https://console.groq.com/docs/quickstart): creación de API key y manejo como secreto. Enlace a [API Keys](https://console.groq.com/keys). La transcripción existente de Syka continúa siendo opcional, solicitada por la persona.
- [Zernio Quickstart](https://docs.zernio.com/): cuenta y clave de API propias, perfiles, obtención de URL para autorizar una cuenta social y cuenta conectada. La UI no promete planes, precios, pantallas ni un OAuth genérico de Syka; remite a la guía oficial.

## Pendiente, sin mezclar con lo probado

- Integración/revisión del principal y validación de la UI dentro de su Electron. Diálogos nativos y `safeStorage` se probaron con mocks; no se abrió otra instancia compartiendo perfil.
- Conectar `ProjectPreferences.resolve` al constructor de contexto del agente, recibir formato/receta efectivos y entregar la intención Watch al flujo existente. No se afirma que el agente actual ya recuerde estas respuestas.
- El frente Publicación debe suministrar su estado comprobado y su navegación real; no hubo login, OAuth, lectura autenticada, publicación ni programación desde esta entrega.
- Fuentes se guardan por nombre; no se empaquetan archivos de tipografía. La vista previa usa las disponibles localmente y puede caer a una fuente del sistema.
- El borrado lógico/archivo se realiza en la biblioteca global; los snapshots antiguos del proyecto se conservan por diseño. Reasignar kit deja recursos antiguos no referenciados en la carpeta del proyecto para no borrar materiales de ediciones anteriores. No hay recolección automática.
- La cola/revisión protege un host con múltiples ventanas; no pretende coordinar dos procesos Electron escribiendo el mismo perfil (ese escenario está fuera del alcance autorizado).
- Sin instalador, cambios de motor, cuentas nuevas, secretos reales, llamadas de generación, carga de medios ni consumo de créditos.
