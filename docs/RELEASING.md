# Releases de Syka Studio para Windows

El repositorio de distribución es [SikJa/syka-studio](https://github.com/SikJa/syka-studio). La primera versión de esta línea es **0.208.0**. El repositorio `diffusionstudio/editor` es upstream: no es el destino de los tags ni de los instaladores de Syka.

El recorrido del pipeline firmado es **código revisado → versión y commit → tag local → push explícito del tag → build de Windows → draft beta → revisión → publicación manual**. Para ofrecer la versión desde la app, la publicación final debe ser normal y Latest. Cambiar código o subir un commit no ofrece una actualización a las instalaciones existentes. Hace falta publicar una nueva versión con todos sus archivos de actualización.

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
npm run build:installer -- --preflight-only
npm run build:installer
```

El preflight exige al menos **10 GiB libres** en el disco del checkout. La validación final exige que queden **2 GiB de reserva**. El comando falla si no hay espacio; no elimina archivos para hacer lugar. Las cachés de npm, Electron y Cargo y los temporales de la compilación se ubican en `.runtime/windows-build`; el target nativo de Rust está en `.runtime/screen-recorder-target`.

`build:installer` ejecuta `npm run make --workspace=@diffusionstudio/desktop -- --platform=win32 --arch=x64`. Ese make ya compila y stagea el host, la web, la CLI, el runtime, la documentación y el grabador nativo. Después se verifica la **aplicación empaquetada**, incluidos sus recursos, arquitectura y versión. No se instala ni se publica nada.

`SKIP_SIGN=1` sólo se pasa al proceso de make si se recibió `--unsigned`. Una variable heredada `SKIP_SIGN` no habilita una compilación sin firma. Para compilar con firma:

```powershell
npm run build:installer
```

La firma requiere una identidad pública validada y `WINDOWS_SIGN_PUBLISHER`. Admite Artifact Signing o un certificado con token/HSM en el almacén de Windows. Ver [WINDOWS-SIGNING.md](WINDOWS-SIGNING.md) para las variables y el entorno de GitHub. El workflow no provisiona certificados ni contrata servicios: falla si falta la identidad de firma. El build exige firmas Authenticode válidas y selladas, además de los hashes de distribución.

`--unsigned` está disponible para QA local. La publicación manual v0.208.1 usa el paquete verificado sin firma y se ofrece como release normal y Latest para permitir la actualización desde la app. La ausencia de firma permanece visible en las notas y en los README. Esta excepción no modifica el workflow firmado por tags ni habilita un fallback silencioso. Las publicaciones manuales necesitan revisión del paquete completo y su fuente exacta; no presentar esa compilación como si resolviera la confianza de Windows.

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

El workflow `.github/workflows/release.yml` tiene un build de Windows independiente de Mac. Usa Node 24, `npm ci`, Cargo para el grabador nativo y `build:installer` con Artifact Signing autenticado por OIDC. Exige el entorno `windows-signing`, comprueba los números de versión contra el tag, las firmas y la distribución, y sube el conjunto como artefacto durante 14 días. Hasta provisionar la identidad pública el pipeline firmado falla antes de compilar. La excepción manual v0.208.1 usa un paquete local verificado y crea el tag desde la release de GitHub sobre su commit exacto; su run firmado se bloqueó por la identidad faltante y no produjo los artefactos publicados.

El job de build tiene permiso de lectura del repo. Sólo `draft-windows` tiene `contents: write`: descarga el artefacto de ese mismo run, vuelve a verificar los hashes y el feed y crea un **draft prerelease** mediante [GitHub CLI](https://cli.github.com/manual/gh_release_create). No publica un release estable. Una repetición puede reemplazar archivos del mismo draft beta; un release publicado o un draft estable existente queda bloqueado.

La validación completa de una publicación incluye otro Windows x64: arranque, preparación de herramientas, importación, exportación, grabación y actualización desde una versión anterior cuando exista. Revisá la firma, las notas y el conjunto de archivos en [Releases](https://github.com/SikJa/syka-studio/releases). v0.208.0 salió como beta y v0.208.1 se publica como actualización normal; ambas siguen sin firma pública. La detección y descarga de 0.208.1 desde GitHub se verificaron con el actualizador nativo y el controlador de 0.208.0. La aplicación del paquete, el reinicio y la instalación en otro equipo siguen pendientes y no se certifican por marcar la release como normal.

El canal normal de Syka consulta `releases/latest`: **los drafts y las prereleases no notifican una actualización**. Para ofrecerla desde la app, publicá la release con **Set as a pre-release desmarcado** y marcala como Latest, con Setup, RELEASES y nupkg completos. La firma Authenticode es una condición independiente de esos metadatos: su ausencia no impide técnicamente detectar o descargar la actualización. El pipeline firmado sigue requiriendo una identidad pública; no genera ni publica automáticamente un paquete sin firma.

Después de publicar, actualizar el botón de descarga de `README.md`, `README.en.md` y `README.pt-BR.md` para que apunte al instalador publicado. La beta inicial usa su URL directa porque todavía no hay una release estable. Al publicar la primera estable, usar `https://github.com/SikJa/syka-studio/releases/latest/download/Syka-Studio-x64-Setup.exe`: esa dirección seguirá la última estable sin cambiar los README en cada versión. No apuntar el botón a una versión que sólo exista como draft.

Estos checks cubren versiones, estructura y hashes. La compilación exitosa no reemplaza una instalación de prueba ni verifica por sí sola el bootstrap de herramientas, los codecs o una actualización real en otro equipo. Mac requiere un build en macOS y sus propios controles de firma/notarización; no bloquea el pipeline de Windows.
