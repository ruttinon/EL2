$ErrorActionPreference = "Stop"

$Root = Get-Location
$SchemaPath = Join-Path $Root "prisma\schema.prisma"

if (!(Test-Path $SchemaPath)) {
  throw "Cannot find prisma\schema.prisma. Please run this script from the project root folder."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = "$SchemaPath.backup_$timestamp"
Copy-Item $SchemaPath $BackupPath -Force
Write-Host "Backup created: $BackupPath" -ForegroundColor Cyan

# Read schema safely. Previous scripts may have written UTF-16, which Prisma cannot parse.
$bytes = [System.IO.File]::ReadAllBytes($SchemaPath)

function Test-HasManyNullBytes([byte[]]$Data) {
  if ($Data.Length -eq 0) { return $false }
  $sample = [Math]::Min($Data.Length, 200)
  $nullCount = 0
  for ($i = 0; $i -lt $sample; $i++) {
    if ($Data[$i] -eq 0) { $nullCount++ }
  }
  return ($nullCount -gt 20)
}

if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
  $text = [System.Text.Encoding]::Unicode.GetString($bytes)
} elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
  $text = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes)
} elseif (Test-HasManyNullBytes $bytes) {
  $text = [System.Text.Encoding]::Unicode.GetString($bytes)
} else {
  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
}

# Remove BOM / invisible leading characters if present.
$text = $text.TrimStart([char]0xFEFF)
$text = $text -replace "`r`n", "`n"
$text = $text -replace "`r", "`n"

# SQLite in the current Prisma setup does not support native enum blocks.
# Remove enum declarations entirely.
$text = [System.Text.RegularExpressions.Regex]::Replace(
  $text,
  '(?ms)^\s*enum\s+\w+\s*\{.*?^\s*\}\s*',
  ""
)

$enumTypeNames = @(
  'ProjectStatus',
  'DeviceType',
  'DeviceProtocol',
  'DeviceStatus',
  'TagRegisterType',
  'TagDataType',
  'TagQuality',
  'AlarmType',
  'AlarmSeverity',
  'AlarmStatus',
  'ReportScheduleFrequency',
  'ReportScheduleStatus',
  'ReportScheduleRunStatus',
  'AlarmNotificationChannelType',
  'AlarmNotificationEventType',
  'AlarmNotificationDeliveryStatus',
  'MaintenanceJobType',
  'MaintenanceRunStatus'
)

foreach ($typeName in $enumTypeNames) {
  # Convert fields like: status ProjectStatus @default(active)
  # to:                  status String        @default("active")
  $text = [System.Text.RegularExpressions.Regex]::Replace(
    $text,
    "(?m)(\s+\w+\s+)$typeName(\??)(\s|$)",
    '${1}String${2}${3}'
  )
}

# Quote enum-style defaults after converting enum fields to String.
$enumDefaultValues = @(
  'draft','active','archived',
  'converter','meter','sensor',
  'modbus_tcp','modbus_rtu','tcp','udp',
  'unknown','online','offline','warning',
  'coil','discrete_input','input_register','holding_register',
  'bool','int16','uint16','int32','uint32','float32','float64',
  'good','bad','uncertain',
  'high','low','medium','cleared',
  'daily','weekly','monthly','enabled','disabled','running','success','failed',
  'sound','email','webhook','alarm_raised','alarm_cleared','alarm_acknowledged',
  'pending','delivered','skipped',
  'history_retention','log_retention','backup_retention','database_vacuum'
)

foreach ($value in $enumDefaultValues) {
  $text = [System.Text.RegularExpressions.Regex]::Replace(
    $text,
    "@default\($value\)",
    "@default(\"$value\")"
  )
}

# Clean excessive blank lines.
$text = [System.Text.RegularExpressions.Regex]::Replace($text, "\n{3,}", "`n`n")
$text = $text.TrimStart() + "`n"

# Write UTF-8 without BOM. Do NOT use Set-Content default encoding.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($SchemaPath, $text, $utf8NoBom)

Write-Host "schema.prisma fixed and saved as UTF-8 without BOM." -ForegroundColor Green
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  pnpm db:generate" -ForegroundColor Yellow
Write-Host "  pnpm build" -ForegroundColor Yellow
