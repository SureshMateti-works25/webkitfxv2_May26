# Idempotent local seed: migrations + demo lookups/products + JPEG blobs under Commerce.Api/uploads/media.
# Does not clear existing rows. Use reset-commerce-local.ps1 for a full wipe + reseed.
param(
    [string]$TenantId = "t1"
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
    Start-Sleep -Seconds 4
}

$mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media"
New-Item -ItemType Directory -Path $mediaRoot -Force | Out-Null

$env:ConnectionStrings__Commerce = "Host=localhost;Port=54330;Database=catalog;Username=catalog;Password=catalog"
$env:SEED_MEDIA_ROOT = (Resolve-Path -LiteralPath $mediaRoot).Path
Remove-Item Env:SEED_CLEAR_TENANT -ErrorAction SilentlyContinue

Write-Host "Seeding local Commerce DB (tenant $TenantId) + media -> $env:SEED_MEDIA_ROOT"
dotnet run --project services/commerce-api/Commerce.OneTimeSeed/Commerce.OneTimeSeed.csproj -c Release

Write-Host ""
Write-Host "Done. Start API: npm run api:commerce:exec"
Write-Host "Groceries: http://localhost:5183/  |  Sarees: check vite port in apps/sarees"
Write-Host "appsettings.Development.json may keep Commerce:SkipLookupReseed=true (API will not duplicate demo rows on startup)."
