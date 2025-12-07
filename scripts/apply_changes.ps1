# scripts/apply_changes.ps1
# Usage: open PowerShell (Admin if needed) in project root and run:
#   .\scripts\apply_changes.ps1
# Edit $psqlPath and $pgPassword before running or set PGPASSWORD in environment.

$psqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'  # adjust if your psql is elsewhere
$pgUser = 'postgres'
$pgDatabase = 'fp'

if (-not (Test-Path $psqlPath)) {
  Write-Host "psql not found at $psqlPath. Edit this script to set correct path." -ForegroundColor Red
  exit 1
}

# Prompt for password securely
$pgPassword = Read-Host "Postgres password for $pgUser" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set env for this session
$env:PGPASSWORD = $plain

# Run migrations
Write-Host "Running DB migrations..."
& $psqlPath -U $pgUser -d $pgDatabase -f ".\db\all_migrations.sql"

# Install required npm packages for Drive & scripts
Write-Host "Installing npm packages (googleapis, axios, minimist, @aws-sdk/client-s3)..."
npm install googleapis axios minimist @aws-sdk/client-s3 --no-audit --no-fund

# Cleanup env
Remove-Item Env:\PGPASSWORD
Write-Host "Done. Please restart your Node server (nodemon or node server.js)."
Write-Host "If Google Drive is enabled, ensure GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_DRIVE_FOLDER_ID are set in .env."