# Exports tenant catalog rows (lookups, products, attributes, media metadata, vendor/shopper users)
# from local Docker Postgres to artifacts/commerce-migrate/<stamp>/data/*.csv
# and copies uploads/media/<tenant>/ blobs. Does NOT export audit_logs (orders not in schema yet).
param(
    [string]$TenantId = 't1',
    [string]$ExportDir = '',
    [string]$LocalMediaRoot = '',
    [string]$LocalContainer = 'commerce-api-postgres-1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\commerce-pg.ps1"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ExportDir)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $ExportDir = Join-Path $repoRoot "artifacts\commerce-migrate\$stamp"
}
$ExportDir = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Path $ExportDir -Force)).Path
$dataDir = Join-Path $ExportDir 'data'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

$running = docker ps --filter "name=$LocalContainer" --format '{{.Names}}' 2>$null
if (-not $running) {
    Write-Host 'Starting local Postgres...'
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 4
}

if ([string]::IsNullOrWhiteSpace($LocalMediaRoot)) {
    $LocalMediaRoot = Join-Path $repoRoot 'services\commerce-api\Commerce.Api\uploads\media'
}
$tenantMedia = Join-Path $LocalMediaRoot $TenantId
$exportMedia = Join-Path $ExportDir "media\$TenantId"

$specs = Get-CommerceCatalogTableSpecs -TenantId $TenantId
$manifest = @{
    tenantId     = $TenantId
    exportedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    source       = 'local-docker'
    tables       = @()
}

Write-Host "Exporting catalog for tenant $TenantId -> $ExportDir"
foreach ($spec in $specs) {
    $out = Join-Path $dataDir "$($spec.Name).csv"
    Export-CommerceTableCsv -OutFile $out -SelectQuery $spec.Query -LocalContainer $LocalContainer
    $rows = 0
    if (Test-Path $out) {
        $lineCount = (Get-Content -LiteralPath $out | Measure-Object -Line).Lines
        if ($lineCount -gt 1) { $rows = $lineCount - 1 }
    }
    Write-Host "  $($spec.Name): $rows rows"
    $manifest.tables += @{ name = $spec.Name; rows = $rows; file = "data/$($spec.Name).csv" }
}

if (Test-Path -LiteralPath $tenantMedia) {
    Write-Host "Copying media $tenantMedia -> $exportMedia"
    New-Item -ItemType Directory -Path (Split-Path $exportMedia -Parent) -Force | Out-Null
    if (Test-Path $exportMedia) { Remove-Item $exportMedia -Recurse -Force }
    Copy-Item -LiteralPath $tenantMedia -Destination $exportMedia -Recurse -Force
    $fileCount = (Get-ChildItem -LiteralPath $exportMedia -Recurse -File).Count
    $manifest.mediaFiles = $fileCount
    $manifest.mediaPath = "media/$TenantId"
}
else {
    Write-Host "No local media folder at $tenantMedia (DB metadata only)."
    $manifest.mediaFiles = 0
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $ExportDir 'manifest.json') -Encoding utf8

Set-CommerceMigrateLatestPointer -RepoRoot $repoRoot -ExportDir $ExportDir

Write-Host ''
Write-Host "Export complete: $ExportDir"
Write-Host "Latest pointer: artifacts/commerce-migrate/latest-path.txt"
