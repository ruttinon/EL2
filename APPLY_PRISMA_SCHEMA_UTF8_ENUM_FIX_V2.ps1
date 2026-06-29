$ErrorActionPreference = "Stop"

$Root = Get-Location
$SchemaPath = Join-Path $Root "prisma\schema.prisma"

if (-not (Test-Path $SchemaPath)) {
  throw "Cannot find prisma/schema.prisma. Run this script from the project root."
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = "$SchemaPath.backup_$Timestamp"
Copy-Item $SchemaPath $BackupPath -Force
Write-Host "Backup created: $BackupPath" -ForegroundColor Yellow

function Read-TextAnyEncoding {
  param([Parameter(Mandatory = $true)][string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)

  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    return [System.Text.Encoding]::Unicode.GetString($bytes)
  }

  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes)
  }

  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }

  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Text
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

$schema = Read-TextAnyEncoding -Path $SchemaPath

# Normalize line endings.
$schema = $schema -replace "`r`n", "`n"
$schema = $schema -replace "`r", "`n"

# Remove any hidden BOM / null characters that may have been introduced by Windows PowerShell Set-Content.
$schema = $schema.TrimStart([char]0xFEFF)
$schema = $schema -replace "`0", ""

# Convert enum typed fields to String for SQLite. Prisma SQLite does not support enum definitions.
$enumTypeNames = @(
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

foreach ($typeName in $enumTypeNames) {
  $schema = [regex]::Replace(
    $schema,
    "(?m)^(\s+\w+\s+)" + [regex]::Escape($typeName) + "(\??)(\s.*)?$",
    '${1}String${2}${3}'
  )
}

# Remove enum declaration blocks completely.
foreach ($typeName in $enumTypeNames) {
  $schema = [regex]::Replace(
    $schema,
    "(?ms)^enum\s+" + [regex]::Escape($typeName) + "\s*\{.*?\}\s*",
    ""
  )
}

# Convert enum default values from @default(value) to @default("value").
$enumDefaultValues = @(
  "draft",
  "active",
  "archived",
  "converter",
  "meter",
  "sensor",
  "modbus_tcp",
  "modbus_rtu",
  "tcp",
  "udp",
  "unknown",
  "online",
  "offline",
  "warning",
  "coil",
  "discrete_input",
  "input_register",
  "holding_register",
  "bool",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "float32",
  "float64",
  "good",
  "bad",
  "uncertain",
  "high",
  "low",
  "medium",
  "cleared",
  "daily",
  "weekly",
  "monthly",
  "enabled",
  "disabled",
  "running",
  "success",
  "failed",
  "sound",
  "email",
  "webhook",
  "alarm_raised",
  "alarm_cleared",
  "alarm_acknowledged",
  "pending",
  "delivered",
  "skipped",
  "history_retention",
  "log_retention",
  "backup_retention",
  "database_vacuum"
)

foreach ($value in $enumDefaultValues) {
  $schema = $schema.Replace("@default($value)", "@default(`"$value`")")
}

# Clean up excessive blank lines after enum removal.
$schema = [regex]::Replace($schema, "`n{3,}", "`n`n")

# Ensure schema starts directly with generator/datasource/model/comment, without hidden leading chars.
$schema = $schema.TrimStart()

Write-Utf8NoBom -Path $SchemaPath -Text $schema

Write-Host "schema.prisma converted to UTF-8 without BOM." -ForegroundColor Green
Write-Host "Prisma enum blocks removed and enum fields converted to String for SQLite." -ForegroundColor Green
Write-Host "Now run: pnpm db:generate" -ForegroundColor Cyan
