param([switch]$Watch)
$ErrorActionPreference = 'Stop'
$graphifyRoot = Split-Path $PSScriptRoot -Parent
$graphifyArgs = @((Join-Path $PSScriptRoot 'graphify-runtime.py'), '--root', $graphifyRoot)
if ($Watch) { $graphifyArgs += '--watch' }
& (Join-Path $graphifyRoot '.runtime/graphify/Scripts/python.exe') @graphifyArgs
if ($LASTEXITCODE -eq 75) { Write-Host 'El actualizador de Syka ya mantiene este grafo.' }
elseif ($LASTEXITCODE) { throw 'Falló Graphify; se conserva el último índice íntegro. Consultar graphify-out/status.json.' }
