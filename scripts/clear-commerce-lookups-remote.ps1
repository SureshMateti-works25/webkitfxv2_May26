# Deletes ALL lookup_types and lookup_values for a tenant on any Postgres (Azure or local).
# Also clears product_categories links (they reference category lookup ids).
# Does NOT delete products, SKUs, or media.
#
# Usage (Azure):
#   $env:COMMERCE_DATABASE_CONNECTION_STRING = "<Azure Npgsql connection string>"
#   .\scripts\clear-commerce-lookups-remote.ps1
#
# Or pass -ConnectionString directly. Optional -DisableAzureLookupBootstrap sets
# Commerce__EnsureGroceryStorefrontAisles=false on the App Service so restarts do not re-insert aisles.
param(
    [string]$ConnectionString = "",
    [string]$TenantId = "t1",
    [string]$ResourceGroup = "rg-nistta-prod",
    [string]$WebAppName = "commerce-api-webkitfx-dev",
    [switch]$DisableAzureLookupBootstrap
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    $ConnectionString = $env:COMMERCE_DATABASE_CONNECTION_STRING
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "Reading ConnectionStrings__Commerce from App Service $WebAppName ..."
    $ConnectionString = az webapp config appsettings list `
        --name $WebAppName --resource-group $ResourceGroup `
        --query "[?name=='ConnectionStrings__Commerce'].value" -o tsv
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw "Set -ConnectionString or COMMERCE_DATABASE_CONNECTION_STRING."
}

function Get-PgEnvFromNpgsql([string]$cs) {
    $map = @{}
    foreach ($part in $cs -split ';') {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $i = $part.IndexOf('=')
        if ($i -lt 1) { continue }
        $k = $part.Substring(0, $i).Trim().ToLowerInvariant()
        $v = $part.Substring($i + 1).Trim()
        switch -Regex ($k) {
            '^host$' { $map['PGHOST'] = $v }
            '^port$' { $map['PGPORT'] = $v }
            '^database$' { $map['PGDATABASE'] = $v }
            '^username$' { $map['PGUSER'] = $v }
            '^password$' { $map['PGPASSWORD'] = $v }
            '^ssl\s*mode$' { $map['PGSSLMODE'] = ($v -replace '\s+', '').ToLowerInvariant() }
        }
    }
    if (-not $map['PGPORT']) { $map['PGPORT'] = '5432' }
    if (-not $map['PGSSLMODE']) { $map['PGSSLMODE'] = 'require' }
    return $map
}

$pg = Get-PgEnvFromNpgsql $ConnectionString
Write-Host "Target: $($pg['PGHOST'])/$($pg['PGDATABASE']) tenant $TenantId"

$sql = @"
BEGIN;
DELETE FROM product_categories;
UPDATE lookup_values SET "ParentValueId" = NULL, "MerchandisingParentId" = NULL WHERE "TenantId" = '$TenantId';
DELETE FROM lookup_values WHERE "TenantId" = '$TenantId';
DELETE FROM lookup_types WHERE "TenantId" = '$TenantId';
COMMIT;
SELECT 'lookup_types' AS what, COUNT(*)::text AS remaining FROM lookup_types WHERE "TenantId" = '$TenantId'
UNION ALL SELECT 'lookup_values', COUNT(*)::text FROM lookup_values WHERE "TenantId" = '$TenantId';
"@

$sqlFile = Join-Path $env:TEMP "clear-lookups-$TenantId.sql"
Set-Content -Path $sqlFile -Value $sql -Encoding UTF8

$dockerArgs = @(
    'run', '--rm',
    '-e', "PGHOST=$($pg['PGHOST'])",
    '-e', "PGPORT=$($pg['PGPORT'])",
    '-e', "PGDATABASE=$($pg['PGDATABASE'])",
    '-e', "PGUSER=$($pg['PGUSER'])",
    '-e', "PGPASSWORD=$($pg['PGPASSWORD'])",
    '-e', "PGSSLMODE=$($pg['PGSSLMODE'])",
    '-v', "${sqlFile}:/clear.sql:ro",
    'postgres:16-alpine',
    'psql', '-v', 'ON_ERROR_STOP=1', '-f', '/clear.sql'
)
Write-Host "Deleting all lookup types and values..."
& docker @dockerArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

if ($DisableAzureLookupBootstrap) {
    Write-Host "Disabling Azure API lookup bootstrap (Commerce__EnsureGroceryStorefrontAisles=false) ..."
    az webapp config appsettings set `
        --name $WebAppName --resource-group $ResourceGroup `
        --settings Commerce__EnsureGroceryStorefrontAisles=false | Out-Null
}

Write-Host "Done. lookup_types and lookup_values are empty for tenant $TenantId on the target database."
if (-not $DisableAzureLookupBootstrap) {
    Write-Host "WARNING: Azure App Service restarts re-insert product_types, app_type, and grocery aisles unless"
    Write-Host "  Commerce__EnsureGroceryStorefrontAisles=false (re-run with -DisableAzureLookupBootstrap)."
}
