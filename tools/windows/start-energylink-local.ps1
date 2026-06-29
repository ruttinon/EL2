$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

Write-Host "EnergyLink Management - Local Run" -ForegroundColor Cyan
Write-Host "Root: $ProjectRoot" -ForegroundColor DarkGray

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpm) {
  $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
}

if (-not $pnpm) {
  Write-Host "pnpm was not found. Run: corepack enable" -ForegroundColor Red
  exit 1
}

function Open-ToolWindow {
  param(
    [string]$Title,
    [string]$ScriptName
  )

  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  $command = "Set-ExecutionPolicy -Scope Process Bypass; & '$scriptPath'"

  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $command
  ) -WorkingDirectory $ProjectRoot -WindowStyle Normal | Out-Null

  Write-Host "Opened: $Title" -ForegroundColor Green
}

Open-ToolWindow "Engine" "start-engine.ps1"
Start-Sleep -Seconds 2
Open-ToolWindow "Editor" "start-editor.ps1"

Write-Host ""
Write-Host "EnergyLink local run started." -ForegroundColor Green
Write-Host "Use start-monitor.ps1 or start-web-viewer.ps1 when needed." -ForegroundColor Gray
