# Sarees + Commerce.Api local stack (Windows) - reliable order:
# 1) Free port 5055 (stops stale API so Release build never hits DLL lock)
# 2) Docker Postgres
# 3) Commerce.Api in a new PowerShell window (build + dotnet exec)
# 4) Wait until /health returns 200 (avoids Vite proxy 404 while API still starting)
# 5) Sarees Vite in this window (/api -> 5055)
#
# From repo root:
#   npm run dev:local
#   npm run dev:sarees:stack
#   .\scripts\dev-sarees-stack.ps1 -SkipDocker
#   .\scripts\dev-sarees-stack.ps1 -NoStopPort          # if something else must keep 5055
# Extra Vite args (after --):
#   npm run dev:sarees:stack -- -- --port 5175

param(
    [switch] $SkipDocker,
    [switch] $NoStopPort,
    [int] $ApiWaitSec = 120
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$stopScript = Join-Path $PSScriptRoot "stop-commerce-api.ps1"
$waitScript = Join-Path $PSScriptRoot "wait-http.ps1"
$compose = Join-Path $root "services/commerce-api/docker-compose.yml"
$apiRunner = Join-Path $root "scripts/run-commerce-api.ps1"

Write-Host "`n=== Sarees local stack ===" -ForegroundColor Cyan

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
& $waitScript -Url "http://127.0.0.1:5055/health" -TimeoutSec $ApiWaitSec
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[5/5] Sarees (Vite) - /api proxies to 5055" -ForegroundColor Green
Write-Host '      Use the Local URL printed by Vite (not /api/... in the browser bar).' -ForegroundColor DarkGray
Write-Host ""

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
