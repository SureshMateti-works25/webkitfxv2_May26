# Idempotent demo tenant catalog sync via Commerce.Api startup bootstrap.
# After DB migrate, tenants from config/commerce/tenants.catalog.json are upserted on API start.
param(
  [string]$ApiBase = "http://localhost:5055",
  [switch]$SkipApiStart
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Demo tenants are defined in config/commerce/tenants.catalog.json"
Write-Host "RBAC matrix: config/commerce/tenant-rbac.json"
Write-Host ""

if (-not $SkipApiStart) {
  Write-Host "Start Postgres then API in another terminal:"
  Write-Host "  npm run docker:commerce-db"
  Write-Host "  npm run api:commerce:exec:fresh"
  Write-Host "Then re-run: .\scripts\seed-tenants-demo.ps1 -SkipApiStart"
  exit 0
}

Write-Host "Probing tenant bootstrap endpoints at $ApiBase ..."
$tenants = @("t1", "t_foodhall", "t_cornercup", "t_brewlab")
foreach ($id in $tenants) {
  $uri = "$ApiBase/api/v1/tenants/$id/bootstrap"
  try {
    $r = Invoke-RestMethod -Uri $uri -Method Get
    Write-Host ("  OK {0} mode={1} features={2}" -f $r.tenantId, $r.storefrontMode, ($r.features -join ","))
  } catch {
    Write-Warning "  FAIL $id : $_"
  }
}

Write-Host ""
Write-Host "List tenants:"
Invoke-RestMethod -Uri "$ApiBase/api/v1/tenants" -Method Get | ConvertTo-Json -Depth 4
