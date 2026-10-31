# Personalización del acento — 05/10/2026

Implementación local en `worktrees/personalizacion`, rama `syka/personalizacion`, posterior a captura `ab61cff3fb99ae970a38ef0c87e7d5417b8716a9`. No integrada en el editor principal de Sikora, sin Electron adicional, proyectos personales ni servicios externos. La preview no importa agentes, IPC, DAPI o cuentas.

## Resultado

Sección compacta Personalización para Configuración general, con muestra/valor y popover. Área HSV con arrastre y flechas, tono, alpha, siete presets, HEX/RGB/HSL/OKLCH editable y copiable, EyeDropper sólo cuando existe, Aplicar/Cancelar y restauración del azul de producto. Escape, click externo y desmontaje cancelan la preview; Aplicar persiste. Formatos con alpha usan `/` y porcentaje, HEX admite 3/4/6/8 dígitos. OKLCH fuera de sRGB se recorta al gamut sRGB. El tono sobre gris/negro se conserva durante la interacción.

Controlador de apariencia independiente: `apps/web/src/lib/appearance/`. Preferencia no secreta versionada `syka.appearance.v1` en localStorage del perfil/origen de Syka. Lectura sincrónica al importar, bootstrap antes de render, observación del tema de Kobalte y sincronización entre ventanas. El store genérico existente no captura errores de JSON/storage; por eso esta preferencia usa un lector pequeño y defensivo. No guarda nada en Brand Kit, proyectos, cuentas o credenciales.

Al fallar storage, los cambios funcionan durante la sesión y se informa que no pudieron guardarse; al reabrir se usa el default. Datos ausentes/corruptos/versiones desconocidas vuelven al azul. El color es dato validado con gramática numérica cerrada, nunca CSS libre. Se conserva el valor elegido (incluido alpha) y se compone contra el fondo neutral para obtener controles opacos con contraste calculable.

Tokens afectados: primary/foreground/hover/pressing, tertiary y variantes, selection/foreground, ring y un token de texto. No se cambia `--accent` neutral. El foreground de botones elige blanco/negro; hover/pressed se desplazan en dirección que conserva su contraste. Selección y texto se adaptan a claro/oscuro. El azul restaurado es `#008CFF`, equivalente sRGB redondeado del HSL 207° original; su foreground ahora prioriza contraste y puede ser negro.

## Referencia y licencia

- [Demo/documentación oficial](https://www.fluidfunctionalism.com/docs/color-picker), leída con Agent Reach/Jina y verificada visualmente en navegador el 05/10/2026: panel, popover, plano HSV, rails, alpha, formatos y muestras.
- Botón oficial “View on GitHub” resolvió a [mickadesign/fluid-functionalism](https://github.com/mickadesign/fluid-functionalism).
- [Licencia oficial MIT](https://github.com/mickadesign/fluid-functionalism/blob/main/LICENSE), Copyright (c) 2026 Micka Touillaud. Archivo de licencia verificado vía API, blob `399b2fbbe6b1094ed721f41a59b95ada49a19366`. MIT permite modificación/distribución con conservación del aviso.
- [Fuente oficial del picker](https://github.com/mickadesign/fluid-functionalism/blob/main/registry/default/color-picker.tsx) inspeccionada: React, Framer Motion, Base UI y contextos propios del sitio.

Se escribió una implementación original en Solid/Kobalte de esa experiencia, sin copiar el archivo React ni añadir Base UI/Framer Motion. Conserva la composición y las interacciones; se adapta a los tokens, tamaño y tipografía de Syka. Los formatos usan botones compactos accesibles en lugar de un segundo menú. `colord` ya era dependencia del proyecto. No hay nuevas dependencias de producción ni cambios de lockfile. Transición discreta de popover con origen y guard de reduced-motion, siguiendo frontend-design/transitions-dev.

## Auditoría de acentos

- Botones/menu items, foco, selección de texto, controles e indicadores usan los tokens existentes y se actualizan en vivo.
- `index.css`: texto de acento legible, bordes/rings de selección, rellenos pequeños de slider/progress/radio y bordes de checkbox/switch visibles para colores extremos. Thumb de switch usa el foreground del acento en ambos temas.
- Wrapper Button: foco con ring separado del fondo. Item-row: icono sobre primary usa primary-foreground.
- Adaptador del chat: ya heredaba primary; se corrige foreground y hover/pressed del botón de envío y legibilidad del enlace a archivos. No cambia comportamiento del agente. Se conserva stop neutral, orbe, logotipo Codex azul, iconos de proveedor, CRT decorativo y colores semánticos existentes.
- No se modifica video, subtítulos, color de clips, medidores de audio, logos, presets de contenido, export, Brand Kit ni datos personales.

## QA local reproducible

Dependencias instaladas con `npm ci --ignore-scripts --no-audit --no-fund` dentro de este worktree. Playwright es una herramienta efímera en `.runtime/personalization`, sin modificar package.json/lock. Chrome headless con perfiles temporales; nunca el perfil personal ni Electron. Servidor Vite exclusivo `127.0.0.1:5396` (5307 estaba ocupado y no se tocó).

Desde la raíz de este worktree:

```powershell
node --test scripts/test-personalization.mjs
npm run check --workspace=@diffusionstudio/web
$env:SYKA_DEV_PORT='5396'
npm run dev --workspace=@diffusionstudio/web -- --host 127.0.0.1
# Otra terminal, mismo worktree:
npm install --prefix .runtime/personalization --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright
node scripts/qa-personalization.mjs
```

Preview: `http://127.0.0.1:5396/personalization-preview.html`. Carga sección y componentes reales de Syka, con bootstrap real de apariencia y storage exclusivo por origen/puerto.

Resultados: cuatro tests de lógica pasan. 228 colores por tema (extremos, presets, alpha y grilla RGB) verifican contraste >=4.5:1 en foreground de primary/hover/pressed y tertiary/selected; foco >=3:1 sobre siete superficies neutrales de claro/oscuro. Pruebas de gramática cerrada, roundtrip de formatos, datos corruptos y storage denegado pasan.

QA de navegador: 21 resultados registrados, cero errores de página. Guardar/recargar, Escape y devolución del foco, cancelar, rechazo de CSS arbitrario, recuperación desde error con el mismo preset, escritura incremental HEX, copiar, formatos, flechas, arrastre real, opacidad, restauración y reapertura. Contraste medido del CSS real en seis colores extremos/alpha por tema, incluyendo hover y relleno de slider. Semánticos error y medidor conservados. Popover dentro de viewport 360×640. EyeDropper ausente se oculta. Storage denegado informa sesión temporal y vuelve al default al recargar. Reduced-motion elimina animaciones.

Evidencia generada en `output/personalization/`: `results.json`, `dark-picker.png`, `light-picker.png`, `invalid-input.png`, `narrow-picker.png`. Imágenes inspeccionadas visualmente. La suite no selecciona píxeles fuera del navegador mediante EyeDropper: esa API requiere un gesto/permiso del runtime y queda como prueba manual de escritorio. No se afirma accesibilidad WCAG integral de toda la app por estas verificaciones acotadas.

## Integración mínima

La sección/controlador y QA se entregan en commit de implementación. Un commit separado inserta `PersonalizationSection` en `settings-view.tsx` y llama `initializeAppearance()` antes de render en `index.tsx` con limpieza HMR. Esas inserciones son las únicas modificaciones de entrypoints; el frente Onboarding debe conservarlas al integrar su versión de Configuración. No hay cambios de app.tsx, main/preload/canales, package.json/lock ni navegación.

La integración en el principal y su perfil real queda a cargo de la revisión del frente coordinador. Esta validación es del worktree/preview, no prueba de la app actualmente abierta de Sikora.

## Cierre verificado — 01:14 Argentina

- `65e05fd`: implementación, tokens/wrappers/adaptador acotados, preview y pruebas.
- `d5c75a5`: integración separada; sólo dos líneas en `settings-view.tsx` y cuatro en `index.tsx` (import/bootstrap/HMR).
- Commit de cierre posterior: smoke test de integración y este informe actualizado. No integrar el commit de captura inicial.

`npm run check --workspace=@diffusionstudio/web` y `npm run build --workspace=@diffusionstudio/web` pasan. Build completo: 3.523 módulos, sin error; advierte directivas `use client` ignoradas de módulos React existentes, sourcemap de CRT y chunks >500 kB. No se añadieron esas dependencias ni se amplió alcance para resolver warnings ajenos.

Además de la preview, `node scripts/qa-personalization-integration.mjs` verificó la página **real** `/?dashboard=settings` del worktree: inserción visible, aplicar lavanda, recargar, persistencia, volver a abrir y captura `settings-integrated.png`. Cero errores de página; todas las solicitudes fuera de `127.0.0.1:5396` bloqueadas. El primer intento agotó el timeout de carga mientras Vite optimizaba dependencias; con carga DOM y dependencias listas la prueba terminó correctamente. Resultado guardado en `output/personalization/integration-results.json`. No se usó Electron ni se tocó el runtime principal.

Estado entregado: commits locales y worktree limpio tras commit de cierre; build/outputs/QA dependencies ignorados. Sin publicaciones, conexión a proveedores, credenciales ni generación paga. Pendiente únicamente revisión/cherry-pick coordinado y comprobación en la app de escritorio real; el picker de pantalla tiene detección/cancelación implementadas, pero no se ejecutó una selección de píxel del escritorio durante QA.
