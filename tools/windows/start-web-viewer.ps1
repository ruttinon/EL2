$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

Write-Host "EnergyLink Management - Web Viewer" -ForegroundColor Cyan
Write-Host "Root: $ProjectRoot" -ForegroundColor DarkGray

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpm) {
  $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
}

if (-not $pnpm) {
  Write-Host "pnpm was not found. Run: corepack enable" -ForegroundColor Red
  exit 1
}

& $pnpm.Source dev:web
