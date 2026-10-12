param(
  [Parameter(Mandatory=$true)][string]$AppDirectory,
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [Parameter(Mandatory=$true)][string]$PackagePath
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath $AppDirectory).Path
$setupFile = Get-Item -LiteralPath $SetupPath
if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'Syka Studio.exe') -PathType Leaf) -or $setupFile.PSIsContainer) { throw 'Missing Windows app or installer.' }
$binaries = @(Get-ChildItem -LiteralPath $appRoot -Recurse -File | Where-Object { $_.Extension -in @('.exe','.dll','.node') })
$report = @()
foreach ($binary in @($binaries) + @($setupFile)) {
  $signature = Get-AuthenticodeSignature -LiteralPath $binary.FullName
  $role = if ($binary.FullName -eq $setupFile.FullName) { 'setup' } elseif ($binary.FullName -eq (Join-Path $appRoot 'Syka Studio.exe')) { 'app' } else { 'dependency' }
  $report += [PSCustomObject]@{
    path = if ($role -eq 'setup') { $binary.Name } else { $binary.FullName.Substring($appRoot.Length + 1) }
    role = $role
    owned = $role -in @('setup','app') -or $binary.Name -eq 'syka-screen-recorder.exe'
    status = [string]$signature.Status
    subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    timestamped = $null -ne $signature.TimeStamperCertificate
    selfSigned = $signature.SignerCertificate -and $signature.SignerCertificate.Subject -eq $signature.SignerCertificate.Issuer
    codeSigning = $signature.SignerCertificate -and ($signature.SignerCertificate.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3')
  }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageFile = (Resolve-Path -LiteralPath $PackagePath).Path
$archive = [IO.Compression.ZipFile]::OpenRead($packageFile)
try {
  $updaters = @($archive.Entries | Where-Object { $_.Name -in @('Squirrel.exe','Update.exe') })
  if ($updaters.Count -eq 0) { throw 'The Squirrel package has no updater to verify.' }
  foreach ($entry in $updaters) {
    $temporaryFile = Join-Path $setupFile.Directory.FullName ('signature-check-' + [Guid]::NewGuid().ToString('N') + '.exe')
    try {
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $temporaryFile, $false)
      $signature = Get-AuthenticodeSignature -LiteralPath $temporaryFile
      $report += [PSCustomObject]@{
        path = 'nupkg/' + $entry.FullName
        role = 'updater'
        owned = $true
        status = [string]$signature.Status
        subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
        timestamped = $null -ne $signature.TimeStamperCertificate
        selfSigned = $signature.SignerCertificate -and $signature.SignerCertificate.Subject -eq $signature.SignerCertificate.Issuer
        codeSigning = $signature.SignerCertificate -and ($signature.SignerCertificate.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3')
      }
    } finally {
      if (Test-Path -LiteralPath $temporaryFile -PathType Leaf) { Remove-Item -LiteralPath $temporaryFile }
    }
  }
} finally { $archive.Dispose() }
ConvertTo-Json -InputObject @($report) -Depth 3 -Compress
