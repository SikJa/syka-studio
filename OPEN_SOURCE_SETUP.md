# Syka Clips: configuración de desarrollo y dependencias

La aplicación usa el editor y motor local de Diffusion Studio. Las skills genéricas de Syka están en `docs/skills` y se incluyen al empaquetar. No hacen falta carpetas personales de El Mago, logos, ni instalaciones globales de HyperFrames/Remotion para editar.

## Desarrollo desde el código

Requisitos: Node.js 22.12 o posterior y npm. Desde la raíz de este repositorio:

```powershell
npm ci
npm run dev
```

El arranque de Syka usa el puerto 5188 y rechaza un puerto ocupado sin matar otro proceso. Por defecto conserva datos y proyectos de desarrollo en `.runtime/diffusion` junto al checkout. `SYKA_RUNTIME_ROOT` y `SYKA_MEDIA_ROOT` permiten elegir otras carpetas; la primera debe ser absoluta. No hay una unidad D/F obligatoria.

## Qué viene con la app y qué amplía al agente

| Componente | Necesidad |
| --- | --- |
| Electron, motor, encoder, compilador y docs/skills de Syka | Se preparan con los scripts de empaquetado; el editor no necesita un Node global para abrirse. |
| Codex CLI y sesión propia de Codex | Para usar el chat del agente. El editor local funciona sin iniciar el chat. |
| Node, Git y Python independientes | Para scripts, dependencias, repositorios y procesamiento que el agente necesite. Se detectan, no se instalan silenciosamente. |
| FFmpeg y FFprobe | Para mejora de audio, conversión y mediciones del agente. El export nativo usa el encoder del editor. |
| Clave Groq propia | Opcional, para la transcripción conectada actualmente. No se distribuye una clave compartida. |
| Pesos SAM2 | Descarga inicial sólo cuando se usa tracking. |
| Bibliotecas personales de logos, sonidos y motions | Opcionales; cada usuario conecta sus carpetas desde Biblioteca. |
| Catálogo SVG de SVGL y LobeHub | Incluido bajo `docs/resources/logos`, disponible sin red ni carpetas personales; fuentes y licencias en `NOTICE.md`. |
| Catálogo de sonidos Kenney + Syka | Incluido bajo `docs/resources/sounds`: 151 efectos CC0, 36 efectos originales MIT, 3 bases instrumentales y 11 capas. Escucha/importación offline; generar variaciones usa Node, sin módulos Python ni modelo externo. |

Configuración → Herramientas locales detecta ejecutables y muestra sus rutas. «Encontrado» indica presencia del archivo, no una verificación de versión, login, DLLs, módulos Python o codecs.

La búsqueda de herramientas usa primero `SYKA_<HERRAMIENTA>_PATH` (por ejemplo `SYKA_FFMPEG_PATH`, ruta absoluta al ejecutable), luego `tools/<herramienta>/bin` o `tools/<herramienta>` en el runtime del usuario y en los recursos del paquete, y finalmente PATH/directorios conocidos. Una ruta explícita inválida se informa; no se reemplaza silenciosamente. Las carpetas encontradas se pasan a la terminal del agente sin heredar credenciales de proveedores.

## Proyectos y SVG portables

La importación normal sigue vinculando medios para evitar copiar videos grandes sin pedido. La importación de logos desde Biblioteca **copia** los SVG a `assets/logos` del proyecto. El agente puede hacerlo con `assets`, `action: import`, `copy: true`, y usar el path/id devuelto. Esto conserva bytes y originales, incluso si se desconecta la carpeta de logos. También materializa un logo previamente vinculado sin duplicar su identidad.

Esta opción no convierte por sí sola todos los medios existentes en un proyecto portable. Videos/audio aún vinculados requieren recopilarse antes de compartir. Las carpetas personales no se incorporan a la distribución del editor. El catálogo público incluido sí se prepara con `stage:docs`; no se serializa en la configuración personal ni requiere una ruta de D/F. Las variantes conservan bytes, origen y hash; no se reconstruyen marcas con dibujos aproximados.

El snapshot actual contiene 2.052 SVG de 948 nombres de marca (antes de deduplicar SVG idénticos), SVGL fijado al commit `ecb9adaafe41c578742e94fce90e6cc03c48a574` y `@lobehub/icons-static-svg@1.95.1`. Dos SVG de SVGL con recursos activos/externos fueron excluidos por el validador actual. Para regenerarlo desde snapshots locales inspeccionados, usar `node scripts/prepare-logo-catalog.mjs --source-dir <SVGL> --commit <SHA> --lobe-dir <paquete-static-extraido-con-LICENSE>`. El script analiza datos literales de TypeScript sin ejecutarlos y no incorpora las bibliotecas privadas del usuario.

## Alcance actual

Esta etapa ordena el desarrollo, las rutas y la detección de herramientas. No incluye construir un instalador, provisionar dependencias ni preparar una publicación. La configuración existente de Electron Forge queda para una etapa posterior.

Los datos de la app empaquetada usan el perfil del usuario, separados del ejecutable. La CLI preparada apunta a `Syka Clips.exe`. La selección de docs públicas excluye auditorías, QA y bibliotecas personales. Estas correcciones evitan dependencias de esta máquina sin adelantar la distribución.

La distribución y las pruebas en una PC limpia quedan pendientes. No se empaquetaron binarios personales, cuentas, claves ni assets de marca del usuario.

## Audio y recursos de sonido

Biblioteca → Sonidos abre 16 categorías compactas de efectos, con nombre/cantidad, antes de mostrar variantes; Música y Capas tienen sus propios filtros. Una categoría conserva búsqueda, vuelta y paginación propia. Los archivos personales sin tipo musical declarado entran en Efectos, clasificados por nombre o en Otros sonidos; no se atribuye un género musical por adivinar. La preescucha es independiente. Agregar copia el archivo a `assets/sounds` y crea un clip de audio nativo editable. Los niveles iniciales dejan margen: efectos −12 dB, música/capas −16 dB; ajustar la mezcla de cada proyecto. La preescucha no cambia su fuente.

`docs/skills/syka-local-audio` coordina selección, síntesis local, cues, capas, fades, ducking y revisión del export. El generador `scripts/audio-studio.mjs` usa sólo la biblioteca estándar de Node y escribe WAV estéreo PCM16/48 kHz con metadatos. No precisa HyperFrames/Remotion globales ni pesos de IA. Python queda como alternativa para scripts existentes. La biblioteca incluida no necesita ningún generador para reproducir/importar sus archivos.

Para reproducir el catálogo en desarrollo: extraer los dos ZIP oficiales Kenney en `interface` y `ui` dentro de una carpeta de preparación que también conserve `interface.zip` y `ui.zip`; ejecutar `node scripts/prepare-audio-catalog.mjs --source-dir <carpeta> --ffprobe <ruta-absoluta>`. El script verifica hashes fijados/licencias, inspecciona el audio y genera los recursos Syka. No descarga paquetes silenciosamente ni toma assets de carpetas privadas. Ver `docs/resources/sounds/NOTICE.md`.

Se adaptaron criterios de mezcla de HyperFrames/Remotion al reloj y volumen del motor Diffusion. La reducción de música mediante keyframes es editable; no incorpora sus renderers ni implementa su reducción espectral automática. Las bases incluidas son electrónica procedural de muestra, no un modelo que componga cualquier género desde texto. Catálogos que prohíben redistribuir sonidos independientes y pesos con licencia no comercial no forman parte de la distribución.
