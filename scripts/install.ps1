# Syka Studio Windows installer bootstrap. Review this script before running it.
# Uses only public release artifacts; never requires a GitHub token.
param([switch]$DownloadOnly, [string]$Destination = (Join-Path $env:TEMP 'Syka-Install'))
$ErrorActionPreference = 'Stop'
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This installer supports Windows x64. ARM64 has not been validated.' }
$sykaRepo = 'SikJa/syka-studio'
$sykaReleasePage = "https://github.com/$sykaRepo/releases"
function Get-SykaPublicRelease {
  param([string]$Repository)
  $sykaApi = "https://api.github.com/repos/$Repository"
  $sykaPage = "https://github.com/$Repository/releases"
  $sykaHeaders = @{Accept='application/vnd.github+json'; 'User-Agent'='Syka-Studio-Install'}
  $sykaLatest = $null
  try {
    $sykaLatest = Invoke-RestMethod -Uri "$sykaApi/releases/latest" -Headers $sykaHeaders
  } catch {
    $sykaStatus = $null
    if ($null -ne $_.Exception.Response) {
      try { $sykaStatus = [int]$_.Exception.Response.StatusCode } catch { }
    }
    if ($sykaStatus -ne 404) {
      throw "Could not retrieve the public Syka Studio release. Check your connection and $sykaPage, then retry. No installer was downloaded or executed."
    }
  }
  if ($null -ne $sykaLatest) {
    if ($sykaLatest.draft -ne $false -or $sykaLatest.prerelease -ne $false -or $sykaLatest.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw "The latest public Syka release is not compatible. Check $sykaPage." }
    return $sykaLatest
  }

  # GitHub /latest excludes prereleases. Published betas can still be
  # installed explicitly through this bootstrap; the app's stable updater is separate.
  try {
    $sykaPublicReleases = Invoke-RestMethod -Uri "$sykaApi/releases?per_page=100" -Headers $sykaHeaders
  } catch {
    $sykaStatus = $null
    if ($null -ne $_.Exception.Response) {
      try { $sykaStatus = [int]$_.Exception.Response.StatusCode } catch { }
    }
    if ($sykaStatus -eq 404) {
      throw "No public Syka Studio release was found after the GitHub HTTP 404. The repository or first release may not yet be public. Check $sykaPage and retry. No installer was downloaded or executed."
    }
    throw "Could not list public Syka Studio releases. Check your connection and $sykaPage, then retry. No installer was downloaded or executed."
  }
  $sykaCandidates = @($sykaPublicReleases | Where-Object {
    $_.draft -eq $false -and ($_.prerelease -eq $true -or $_.prerelease -eq $false) -and
    $_.tag_name -match '^v\d+\.\d+\.\d+$' -and [string]$_.id -match '^\d+$' -and
    @($_.assets | Where-Object { $_.name -eq 'Syka-Studio-x64-Setup.exe' }).Count -eq 1 -and
    @($_.assets | Where-Object { $_.name -eq 'SHA256SUMS' }).Count -eq 1
  })
  if ($sykaCandidates.Count -eq 0) { throw "No compatible Windows x64 Syka release has been published yet. Drafts cannot be installed. Check $sykaPage. No installer was downloaded or executed." }
  $sykaStableCandidates = @($sykaCandidates | Where-Object { $_.prerelease -eq $false })
  if ($sykaStableCandidates.Count -gt 0) { $sykaCandidates = $sykaStableCandidates }
  $sykaSelected = $sykaCandidates | Sort-Object -Property published_at -Descending | Select-Object -First 1
  try {
    $sykaReadback = Invoke-RestMethod -Uri "$sykaApi/releases/$($sykaSelected.id)" -Headers $sykaHeaders
  } catch {
    throw "Could not verify the selected public Syka release. Retry or check $sykaPage. No installer was downloaded or executed."
  }
  if ($sykaReadback.draft -ne $false -or $sykaReadback.prerelease -ne $sykaSelected.prerelease -or $sykaReadback.tag_name -ne $sykaSelected.tag_name -or [string]$sykaReadback.id -ne [string]$sykaSelected.id) { throw 'The selected release changed after listing. Retry; no installer was downloaded or executed.' }
  return $sykaReadback
}
$sykaRelease = Get-SykaPublicRelease -Repository $sykaRepo
if ($sykaRelease.prerelease) { Write-Host "Installing the published Syka beta $($sykaRelease.tag_name). Review its release notes at $sykaReleasePage." }
$sykaInstaller = @($sykaRelease.assets | Where-Object { $_.name -eq 'Syka-Studio-x64-Setup.exe' })
$sykaChecksums = @($sykaRelease.assets | Where-Object { $_.name -eq 'SHA256SUMS' })
if ($sykaInstaller.Count -ne 1 -or $sykaChecksums.Count -ne 1) { throw 'The release is incomplete. Download it from the Releases page when it is ready.' }
$sykaPrefix = "https://github.com/$sykaRepo/releases/download/$($sykaRelease.tag_name)/"
foreach ($sykaAsset in @($sykaInstaller[0], $sykaChecksums[0])) {
  if (-not $sykaAsset.browser_download_url.StartsWith($sykaPrefix, [StringComparison]::Ordinal)) { throw 'Unexpected release download address.' }
}
$sykaFolder = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path $sykaFolder | Out-Null
$sykaExe = Join-Path $sykaFolder 'Syka-Studio-x64-Setup.exe'
$sykaSumFile = Join-Path $sykaFolder 'SHA256SUMS'
Write-Host "Downloading Syka Studio $($sykaRelease.tag_name)..."
Invoke-WebRequest -Uri $sykaChecksums[0].browser_download_url -OutFile $sykaSumFile -UseBasicParsing
$sykaMatch = @(Get-Content -LiteralPath $sykaSumFile | Where-Object { $_ -match '^([a-fA-F0-9]{64})\s+\*?Syka-Studio-x64-Setup\.exe$' })
if ($sykaMatch.Count -ne 1) { throw 'Missing installer checksum.' }
$sykaExpected = ([regex]::Match($sykaMatch[0], '^[a-fA-F0-9]{64}')).Value
Invoke-WebRequest -Uri $sykaInstaller[0].browser_download_url -OutFile "$sykaExe.partial" -UseBasicParsing
$sykaActual = (Get-FileHash -LiteralPath "$sykaExe.partial" -Algorithm SHA256).Hash
if ($sykaActual -ne $sykaExpected) { Remove-Item -LiteralPath "$sykaExe.partial"; throw 'Checksum mismatch. The installer was not executed.' }
Move-Item -LiteralPath "$sykaExe.partial" -Destination $sykaExe -Force
if ($DownloadOnly) { Write-Host "Verified installer: $sykaExe"; return }
Write-Host 'Starting the installer. Projects and settings are kept in your user profile.'
Start-Process -FilePath $sykaExe -Wait
