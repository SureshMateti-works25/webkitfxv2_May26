# Full local snapshot before major changes: Postgres dump, git code archive, media, catalog CSV export.
# Usage:
#   .\scripts\backup-webkitfx-snapshot.ps1
#   .\scripts\backup-webkitfx-snapshot.ps1 -BackupRoot "D:\backups\webkitfx"
param(
    [string]$BackupRoot = '',
    [string]$TenantId = 't1',
    [string]$LocalContainer = 'commerce-api-postgres-1',
    [switch]$SkipCatalogCsv,
    [switch]$SkipCodeArchive
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = Join-Path (Split-Path $repoRoot -Parent) "webkitfxv2_May26-backups"
}
$outDir = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$outDir = (Resolve-Path -LiteralPath $outDir).Path

Write-Host "Backup destination: $outDir"

# --- Git metadata ---
$gitHead = (git rev-parse HEAD 2>$null)
$gitBranch = (git branch --show-current 2>$null)
@{
    commit  = $gitHead
    branch  = $gitBranch
    repo    = $repoRoot
    created = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -Path (Join-Path $outDir 'git-snapshot.json') -Encoding utf8

if (-not $SkipCodeArchive) {
    $zipPath = Join-Path $outDir 'webkitfxv2-code.zip'
    Write-Host "Archiving source at $gitHead -> $zipPath"
    git archive --format=zip -o $zipPath HEAD
    if ($LASTEXITCODE -ne 0) { throw 'git archive failed. Commit or stash changes and retry.' }
}

# --- Postgres ---
$running = docker ps --filter "name=$LocalContainer" --format '{{.Names}}' 2>$null
if (-not $running) {
    Write-Host 'Starting local Postgres (docker compose)...'
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 5
}

$dumpPath = Join-Path $outDir 'catalog-full.dump'
$dumpInContainer = '/tmp/webkitfx-catalog-backup.dump'
Write-Host "pg_dump -> $dumpPath"
docker exec $LocalContainer pg_dump -U catalog -d catalog -Fc --no-owner --no-acl -f $dumpInContainer
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed. Is container $LocalContainer running?" }
docker cp "${LocalContainer}:${dumpInContainer}" $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'docker cp pg_dump failed.' }
docker exec $LocalContainer rm -f $dumpInContainer | Out-Null

$connDev = Join-Path $repoRoot 'services\commerce-api\Commerce.Api\appsettings.Development.json'
if (Test-Path $connDev) {
    Copy-Item -LiteralPath $connDev -Destination (Join-Path $outDir 'appsettings.Development.json')
}

# --- Catalog CSV + media (tenant-scoped, for selective restore) ---
if (-not $SkipCatalogCsv) {
    $catalogDir = Join-Path $outDir "catalog-export-$TenantId"
    & "$PSScriptRoot\export-commerce-catalog.ps1" -TenantId $TenantId -ExportDir $catalogDir -LocalContainer $LocalContainer
}

$apiUploads = Join-Path $repoRoot 'services\commerce-api\Commerce.Api\uploads'
if (Test-Path -LiteralPath $apiUploads) {
    $destUploads = Join-Path $outDir 'uploads'
    Write-Host "Copying $apiUploads -> $destUploads"
    if (Test-Path $destUploads) { Remove-Item $destUploads -Recurse -Force }
    Copy-Item -LiteralPath $apiUploads -Destination $destUploads -Recurse -Force
}

$restoreMd = @"
# WebkitFx v2 snapshot restore

Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Folder: ``$outDir``
Git commit: ``$gitHead`` (branch ``$gitBranch``)

## 1. Restore code

``````powershell
# Extract to a new folder (example)
Expand-Archive -Path "$outDir\webkitfxv2-code.zip" -DestinationPath "D:\workspace\personal\webkitfxv2_May26-restored"
cd D:\workspace\personal\webkitfxv2_May26-restored
npm ci
npm run build
``````

Or checkout the same commit in git: ``git checkout $gitHead``

## 2. Restore database (full)

Requires Docker Postgres (port 54330). **This replaces the ``catalog`` database contents.**

``````powershell
cd D:\workspace\personal\Reactjs\webkitfxv2_May26-restored   # or your repo path
docker compose -f services/commerce-api/docker-compose.yml up -d
# Drop and recreate DB (destructive)
docker exec commerce-api-postgres-1 psql -U catalog -d postgres -c "DROP DATABASE IF EXISTS catalog;"
docker exec commerce-api-postgres-1 psql -U catalog -d postgres -c "CREATE DATABASE catalog;"
# Restore
docker cp "$outDir\catalog-full.dump" commerce-api-postgres-1:/tmp/webkitfx-catalog-restore.dump
docker exec commerce-api-postgres-1 pg_restore -U catalog -d catalog --no-owner --no-acl --clean --if-exists /tmp/webkitfx-catalog-restore.dump
docker exec commerce-api-postgres-1 rm -f /tmp/webkitfx-catalog-restore.dump
``````

If ``pg_restore`` reports errors about existing objects, drop/create DB first as above.

Connection string (local): ``Host=localhost;Port=54330;Database=catalog;Username=catalog;Password=catalog``

## 3. Restore uploads / media

``````powershell
Copy-Item -Recurse -Force "$outDir\uploads\*" "services\commerce-api\Commerce.Api\uploads\"
``````

## 4. Optional: catalog CSV only (tenant $TenantId)

Use folder ``catalog-export-$TenantId`` with ``scripts/import-commerce-catalog.ps1`` / migrate scripts (see repo ``scripts/migrate-commerce-local-to-azure.ps1``).

## 5. Verify

``````powershell
npm run api:commerce:exec:fresh
npm run dev:cafe
``````

Admin: siteadmin@example.local / LocalSiteAdmin!1 (from appsettings.Development.json DevSeed).
"@

Set-Content -Path (Join-Path $outDir 'RESTORE.md') -Value $restoreMd -Encoding utf8

Write-Host ''
Write-Host 'Backup complete.'
Write-Host "  Path: $outDir"
Write-Host '  - webkitfxv2-code.zip (git HEAD)'
Write-Host '  - catalog-full.dump (full Postgres)'
Write-Host "  - catalog-export-$TenantId/ (CSV + media metadata)"
Write-Host '  - uploads/ (media + order-emails)'
Write-Host '  - RESTORE.md'

# Pointer file for scripts
$pointerParent = $BackupRoot
New-Item -ItemType Directory -Path $pointerParent -Force | Out-Null
Set-Content -Path (Join-Path $pointerParent 'LATEST.txt') -Value $outDir -Encoding utf8
