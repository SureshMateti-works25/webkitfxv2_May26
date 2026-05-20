# Start local Postgres for Commerce.Api if Docker is available.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root "services/commerce-api/docker-compose.yml"

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Postgres (host port 54330)..." -ForegroundColor Cyan
docker compose -f $compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Postgres ready. Connection: Host=localhost;Port=54330;Database=catalog;Username=catalog;Password=catalog" -ForegroundColor Green
