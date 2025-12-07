# db/convert_all_migrations_to_utf8.ps1
# Usage: run from project root in PowerShell
# - Backs up db/all_migrations.sql to db/all_migrations.sql.bak
# - Cleans problematic characters and writes UTF8-clean file
# - Optionally runs psql on the cleaned file (uncomment psql lines and set password below)

param(
  [string]$SqlPath = ".\db\all_migrations.sql",
  [string]$BackupPath = ".\db\all_migrations.sql.bak",
  [string]$PgPassword = "123456",       # change if needed
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe",
  [switch]$RunPsqlAfter
)

if (-not (Test-Path $SqlPath)) {
  Write-Error "File not found: $SqlPath"
  exit 1
}

Write-Host "Backing up $SqlPath -> $BackupPath"
Copy-Item $SqlPath $BackupPath -Force

Write-Host "Reading file using system default encoding..."
# read raw using system default (to capture bytes as text)
$txt = Get-Content $SqlPath -Raw -Encoding Default

Write-Host "Replacing common smart quotes/dashes/ellipsis..."
$txt = $txt -replace '[\u2018\u2019\u201A\u201B]', "'"     # single smart quotes -> '
$txt = $txt -replace '[\u201C\u201D\u201E\u201F]', '"'   # double smart quotes -> "
$txt = $txt -replace '[\u2013\u2014]', '-'               # en/em dash -> -
$txt = $txt -replace '\u2026', '...'                    # ellipsis -> ...

Write-Host "Removing C1 control characters (bytes 0x80-0x9F) that often cause psql errors..."
$txt = $txt -replace '[\x80-\x9F]', ''

# Optionally normalize Windows CRLF to LF only if desired:
# $txt = $txt -replace "`r`n", "`n"

Write-Host "Writing cleaned file back as UTF8 (without BOM)..."
Set-Content -Path $SqlPath -Value $txt -Encoding UTF8

Write-Host "Done. If you want to run psql now, re-run this script with -RunPsqlAfter."

if ($RunPsqlAfter) {
  Write-Host "Running psql on cleaned file..."
  $env:PGPASSWORD = $PgPassword
  & $PsqlPath -U postgres -d fp -f $SqlPath
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  Write-Host "psql finished."
}