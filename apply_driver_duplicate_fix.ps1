# EnergyL driver duplicate cleanup patch
# Run this file from the root of the EnergyL project folder.
# It removes only wrapper driver files that duplicate real drivers in src/drivers/deviceDrivers.

$ErrorActionPreference = 'Stop'

$files = @(
  'apps\engine\src\drivers\cvmC4Driver.ts',
  'apps\engine\src\drivers\cvmC11Driver.ts',
  'apps\engine\src\drivers\modbusRtuDriver.ts',
  'apps\engine\src\drivers\modbusTcpDriver.ts',
  'apps\engine\src\drivers\unsupportedDriver.ts'
)

Write-Host 'EnergyL driver duplicate cleanup'
Write-Host 'Project root:' (Get-Location)

foreach ($file in $files) {
  if (Test-Path $file) {
    Remove-Item $file -Force
    Write-Host "REMOVED: $file"
  } else {
    Write-Host "SKIP not found: $file"
  }
}

Write-Host ''
Write-Host 'Kept real driver files under: apps\engine\src\drivers\deviceDrivers'
Write-Host 'Done.'
