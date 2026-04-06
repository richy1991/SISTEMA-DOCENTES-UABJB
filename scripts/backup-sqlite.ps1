param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\backend\db.sqlite3')
)

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..') -ErrorAction Stop
$source = Resolve-Path $SourcePath -ErrorAction Stop
$backupDir = Join-Path $projectRoot 'backend\backups'

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupPath = Join-Path $backupDir "db_backup_$timestamp.sqlite3"

Copy-Item $source $backupPath -Force
Write-Output "Backup creado: $(Resolve-Path $backupPath)"