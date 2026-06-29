# EnergyLink Management uninstall helper
# Run as Administrator. ProgramData is kept by default to prevent data loss.

param(
  [string]$ProgramFilesRoot = "C:\Program Files\EnergyLink Management",
  [string]$ProgramDataRoot = "C:\ProgramData\EnergyLink Management",
  [switch]$RemoveData
)

function Require-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    throw "This uninstaller must be run as Administrator."
  }
}

Require-Admin

$ServiceWrapper = "$ProgramFilesRoot\Engine\service-wrapper.exe"
if (Test-Path $ServiceWrapper) {
  & $ServiceWrapper stop 2>$null
  & $ServiceWrapper uninstall 2>$null
}

Remove-Item -Recurse -Force $ProgramFilesRoot -ErrorAction SilentlyContinue

$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "EnergyLink Management"
Remove-Item -Force (Join-Path $Desktop "EnergyLink Editor.lnk") -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $Desktop "EnergyLink Monitor.lnk") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $StartMenu -ErrorAction SilentlyContinue

if ($RemoveData) {
  Remove-Item -Recurse -Force $ProgramDataRoot -ErrorAction SilentlyContinue
  Write-Host "ProgramData removed."
} else {
  Write-Host "ProgramData was kept intentionally: $ProgramDataRoot"
}

Write-Host "EnergyLink Management uninstalled."
