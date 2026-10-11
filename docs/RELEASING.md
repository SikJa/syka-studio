# Releases de Syka Studio para Windows

El repositorio de distribución es [SikJa/syka-studio](https://github.com/SikJa/syka-studio). La primera versión de esta línea es **0.208.0**. El repositorio `diffusionstudio/editor` es upstream: no es el destino de los tags ni de los instaladores de Syka.

El recorrido es **código revisado → versión y commit → tag local → push explícito del tag → build de Windows → draft beta → revisión → publicación manual**. Cambiar código o subir un commit no ofrece una actualización a las instalaciones existentes. Hace falta publicar una nueva versión con todos sus archivos de actualización.

## Probar la interfaz de actualización

Desde un checkout de desarrollo con las dependencias instaladas:

```powershell
npm run preview:updates
```

Abre una ventana de Syka con un perfil separado en `.runtime/update-demo`, sin usar tus proyectos ni tu sesión habitual. Permite probar **actualización disponible → descargar → reiniciar e instalar → repetir simulación**. Los datos de versión y la descarga son simulados; al confirmar se reinicia solamente esa ventana de prueba. No instala un paquete ni publica una release.

El comando compila el código de la aplicación y usa los puertos locales 5198 y 6295. No compila un instalador. La simulación está restringida al arranque de desarrollo y a ese perfil; no puede activarse en una instalación de distribución.

El recorrido de interfaz, la confirmación con **Después** y el reinicio de esa ventana se verificaron localmente. Una actualización real entre dos versiones instaladas sigue pendiente. La beta `v0.208.0` publicada no se ofrece por el canal estable.

## Build local

Requisitos: Windows x64, Node.js 24, npm, Rust/Cargo con el toolchain `x86_64-pc-windows-msvc`, las herramientas de compilación C++ de Visual Studio y el SDK de Windows. Los cuatro `package.json` de raíz/desktop/CLI/web y sus entradas del lockfile deben tener la misma versión.

Desde la raíz del repo:

```powershell
npm ci --no-audit --no-fund
npm run build:installer -- --unsigned --preflight-only
npm run build:installer -- --unsigned
```

El preflight exige al menos **10 GiB libres** en el disco del checkout. La validación final exige que queden **2 GiB de reserva**. El comando falla si no hay espacio; no elimina archivos para hacer lugar. Las cachés de npm, Electron y Cargo y los temporales de la compilación se ubican en `.runtime/windows-build`; el target nativo de Rust está en `.runtime/screen-recorder-target`.

`build:installer` ejecuta `npm run make --workspace=@diffusionstudio/desktop -- --platform=win32 --arch=x64`. Ese make ya compila y stagea el host, la web, la CLI, el runtime, la documentación y el grabador nativo. Después se verifica la **aplicación empaquetada**, incluidos sus recursos, arquitectura y versión. No se instala ni se publica nada.

`SKIP_SIGN=1` sólo se pasa al proceso de make si se recibió `--unsigned`. Una variable heredada `SKIP_SIGN` no habilita una compilación sin firma. Para compilar con firma:

```powershell
npm run build:installer
```

La firma requiere `WINDOWS_SIGNTOOL_PATH`, `WINDOWS_SIGN_DLIB` y `WINDOWS_SIGN_METADATA` apuntando a la configuración existente de Artifact Signing. El flujo actual de GitHub no provisiona un certificado: produce una **beta sin firma**. Que los archivos pasen los checks de distribución y hashes no prueba por sí solo la confianza de Authenticode en otro equipo.

Para revisar una compilación existente sin volver a compilar:

```powershell
npm run build:installer -- --verify-only
```

## Archivos de distribución

El conjunto final se deja plano en `apps/desktop/out/make/`:

- **`Syka-Studio-x64-Setup.exe`**: nombre fijo del instalador de Windows x64.
- **`RELEASES`**: índice que usa Squirrel.Windows.
- **El `.nupkg` completo de esa versión** y cualquier delta que figure en `RELEASES`.
- **`SHA256SUMS`**: hashes de todos los archivos del conjunto; las rutas son sus nombres, sin subcarpetas.
- El ZIP de esa versión, si lo produjo Forge. Es un archivo adicional; la actualización necesita el instalador y el feed de Squirrel.

**Setup, RELEASES y nupkg se entregan juntos y conservan sus nombres.** No se renombra un nupkg después de generar `RELEASES`. Se comprueban sus tamaños y SHA1 contra el feed de Squirrel, además de los SHA256 de todo el conjunto. `SHA256SUMS` es también la lista de los archivos de esta compilación: otros resultados viejos que haya en `out/make` no forman parte del release.

En el primer arranque, Syka prepara automáticamente Node, FFmpeg y yt-dlp desde los upstream configurados en `runtime/toolchain.json`, con URLs/versiones y SHA256 fijados. Esa preparación necesita conexión a Internet. El instalador incluye el manifiesto y sus recursos necesarios; el build no instala estas herramientas en el equipo del desarrollador como prueba de funcionamiento en otro PC.

## Preparar la versión y el tag

Configurá un remoto propio una sola vez. Si `syka` ya existe, inspeccioná su destino antes de cambiarlo:

```powershell
git remote add syka https://github.com/SikJa/syka-studio.git
git remote get-url --push --all syka
```

`release.mjs` sólo permite pushes a `SikJa/syka-studio`, tanto por HTTPS como por SSH, y verifica **todas** las URLs de push. Usar `--remote=origin` cuando origin sigue apuntando a Diffusion queda bloqueado. El script nunca hace un push implícito ni usa force, mirror o todos los tags.

Para una versión posterior, partí de un checkout limpio y prepará los números:

```powershell
npm run release -- prepare patch --dry-run
npm run release -- prepare patch
```

También acepta `minor`, `major` o una versión exacta, por ejemplo `prepare 0.208.0`. La preparación cambia los cuatro manifests y refresca `package-lock.json` con scripts de instalación deshabilitados. **No hace commit ni tag.** Si falla el refresco, restaura esos archivos. Revisá el diff y hacé el commit de los cambios aprobados. No se hace stash automático de cambios pendientes.

Para la primera versión ya preparada en 0.208.0:

```powershell
npm run release -- check --tag=v0.208.0 --remote=syka
npm run release -- tag --remote=syka --dry-run
npm run release -- tag --remote=syka
```

El tag anotado apunta al commit revisado. Un tag existente que apunta a otro commit no se mueve. Etiquetar no contacta al servidor de GitHub. El push se pide aparte:

```powershell
npm run release -- push --remote=syka --dry-run
npm run release -- push --remote=syka
```

El push sólo envía el tag de la versión actual y exige que coincida con HEAD. Subir la rama de código es una decisión separada; no lo hace este script. Un tag `v*` válido en el repo propio dispara el workflow de release.

## GitHub Actions y revisión del draft

El workflow `.github/workflows/release.yml` tiene un build de Windows independiente de Mac. Usa Node 24, `npm ci`, Cargo para el grabador nativo y `build:installer -- --unsigned`. Comprueba los números de versión contra el tag, valida la distribución y sube el conjunto como artefacto durante 14 días.

El job de build tiene permiso de lectura del repo. Sólo `draft-windows` tiene `contents: write`: descarga el artefacto de ese mismo run, vuelve a verificar los hashes y el feed y crea un **draft prerelease** mediante [GitHub CLI](https://cli.github.com/manual/gh_release_create). No publica un release estable. Una repetición puede reemplazar archivos del mismo draft beta; un release publicado o un draft estable existente queda bloqueado.

Antes de promover una versión a estable, probá el instalador en otro Windows x64: arranque, preparación de herramientas, importación, exportación, grabación y actualización desde una versión anterior cuando exista. Verificá la firma si corresponde y revisá las notas y el conjunto de archivos del draft en [Releases](https://github.com/SikJa/syka-studio/releases). La beta inicial puede publicarse con la instalación en otra PC y el upgrade entre dos versiones claramente documentados como pendientes; esa publicación no certifica esos recorridos ni habilita una actualización estable.

La publicación de esta beta se hace manualmente desde el draft, manteniendo **Set as a pre-release**. El canal estable de Syka consulta `releases/latest`: **los drafts y las prereleases no notifican una actualización estable**. Para ofrecer una actualización estable hay que preparar y revisar una versión estable publicada con Setup, RELEASES y nupkg; el flujo de firma debe configurarse antes de convertir el pipeline en uno de releases estables. No se promociona automáticamente esta beta sin firma.

Después de publicar, actualizar el botón de descarga de `README.md`, `README.en.md` y `README.pt-BR.md` para que apunte al instalador publicado. La beta inicial usa su URL directa porque todavía no hay una release estable. Al publicar la primera estable, usar `https://github.com/SikJa/syka-studio/releases/latest/download/Syka-Studio-x64-Setup.exe`: esa dirección seguirá la última estable sin cambiar los README en cada versión. No apuntar el botón a una versión que sólo exista como draft.

Estos checks cubren versiones, estructura y hashes. La compilación exitosa no reemplaza una instalación de prueba ni verifica por sí sola el bootstrap de herramientas, los codecs o una actualización real en otro equipo. Mac requiere un build en macOS y sus propios controles de firma/notarización; no bloquea el pipeline de Windows.
