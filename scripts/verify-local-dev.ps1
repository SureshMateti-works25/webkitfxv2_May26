# Quick gate: Commerce.Api health, tenant bootstrap, auth smoke (tenant t1).
param(
    [string] $ApiBase = "http://localhost:5055",
    [string] $TenantId = "t1",
    [switch] $SkipHealth,
    [switch] $SkipSmoke
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host "Verifying local dev ($ApiBase, tenant $TenantId)..." -ForegroundColor Cyan

if (-not $SkipHealth) {
    try {
        $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get -TimeoutSec 5
        if ($health.status -ne "ok") { throw "health status not ok" }
        Write-Host "  health: ok" -ForegroundColor Green
    }
    catch {
        Write-Host "  health: FAIL - is Commerce.Api running? npm run api:commerce:exec:fresh" -ForegroundColor Red
        exit 1
    }
}

try {
    $boot = Invoke-RestMethod -Uri "$ApiBase/api/v1/tenants/$TenantId/bootstrap" -Method Get -TimeoutSec 10
    Write-Host ("  tenant bootstrap: {0} mode={1}" -f $boot.tenantId, $boot.storefrontMode) -ForegroundColor Green
}
catch {
    Write-Host "  tenant bootstrap: FAIL - run API once to apply migrations ($_)" -ForegroundColor Red
    exit 1
}

if (-not $SkipSmoke) {
    $env:COMMERCE_API_URL = $ApiBase
    $env:TENANT_ID = $TenantId
    node scripts/commerce-api-smoke.mjs auth
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Local dev verification passed." -ForegroundColor Green
