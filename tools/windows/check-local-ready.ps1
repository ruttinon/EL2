$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

Write-Host "EnergyLink Local Readiness Check" -ForegroundColor Cyan
Write-Host "Root: $ProjectRoot" -ForegroundColor DarkGray

$required = @(
  "package.json",
  "pnpm-workspace.yaml",
  "apps/editor-desktop/package.json",
  "apps/engine/package.json",
  "apps/monitor-desktop/package.json",
  "apps/web-viewer/package.json",
  "prisma/schema.prisma"
)

$failed = 0
foreach ($item in $required) {
  if (Test-Path (Join-Path $ProjectRoot $item)) {
    Write-Host "PASS $item" -ForegroundColor Green
  } else {
    Write-Host "FAIL $item" -ForegroundColor Red
    $failed++
  }
}

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpm) { $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue }
if ($pnpm) { Write-Host "PASS pnpm: $($pnpm.Source)" -ForegroundColor Green } else { Write-Host "FAIL pnpm not found" -ForegroundColor Red; $failed++ }

$node = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $node) { $node = Get-Command "node" -ErrorAction SilentlyContinue }
if ($node) { Write-Host "PASS node: $($node.Source)" -ForegroundColor Green } else { Write-Host "FAIL node not found" -ForegroundColor Red; $failed++ }

if ($failed -gt 0) {
  Write-Host "Readiness check failed: $failed" -ForegroundColor Red
  exit 1
}

Write-Host "Ready for local run." -ForegroundColor Green
