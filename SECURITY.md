# Seguridad

Syka Studio trabaja con archivos locales, herramientas instaladas y, cuando el usuario las conecta, cuentas de proveedores. Un informe útil permite reproducir el problema sin exponer esos datos.

## Reportar una vulnerabilidad

Usá **Report a vulnerability** en la [página de seguridad del repositorio](https://github.com/SikJa/syka-studio/security) si GitHub ofrece ese canal. La disponibilidad del formulario depende de que los mantenedores hayan habilitado los reportes privados.

Si no aparece un canal privado, abrí un [issue](https://github.com/SikJa/syka-studio/issues) pidiendo un medio de contacto seguro, sin incluir la vulnerabilidad explotable ni información sensible. Este proyecto no publica aquí un correo de seguridad ni promete un SLA de respuesta.

Incluí por el canal privado:

- Versión o commit, sistema operativo y arquitectura.
- Componente afectado y pasos mínimos de reproducción.
- Resultado observado e impacto posible.
- Un ejemplo sintético o archivos que tengas derecho a compartir.
- Logs depurados y, si existe, una propuesta de solución.

No envíes tokens, API keys, cookies, códigos OAuth, perfiles de navegador, configuraciones de cuentas ni proyectos privados completos. Revisá también capturas, nombres de archivos y rutas de usuario.

## Versiones

El proyecto está en desarrollo; la versión upstream de paquete no constituye una política de soporte de releases de Syka. Cuando haya releases publicadas, reproducí el problema en la más reciente que puedas usar e identificá cualquier diferencia de versión.

No se garantiza mantenimiento de ramas antiguas ni corrección inmediata. Los parches publicados deben enlazar su fuente y conservar los avisos de licencia.

## Dependencias y servicios externos

Indicá si el problema está en Syka, una herramienta local, un modelo, un proveedor o un componente de terceros. El uso de un servicio externo conserva sus condiciones y canales de seguridad. Nunca pegues credenciales del servicio para demostrar el fallo.

Si se detecta una clave expuesta, revocala en el proveedor y quitá su uso; borrar el texto del último archivo no invalida la clave ni la elimina de la historia.

## Integridad de instalación

Usá el [repositorio oficial de Syka](https://github.com/SikJa/syka-studio) y sus [Releases](https://github.com/SikJa/syka-studio/releases). El helper de instalación Windows comprueba el SHA-256 publicado para el instalador antes de ejecutarlo. Una comprobación de hash confirma que el archivo coincide con ese checksum; no equivale a una firma de editor ni a una auditoría de seguridad.

La firma del instalador, su disponibilidad y las pruebas de instalación deben identificarse en cada release. macOS permanece en preparación hasta completar su validación.

El bootstrap de herramientas descarga versiones fijadas de los proyectos originales y verifica sus SHA-256 antes de usarlas. La primera ejecución requiere Internet. Reportá también cualquier discrepancia entre origen, versión y checksum de una herramienta; no reemplaces el archivo por un mirror desconocido para sortear ese error.
