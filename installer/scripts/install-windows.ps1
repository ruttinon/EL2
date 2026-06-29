# EnergyLink Management Windows install script
# Must be run as Administrator from the packaged installer layout or release folder.
# This script creates the Program Files / ProgramData layout and registers EnergyLink Engine as a Windows Service.

param(
  [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\release\install-layout")).Path,
  [string]$ProgramFilesRoot = "C:\Program Files\EnergyLink Management",
  [string]$ProgramDataRoot = "C:\ProgramData\EnergyLink Management",
  [switch]$SkipServiceInstall
)

function Require-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    throw "This installer must be run as Administrator."
  }
}

function New-Dir($Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Copy-IfExists($Source, $Destination) {
  if (Test-Path $Source) {
    New-Dir $Destination
    Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  }
}

Require-Admin

$ProgramFilesSource = Join-Path $SourceRoot "Program Files\EnergyLink Management"
$ProgramDataSource = Join-Path $SourceRoot "ProgramData\EnergyLink Management"

New-Dir "$ProgramFilesRoot\Editor"
New-Dir "$ProgramFilesRoot\Monitor"
New-Dir "$ProgramFilesRoot\Engine"
New-Dir "$ProgramFilesRoot\WebViewer\dist"

New-Dir "$ProgramDataRoot\config"
New-Dir "$ProgramDataRoot\data"
New-Dir "$ProgramDataRoot\logs"
New-Dir "$ProgramDataRoot\graphics"
New-Dir "$ProgramDataRoot\reports"
New-Dir "$ProgramDataRoot\images"
New-Dir "$ProgramDataRoot\drivers"
New-Dir "$ProgramDataRoot\backups"

Copy-IfExists "$ProgramFilesSource\Editor" "$ProgramFilesRoot\Editor"
Copy-IfExists "$ProgramFilesSource\Monitor" "$ProgramFilesRoot\Monitor"
Copy-IfExists "$ProgramFilesSource\Engine" "$ProgramFilesRoot\Engine"
Copy-IfExists "$ProgramFilesSource\WebViewer\dist" "$ProgramFilesRoot\WebViewer\dist"

# Do not overwrite real customer data/config unless it does not exist.
if (!(Test-Path "$ProgramDataRoot\config\engine.json")) {
  $EngineConfig = @{
    engineName     = "EnergyLink Local Engine"
    port           = 8081
    apiHost        = "0.0.0.0"
    database       = "$ProgramDataRoot\data\energylink.db"
    dataFolder     = "$ProgramDataRoot\data"
    logFolder      = "$ProgramDataRoot\logs"
    graphicsFolder = "$ProgramDataRoot\graphics"
    reportsFolder  = "$ProgramDataRoot\reports"
    imagesFolder   = "$ProgramDataRoot\images"
    driversFolder  = "$ProgramDataRoot\drivers"
    backupsFolder  = "$ProgramDataRoot\backups"
    autoStart      = $true
    logLevel       = "info"
    serviceMode    = $true
  } | ConvertTo-Json -Depth 5
  Set-Content -Path "$ProgramDataRoot\config\engine.json" -Value $EngineConfig -Encoding UTF8
}

if (Test-Path "$ProgramDataSource\data\energylink.db") {
  if (!(Test-Path "$ProgramDataRoot\data\energylink.db")) {
    Copy-Item "$ProgramDataSource\data\energylink.db" "$ProgramDataRoot\data\energylink.db" -Force
  }
}

Copy-IfExists "$ProgramDataSource\drivers" "$ProgramDataRoot\drivers"

function Invoke-DatabaseMigrations {
  $DbPath = Join-Path $ProgramDataRoot "data\energylink.db"
  $SchemaPath = Join-Path $ProgramFilesRoot "Engine\prisma\schema.prisma"
  $PrismaCli = Join-Path $ProgramFilesRoot "Engine\node_modules\prisma\build\index.js"

  if (!(Test-Path $SchemaPath)) {
    Write-Warning "Prisma schema not found. Skipping database migration: $SchemaPath"
    return
  }
  if (!(Test-Path $PrismaCli)) {
    Write-Warning "Prisma CLI not found. Skipping database migration: $PrismaCli"
    return
  }
  if (!(Test-Path $DbPath)) {
    New-Item -ItemType File -Path $DbPath -Force | Out-Null
  }

  $PreviousDatabaseUrl = $env:DATABASE_URL
  $env:DATABASE_URL = "file:" + ($DbPath -replace "\\", "/")
  try {
    & node $PrismaCli migrate deploy --schema $SchemaPath
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma migrate deploy failed with exit code $LASTEXITCODE."
    }
    Write-Host "Database schema is ready: $DbPath"
  }
  finally {
    $env:DATABASE_URL = $PreviousDatabaseUrl
  }
}

Invoke-DatabaseMigrations

if (!(Test-Path "$ProgramDataRoot\logs\engine.log")) {
  New-Item -ItemType File -Path "$ProgramDataRoot\logs\engine.log" | Out-Null
}

$ServiceWrapper = "$ProgramFilesRoot\Engine\service-wrapper.exe"
$ServiceXml = "$ProgramFilesRoot\Engine\energylink-engine.xml"

if (-not $SkipServiceInstall) {
  if ((Test-Path $ServiceWrapper) -and (Test-Path $ServiceXml)) {
    & $ServiceWrapper stop 2>$null
    & $ServiceWrapper uninstall 2>$null
    & $ServiceWrapper install
    & $ServiceWrapper start
  }
  else {
    Write-Warning "Service wrapper or XML not found. Skipping Windows Service registration."
  }
}

# Shortcuts
$Shell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "EnergyLink Management"
New-Dir $StartMenu

function New-Shortcut($Path, $Target, $WorkingDirectory) {
  if (Test-Path $Target) {
    $Shortcut = $Shell.CreateShortcut($Path)
    $Shortcut.TargetPath = $Target
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.Save()
  }
}

New-Shortcut (Join-Path $Desktop "EnergyLink Editor.lnk") "$ProgramFilesRoot\Editor\EnergyLink Editor.exe" "$ProgramFilesRoot\Editor"
New-Shortcut (Join-Path $Desktop "EnergyLink Monitor.lnk") "$ProgramFilesRoot\Monitor\EnergyLink Monitor.exe" "$ProgramFilesRoot\Monitor"
New-Shortcut (Join-Path $StartMenu "EnergyLink Editor.lnk") "$ProgramFilesRoot\Editor\EnergyLink Editor.exe" "$ProgramFilesRoot\Editor"
New-Shortcut (Join-Path $StartMenu "EnergyLink Monitor.lnk") "$ProgramFilesRoot\Monitor\EnergyLink Monitor.exe" "$ProgramFilesRoot\Monitor"

Write-Host "EnergyLink Management installed."
Write-Host "Program Files: $ProgramFilesRoot"
Write-Host "ProgramData: $ProgramDataRoot"
Write-Host "Engine API: http://localhost:8081"

