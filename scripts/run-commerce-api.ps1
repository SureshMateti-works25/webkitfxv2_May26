# Run Commerce.Api with dotnet exec (works when `dotnet run` hits Access Denied in some environments).
# Prerequisites: Postgres - from repo root:
#   docker compose -f services/commerce-api/docker-compose.yml up -d
#
# If build fails with "file is being used by another process", either:
#   .\scripts\run-commerce-api.ps1 -StopExisting
# or npm run stop:commerce-api
# Or -SkipBuild to exec the last built DLL without replacing it:
#   .\scripts\run-commerce-api.ps1 -SkipBuild

param(
    [switch] $SkipBuild,
    [switch] $StopExisting,
    [switch] $UseRemoteDatabase
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

if ($StopExisting) {
    $stop = Join-Path $PSScriptRoot "stop-commerce-api.ps1"
    try {
        & $stop -Port 5055
    }
    catch {
        Write-Host "Could not free port 5055: $_" -ForegroundColor Red
        exit 1
    }
}

$apiDir = Join-Path $root "services/commerce-api/Commerce.Api"
$proj = Join-Path $apiDir "Commerce.Api.csproj"
$dll = Join-Path $apiDir "bin/Release/net10.0/Commerce.Api.dll"

$env:ASPNETCORE_ENVIRONMENT = "Development"
# Single URL — listing both 127.0.0.1 and localhost in ASPNETCORE_URLS can double-bind the same port on Windows.
$env:ASPNETCORE_URLS = "http://localhost:5055"

# Env from Azure scripts (clear:commerce-*:azure) overrides appsettings.Development.json and makes
# localhost:5055 serve an empty remote DB while Docker still has local demo rows.
if (-not $UseRemoteDatabase) {
    $env:ConnectionStrings__Commerce = "Host=localhost;Port=54330;Database=catalog;Username=catalog;Password=catalog"
    Remove-Item Env:COMMERCE_DATABASE_CONNECTION_STRING -ErrorAction SilentlyContinue
    Write-Host "Database: local Docker Postgres (54330)" -ForegroundColor DarkGray
}
else {
    Write-Host "Database: remote (COMMERCE_DATABASE_CONNECTION_STRING or ConnectionStrings__Commerce)" -ForegroundColor Yellow
}

if (-not $SkipBuild) {
    Write-Host "Building Commerce.Api (Release)..." -ForegroundColor Cyan
    dotnet build $proj -c Release
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    if (-not (Test-Path -LiteralPath $dll)) {
        Write-Host "No DLL at $dll - run once without -SkipBuild after stopping any other Commerce.Api." -ForegroundColor Red
        exit 1
    }
    Write-Host "Skipping build (-SkipBuild). DLL: $dll" -ForegroundColor Yellow
}

# Content root must be the project folder so appsettings.json + Jwt:SigningKey load (not repo root).
Set-Location $apiDir
Write-Host 'Starting API at http://localhost:5055 (Ctrl+C to stop)' -ForegroundColor Green
dotnet exec $dll
