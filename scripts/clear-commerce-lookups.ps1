# Clears all lookup_types / lookup_values for tenant t1 and product_categories links.
# Stops Commerce.Api first (avoids stale reads). Restart API after; with Commerce:SkipLookupReseed=true
# demo lookup rows are not re-inserted on startup.
param(
    [string]$TenantId = "t1",
    [switch]$DeleteCategoryMedia
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$container = "commerce-api-postgres-1"
$running = docker ps --filter "name=$container" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "Starting Postgres..."
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 3
}

$sql = @"
BEGIN;
DELETE FROM product_categories;
UPDATE lookup_values SET "ParentValueId" = NULL, "MerchandisingParentId" = NULL WHERE "TenantId" = '$TenantId';
DELETE FROM lookup_values WHERE "TenantId" = '$TenantId';
DELETE FROM lookup_types WHERE "TenantId" = '$TenantId';
COMMIT;
"@

Write-Host "Clearing lookups for tenant $TenantId..."
$sql | docker exec -i $container psql -U catalog -d catalog -v ON_ERROR_STOP=1

if ($DeleteCategoryMedia) {
    $mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media\$TenantId"
    if (Test-Path $mediaRoot) {
        Write-Host "Removing media under $mediaRoot ..."
        Remove-Item -Path $mediaRoot -Recurse -Force
    }
}

Write-Host "Done. lookup_types and lookup_values are empty for $TenantId."
Write-Host "Start API: npm run api:commerce:exec"
Write-Host "Ensure appsettings.Development.json has Commerce:SkipLookupReseed=true so demo aisles are not re-seeded."
