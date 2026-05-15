# Sarees + Groceries + Commerce.Api local stack (Windows) — reliable order:
# 1) Free port 5055 (stops stale API so Release build never hits DLL lock)
# 2) Docker Postgres
# 3) Commerce.Api in a new PowerShell window (build + dotnet exec)
# 4) Wait until /health returns 200
# 5) `npm run build` then **Sarees + Groceries** Vite (parallel, `concurrently`)
#
# From repo root:
#   npm run dev:local
#   npm run dev:sarees:stack
#   .\scripts\dev-sarees-stack.ps1 -SkipDocker
#   .\scripts\dev-sarees-stack.ps1 -SareesOnly     # only Sarees (legacy single-window)
# Extra Vite args (after --) apply only when -SareesOnly:
#   npm run dev:sarees:stack -- -- --port 5175

param(
    [switch] $SkipDocker,
    [switch] $NoStopPort,
    [int] $ApiWaitSec = 120,
    [switch] $SareesOnly
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$stopScript = Join-Path $PSScriptRoot "stop-commerce-api.ps1"
$waitScript = Join-Path $PSScriptRoot "wait-http.ps1"
$compose = Join-Path $root "services/commerce-api/docker-compose.yml"
$apiRunner = Join-Path $root "scripts/run-commerce-api.ps1"

Write-Host "`n=== Sarees + Groceries local stack ===" -ForegroundColor Cyan

if (-not $NoStopPort) {
    Write-Host "`n[1/5] Free port 5055 (stop stale Commerce.Api if any)" -ForegroundColor Cyan
    try {
        & $stopScript -Port 5055
    }
    catch {
        Write-Host "Could not free port 5055: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "`n[1/5] Skipping port stop (-NoStopPort)." -ForegroundColor Yellow
}

if (-not $SkipDocker) {
    Write-Host "`n[2/5] Postgres (Docker)" -ForegroundColor Cyan
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker is not available. Start Docker Desktop, then retry. Or use -SkipDocker if Postgres is already running." -ForegroundColor Red
        exit 1
    }
    docker compose -f $compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker compose failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Start-Sleep -Seconds 2
}
else {
    Write-Host "`n[2/5] Skipping Docker (-SkipDocker)." -ForegroundColor Yellow
}

Write-Host "`n[3/5] Start Commerce.Api (new window) -> http://localhost:5055" -ForegroundColor Cyan
Write-Host "      Health: http://localhost:5055/health" -ForegroundColor DarkGray
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $apiRunner
)

Write-Host "`n[4/5] Wait for API health (up to $ApiWaitSec s)..." -ForegroundColor Cyan
& $waitScript -Url "http://localhost:5055/health" -TimeoutSec $ApiWaitSec
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[5/5] Build workspaces, then storefront dev servers (Commerce.Api must stay running)." -ForegroundColor Green
Write-Host "      Sarees: http://localhost:5175 (or next free port)" -ForegroundColor DarkGray
Write-Host "      Groceries: http://localhost:5183 (or next free port)" -ForegroundColor DarkGray
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($SareesOnly) {
    $viteArgs = @()
    $dashDash = $false
    foreach ($a in $args) {
        if ($a -eq "--") { $dashDash = $true; continue }
        if ($dashDash) { $viteArgs += $a }
    }
    if ($viteArgs.Count -eq 0) {
        npm run dev -w sarees-market
    }
    else {
        npm run dev -w sarees-market -- @viteArgs
    }
}
else {
    npm run dev:commerce:apps
}
