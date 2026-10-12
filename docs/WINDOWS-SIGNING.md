# Firma pública de Windows

Estado de v0.208.1: beta manual de prueba sin firma, autorizada el 2026-10-12 para descargar y probar los conectores. El certificado/servicio de firma todavía está pendiente; esta beta no cumple la entrega firmada solicitada ni se ofrece por el canal estable. Ver [RELEASING.md](RELEASING.md) para esa excepción y el flujo de publicación.

La firma Authenticode identifica al publicador y protege la integridad del archivo. SmartScreen también evalúa reputación: ni una firma válida ni un certificado EV garantizan la desaparición inmediata de avisos. No se deben desactivar Defender/SmartScreen ni usar certificados autofirmados para presentar una descarga pública como confiable.

## Certificado del publicador

Se necesita una identidad de firma pública validada. No guardar claves privadas, contraseñas, tokens, certificados privados ni metadata de cuenta en el repositorio.

- Microsoft Artifact Signing: requiere identidad validada, perfil **Public Trust**, rol Certificate Profile Signer y una suscripción. Los desarrolladores individuales deben estar en EE.UU. o Canadá; comprobar la lista vigente para organizaciones antes de contratarlo. El precio Basic publicado empieza en USD 9.99/mes.
- Certificado de una CA reconocida con token/HSM: usar el certificado accesible en `Cert:\CurrentUser\My`; la clave permanece en el dispositivo/proveedor. Consultar admisión por país y costos con la CA elegida.
- SignPath Foundation: posible alternativa gratuita para proyectos completamente open source, sujeta a revisión y aceptación. El publicador sería SignPath Foundation. Sus reglas no permiten firmar los binarios de terceros con el certificado del proyecto; necesita una integración distinta, no utilizar el firmado recursivo de Forge sin adaptar ese alcance.

No se contrató ningún servicio ni se generó un certificado de prueba.

## Build local con identidad existente

Configurar variables de entorno fuera del código:

| Variable | Uso |
| --- | --- |
| `WINDOWS_SIGNTOOL_PATH` | Ruta absoluta al SignTool x64 del Windows SDK. |
| `WINDOWS_SIGN_PUBLISHER` | Subject completo del certificado público esperado, tal como lo devuelve Windows. |
| `WINDOWS_SIGN_DLIB`, `WINDOWS_SIGN_METADATA` | Cliente x64 y metadata privada para Artifact Signing. |
| `WINDOWS_SIGN_CERT_SHA1` | Alternativa: huella de 40 caracteres del certificado de firma en CurrentUser/My. Selecciona el certificado; el hash del archivo es SHA256. |
| `WINDOWS_TIMESTAMP_SERVER` | Opcional: TSA RFC3161 admitida por el proveedor. |

Elegir **Artifact Signing o certificado del almacén**, sin mezclar ambos.

```powershell
npm run build:installer -- --preflight-only
npm run build:installer
npm run build:installer -- --verify-only
```

Forge firma la app, los binarios nativos y el instalador con SHA256 y sello de tiempo RFC3161. El verificador consulta `Get-AuthenticodeSignature`: exige confianza de Windows, EKU de code signing y sello de tiempo. La app, el instalador y el grabador de Syka deben tener el Subject configurado. Un build firmado que no cumple falla; no pasa automáticamente al modo sin firma.

`--unsigned` continúa siendo explícito para pruebas locales. `--verify-only --unsigned` valida estructura y hashes, sin certificar confianza de Windows.

## GitHub Actions con Microsoft Artifact Signing

La publicación por tags sigue creando un draft beta. El workflow ahora exige firma; no genera una release sin firma cuando falta configuración.

Crear el entorno `windows-signing` y configurar sus variables, sin claves privadas:

`WINDOWS_SIGNING_ENABLED=true`, `WINDOWS_SIGN_PUBLISHER`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `WINDOWS_SIGN_ENDPOINT`, `WINDOWS_SIGN_ACCOUNT`, `WINDOWS_SIGN_PROFILE`.

En Azure, la credencial federada de la aplicación debe corresponder a `repo:SikJa/syka-studio:environment:windows-signing`, audiencia `api://AzureADTokenExchange`. Asignar únicamente el rol de firmante sobre el perfil Public Trust. La cuenta y la identidad deben existir y estar aprobadas antes de habilitar el workflow; agregar variables no las crea.

La sesión se obtiene con OIDC, sin client secret. El cliente de Microsoft está fijado a `Microsoft.ArtifactSigning.Client` 1.0.146 y usa `AzureCliCredential`. La metadata se genera en `.runtime/windows-signing`, fuera de las fuentes publicadas.

La integración externa no pudo ejecutarse sin cuenta/certificado. Antes de publicar, hacer el build firmado real, verificar todos sus artefactos y probar la descarga/instalación en un Windows limpio. Para una CA distinta, usar el build local con token/HSM o configurar su firmante de CI; no reutilizar una identidad de Azure inventada.

## Documentación oficial

- [SmartScreen y reputación](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- [Disponibilidad y validación de Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- [SignTool y sellado de tiempo de Microsoft](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)
- [Precio y condiciones de Microsoft](https://azure.microsoft.com/en-us/products/artifact-signing)
- [Firma de Windows en Electron Forge](https://www.electronforge.io/guides/code-signing/code-signing-windows)
- [Condiciones de SignPath Foundation](https://signpath.org/terms)
