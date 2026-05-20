# Reliable local dev: Postgres + Commerce.Api + optional storefront Vite apps.
#
# From repo root:
#   npm run dev:stack              # API + Sarees + Groceries + Café
#   npm run dev:local              # same (alias)
#   npm run dev:cafe:stack         # API + Café only
#   .\scripts\dev-local-stack.ps1 -Apps api-only
#   .\scripts\dev-local-stack.ps1 -SkipDocker -Apps sarees

param(
    [ValidateSet("all", "commerce", "sarees", "groceries", "cafe", "api-only")]
    [string] $Apps = "all",
    [switch] $SkipDocker,
    [switch] $NoStopPort,
    [int] $ApiWaitSec = 120,
    [switch] $SkipVerify
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$stopScript = Join-Path $PSScriptRoot "stop-commerce-api.ps1"
$waitScript = Join-Path $PSScriptRoot "wait-http.ps1"
$verifyScript = Join-Path $PSScriptRoot "verify-local-dev.ps1"
$compose = Join-Path $root "services/commerce-api/docker-compose.yml"
$apiRunner = Join-Path $root "scripts/run-commerce-api.ps1"

Write-Host "`n=== webkitfx local dev stack ===" -ForegroundColor Cyan
Write-Host "Apps: $Apps" -ForegroundColor DarkGray

if (-not $NoStopPort) {
    Write-Host "`n[1/6] Free port 5055" -ForegroundColor Cyan
    & $stopScript -Port 5055
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
else {
    Write-Host "`n[1/6] Skipping port stop (-NoStopPort)" -ForegroundColor Yellow
}

if (-not $SkipDocker) {
    Write-Host "`n[2/6] Postgres (Docker compose)" -ForegroundColor Cyan
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker is not running. Start Docker Desktop, or pass -SkipDocker if Postgres is already up." -ForegroundColor Red
        exit 1
    }
    docker compose -f $compose up -d
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Start-Sleep -Seconds 2
}
else {
    Write-Host "`n[2/6] Skipping Docker (-SkipDocker)" -ForegroundColor Yellow
}

Write-Host "`n[3/6] Commerce.Api -> http://localhost:5055 (new window)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $apiRunner
)

Write-Host "`n[4/6] Wait for /health (up to ${ApiWaitSec}s)..." -ForegroundColor Cyan
& $waitScript -Url "http://localhost:5055/health" -TimeoutSec $ApiWaitSec
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipVerify) {
    Write-Host "`n[5/6] Verify tenants + auth smoke..." -ForegroundColor Cyan
    & $verifyScript -SkipHealth
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
else {
    Write-Host "`n[5/6] Skipping verify (-SkipVerify)" -ForegroundColor Yellow
}

if ($Apps -eq "api-only") {
    Write-Host "`n[6/6] API only - ready at http://localhost:5055" -ForegroundColor Green
    Write-Host "  Tenant bootstrap: http://localhost:5055/api/v1/tenants/t1/bootstrap" -ForegroundColor DarkGray
    exit 0
}

Write-Host "`n[6/6] Build workspaces + start Vite..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

switch ($Apps) {
    "sarees" {
        Write-Host "Sarees: http://localhost:5175" -ForegroundColor DarkGray
        npm run dev -w sarees-market
    }
    "groceries" {
        Write-Host "Groceries: http://localhost:5183" -ForegroundColor DarkGray
        npm run dev -w groceries-market
    }
    "cafe" {
        Write-Host "Cafe: http://localhost:5190" -ForegroundColor DarkGray
        npm run dev -w cafe-market
    }
    "commerce" {
        Write-Host "Sarees: http://localhost:5175 | Groceries: http://localhost:5183" -ForegroundColor DarkGray
        npx concurrently -k -n sarees,groceries -c green,cyan "npm run dev -w sarees-market" "npm run dev -w groceries-market"
    }
    "all" {
        Write-Host "Sarees: http://localhost:5175 | Groceries: http://localhost:5183 | Cafe: http://localhost:5190" -ForegroundColor DarkGray
        npx concurrently -k -n sarees,groceries,cafe -c green,cyan,magenta "npm run dev -w sarees-market" "npm run dev -w groceries-market" "npm run dev -w cafe-market"
    }
}
