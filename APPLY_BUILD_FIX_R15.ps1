$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SchemaPath = Join-Path $Root "prisma\schema.prisma"
$EngineManagerMain = Join-Path $Root "apps\engine-manager-desktop\electron\main.ts"

Write-Host "EnergyLink Build Fix R15" -ForegroundColor Cyan
Write-Host "Root: $Root" -ForegroundColor Gray

if (-not (Test-Path $EngineManagerMain)) {
  throw "File not found: $EngineManagerMain"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $EngineManagerMain "$EngineManagerMain.backup_$timestamp" -Force

$mainText = Get-Content $EngineManagerMain -Raw
$oldLine = "const code = typeof (error as NodeJS.ErrnoException | null)?.errno === 'number' ? (error as NodeJS.ErrnoException).errno : null;"
$newLines = @'
const errno = (error as NodeJS.ErrnoException | null)?.errno;
      const code: number | null = typeof errno === 'number' ? errno : null;
'@

if ($mainText.Contains($oldLine)) {
  $mainText = $mainText.Replace($oldLine, $newLines.TrimEnd())
  [System.IO.File]::WriteAllText($EngineManagerMain, $mainText, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Patched engine-manager electron/main.ts errno typing." -ForegroundColor Green
} else {
  Write-Host "engine-manager electron/main.ts already patched or pattern not found." -ForegroundColor Yellow
}

if (Test-Path $SchemaPath) {
  $schemaText = Get-Content $SchemaPath -Raw
  [System.IO.File]::WriteAllText($SchemaPath, $schemaText, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Re-saved prisma/schema.prisma as UTF-8 without BOM." -ForegroundColor Green
}

Write-Host "R15 build fix applied." -ForegroundColor Green
Write-Host "Next commands:" -ForegroundColor Cyan
Write-Host "  pnpm db:generate"
Write-Host "  pnpm build"
