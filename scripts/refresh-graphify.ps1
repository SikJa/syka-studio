param([switch]$Watch)
$ErrorActionPreference = 'Stop'
$graphifyRoot = Split-Path $PSScriptRoot -Parent
$graphifyArgs = @((Join-Path $PSScriptRoot 'graphify-runtime.py'), '--root', $graphifyRoot)
if ($Watch) { $graphifyArgs += '--watch' }
$graphifyNode = $env:SYKA_NODE_PATH
if (-not $graphifyNode) { $graphifyNode = (Get-Command node -ErrorAction Stop).Source }
$graphifyPython = & $graphifyNode (Join-Path $PSScriptRoot 'prepare-graphify.mjs')
if ($LASTEXITCODE) { throw 'No se pudo preparar Graphify en la ubicación actual.' }
$env:SYKA_NODE_PATH = $graphifyNode
& $graphifyPython @graphifyArgs
if ($LASTEXITCODE -eq 75) { Write-Host 'El actualizador de Syka ya mantiene este grafo.' }
elseif ($LASTEXITCODE) { throw 'Falló Graphify; se conserva el último índice íntegro. Consultar graphify-out/status.json.' }
