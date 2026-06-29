$ErrorActionPreference = "Stop"

$Root = Get-Location
$SchemaPath = Join-Path $Root "prisma\schema.prisma"

if (!(Test-Path $SchemaPath)) {
  throw "Cannot find prisma\schema.prisma. Run this script from the project root."
}

$BackupPath = Join-Path $Root ("prisma\schema.prisma.backup-before-sqlite-enum-fix-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item $SchemaPath $BackupPath -Force
Write-Host "Backup created: $BackupPath" -ForegroundColor Cyan

$text = Get-Content $SchemaPath -Raw

$enumNames = @(
  "ProjectStatus",
  "DeviceType",
  "DeviceProtocol",
  "DeviceStatus",
  "TagRegisterType",
  "TagDataType",
  "TagQuality",
  "AlarmType",
  "AlarmSeverity",
  "AlarmStatus",
  "ReportScheduleFrequency",
  "ReportScheduleStatus",
  "ReportScheduleRunStatus",
  "AlarmNotificationChannelType",
  "AlarmNotificationEventType",
  "AlarmNotificationDeliveryStatus",
  "MaintenanceJobType",
  "MaintenanceRunStatus"
)

foreach ($enumName in $enumNames) {
  # Replace field types: status ProjectStatus -> status String, status ProjectStatus? -> status String?
  $text = [regex]::Replace($text, "(?m)(^\s*\w+\s+)" + [regex]::Escape($enumName) + "(\??)(\s*(?:@|=|$))", '${1}String${2}${3}')

  # Remove enum blocks entirely because SQLite connector does not support enum declarations.
  $text = [regex]::Replace($text, "(?ms)^\s*enum\s+" + [regex]::Escape($enumName) + "\s*\{.*?\}\s*", "")
}

# Normalize excessive blank lines after enum removal.
$text = [regex]::Replace($text, "`r?`n{3,}", "`r`n`r`n")
Set-Content -Path $SchemaPath -Value $text -Encoding UTF8

Write-Host "schema.prisma enum fix applied." -ForegroundColor Green
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  pnpm db:generate" -ForegroundColor Yellow
Write-Host "  pnpm build" -ForegroundColor Yellow
