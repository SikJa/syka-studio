# Contribuir a Syka Studio

Gracias por ayudar a mejorar Syka. El proyecto deriva de Diffusion Studio y conserva su base MPL. Los cambios deben respetar el código existente, los recursos del usuario y los avisos de terceros.

## Preparar el entorno

Para desarrollo necesitás Git, Node.js **22.12 o posterior** y npm:

```sh
git clone https://github.com/SikJa/syka-studio.git
cd syka-studio
npm ci
npm run dev
```

El launcher usa el puerto 5188; si está ocupado, revisá el proceso y no cierres aplicaciones ajenas para liberarlo. Consultá [OPEN_SOURCE_SETUP.md](OPEN_SOURCE_SETUP.md) para elegir rutas del runtime y herramientas opcionales.

El empaquetado de escritorio tiene requisitos adicionales: el helper Windows necesita Rust, y los recursos de medios deben prepararse para la arquitectura destino. Ver [INSTALLATION_PREPARATION.md](docs/INSTALLATION_PREPARATION.md). El soporte de instalación macOS está en preparación.

La instalación inicial prepara automáticamente las herramientas locales faltantes mediante descargas upstream verificadas. Requiere Internet. No copies al instalador un ejecutable de FFmpeg del PATH del desarrollador sin revisar sus licencias y obligaciones de distribución.

## Proponer un cambio

Abrí un [issue](https://github.com/SikJa/syka-studio/issues) para discutir cambios de arquitectura o nuevas integraciones. Para un bug, incluí versión/commit, sistema operativo, pasos y resultado esperado/observado. Un ejemplo mínimo con material que puedas compartir ayuda más que una carpeta entera del proyecto.

Mantené los PR enfocados. Explicá el problema, el comportamiento resultante y qué comprobaste. Distinguí tests con fixtures, verificación local y una prueba real de proveedor o publicación. La presencia de un ejecutable o un login no demuestra que su integración funcione.

No agregues claves, perfiles, sesiones, proyectos personales, archivos `.env`, bibliotecas privadas ni rutas que dependan de una unidad del desarrollador. No uses datos reales de cuentas para pruebas automatizadas.

## Verificación

Ejecutá las comprobaciones relevantes a tu cambio:

```sh
npm run check
npm run lint
npm test
```

Para cambios en paquetes de contenido o en la preparación de distribución:

```sh
npm run test:content
npm run test:distribution
```

`npm run check:distribution` necesita recursos ya preparados: es un preflight del paquete, no un instalador de dependencias. Para cambios visuales, verificá también la interfaz a las dimensiones afectadas. Para cambios de medios, comprobá el archivo exportado, no sólo el preview.

Si un check falla por una condición previa o por el entorno, registrá el comando y la causa; no lo presentes como aprobado.

## Procedencia y licencias

Por defecto, el código aportado sigue [MPL-2.0](LICENSE). Una modificación de un archivo MPL, o un archivo nuevo que contenga código MPL, continúa bajo MPL. Los componentes con licencia específica conservan sus condiciones; ver [LICENSE_POLICY.md](LICENSE_POLICY.md).

Conservás el copyright de tu aporte. Enviar un PR no cede tus derechos ni autoriza automáticamente a cerrar o relicenciar tu contribución. No se requiere un CLA implícito.

Si copiás o adaptás material externo, agregá:

- URL de origen y commit/versión inspeccionada.
- Licencia completa, copyright y NOTICE que correspondan.
- Descripción de las modificaciones.
- Licencias de dependencias y recursos asociados.

No atribuyas a Syka código ajeno ni marques un material como MIT si tiene Commons Clause, una licencia propia u otra restricción. Si un origen no está claro, señalalo para revisión antes de incorporarlo.

## Seguridad

Para vulnerabilidades o filtraciones, seguí [SECURITY.md](SECURITY.md). No publiques tokens, cookies, datos de cuentas ni detalles explotables en un issue abierto.
