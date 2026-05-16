# Shared Postgres helpers for Commerce catalog export/import (local Docker + Azure via docker run).

function Get-PgEnvFromNpgsql {
    param([string]$ConnectionString)
    $map = @{}
    foreach ($part in $ConnectionString -split ';') {
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
            '^trust\s*server\s*certificate$' { $map['PGSSLROOTCERT'] = if ($v -match 'true') { 'require' } else { $null } }
        }
    }
    if (-not $map['PGPORT']) { $map['PGPORT'] = '5432' }
    if (-not $map['PGSSLMODE']) { $map['PGSSLMODE'] = 'require' }
    return $map
}

function Get-CommerceCatalogTableSpecs {
    param([string]$TenantId = 't1')
    $tid = $TenantId.Replace("'", "''")
    @(
        @{ Name = 'tenants';              Query = "SELECT * FROM tenants WHERE ""Id"" = '$tid'" }
        @{ Name = 'lookup_types';         Query = "SELECT * FROM lookup_types WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'lookup_values';        Query = "SELECT * FROM lookup_values WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'attribute_defs';       Query = "SELECT * FROM attribute_defs WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'attribute_values';     Query = @"
SELECT av.* FROM attribute_values av
INNER JOIN attribute_defs ad ON av.""AttributeDefId"" = ad.""Id""
WHERE ad.""TenantId"" = '$tid'
"@ }
        @{ Name = 'locations';            Query = "SELECT * FROM locations WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'products';             Query = "SELECT * FROM products WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'skus';                 Query = "SELECT * FROM skus WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'media_assets';         Query = "SELECT * FROM media_assets WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'product_media';        Query = @"
SELECT pm.* FROM product_media pm
INNER JOIN products p ON pm.""ProductId"" = p.""Id""
WHERE p.""TenantId"" = '$tid'
"@ }
        @{ Name = 'product_categories';   Query = @"
SELECT pc.* FROM product_categories pc
INNER JOIN products p ON pc.""ProductId"" = p.""Id""
WHERE p.""TenantId"" = '$tid'
"@ }
        @{ Name = 'product_facets';       Query = @"
SELECT pf.* FROM product_facets pf
INNER JOIN products p ON pf.""ProductId"" = p.""Id""
WHERE p.""TenantId"" = '$tid'
"@ }
        @{ Name = 'collections';          Query = "SELECT * FROM collections WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'collection_items';    Query = @"
SELECT ci.* FROM collection_items ci
WHERE ci.""CollectionId"" IN (SELECT ""Id"" FROM collections WHERE ""TenantId"" = '$tid')
   OR ci.""ProductId"" IN (SELECT ""Id"" FROM products WHERE ""TenantId"" = '$tid')
"@ }
        @{ Name = 'inventory_positions';  Query = @"
SELECT ip.* FROM inventory_positions ip
INNER JOIN skus s ON ip.""SkuId"" = s.""Id""
WHERE s.""TenantId"" = '$tid'
"@ }
        @{ Name = 'storefront_sponsored_products'; Query = "SELECT * FROM storefront_sponsored_products WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'product_engagement_summaries';  Query = "SELECT * FROM product_engagement_summaries WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'product_ratings';      Query = "SELECT * FROM product_ratings WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'product_comments';     Query = "SELECT * FROM product_comments WHERE ""TenantId"" = '$tid'" }
        @{ Name = 'portal_users';         Query = "SELECT * FROM portal_users WHERE ""TenantId"" = '$tid' AND LOWER(""Role"") IN ('vendor', 'shopper')" }
    )
}

function Get-CommerceClearTenantCatalogSql {
    param([string]$TenantId = 't1')
    $tid = $TenantId.Replace("'", "''")
    @"
BEGIN;
DELETE FROM storefront_sponsored_products WHERE "TenantId" = '$tid';
DELETE FROM product_engagement_summaries WHERE "TenantId" = '$tid';
DELETE FROM product_ratings WHERE "TenantId" = '$tid';
DELETE FROM product_comments WHERE "TenantId" = '$tid';
DELETE FROM inventory_positions
  WHERE "SkuId" IN (SELECT "Id" FROM skus WHERE "TenantId" = '$tid');
DELETE FROM product_media
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$tid');
DELETE FROM product_categories
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$tid');
DELETE FROM collection_items
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$tid');
DELETE FROM product_facets
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$tid');
DELETE FROM skus WHERE "TenantId" = '$tid';
DELETE FROM products WHERE "TenantId" = '$tid';
DELETE FROM collection_items
  WHERE "CollectionId" IN (SELECT "Id" FROM collections WHERE "TenantId" = '$tid');
DELETE FROM collections WHERE "TenantId" = '$tid';
DELETE FROM attribute_values
  WHERE "AttributeDefId" IN (SELECT "Id" FROM attribute_defs WHERE "TenantId" = '$tid');
DELETE FROM attribute_defs WHERE "TenantId" = '$tid';
DELETE FROM locations WHERE "TenantId" = '$tid';
DELETE FROM media_assets WHERE "TenantId" = '$tid';
DELETE FROM portal_users WHERE "TenantId" = '$tid' AND LOWER("Role") IN ('vendor', 'shopper');
DELETE FROM product_categories;
UPDATE lookup_values SET "ParentValueId" = NULL, "MerchandisingParentId" = NULL WHERE "TenantId" = '$tid';
DELETE FROM lookup_values WHERE "TenantId" = '$tid';
DELETE FROM lookup_types WHERE "TenantId" = '$tid';
COMMIT;
"@
}

function Invoke-CommercePgLocalExec {
    param(
        [string]$Sql,
        [string]$Container = 'commerce-api-postgres-1',
        [string]$User = 'catalog',
        [string]$Database = 'catalog'
    )
    $Sql | docker exec -i $Container psql -U $User -d $Database -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "psql failed (local $Container)." }
}

function Invoke-CommercePgDockerRun {
    param(
        [hashtable]$PgEnv,
        [string]$Sql,
        [string[]]$ExtraDockerArgs = @()
    )
    $sqlFile = Join-Path $env:TEMP "commerce-pg-$(New-Guid).sql"
    Set-Content -Path $sqlFile -Value $Sql -Encoding UTF8
    $envArgs = @(
        '-e', "PGHOST=$($PgEnv['PGHOST'])",
        '-e', "PGPORT=$($PgEnv['PGPORT'])",
        '-e', "PGDATABASE=$($PgEnv['PGDATABASE'])",
        '-e', "PGUSER=$($PgEnv['PGUSER'])",
        '-e', "PGPASSWORD=$($PgEnv['PGPASSWORD'])",
        '-e', "PGSSLMODE=$($PgEnv['PGSSLMODE'])"
    )
    $sqlMount = "${sqlFile}:/run.sql:ro"
    $dockerArgs = @('run', '--rm') + $envArgs + $ExtraDockerArgs + @(
        '-v', $sqlMount,
        'postgres:16-alpine',
        'psql', '-v', 'ON_ERROR_STOP=1', '-f', '/run.sql'
    )
    & docker @dockerArgs
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { throw "psql failed (remote $($PgEnv['PGHOST']))." }
}

function Export-CommerceTableCsv {
    param(
        [string]$OutFile,
        [string]$SelectQuery,
        [string]$LocalContainer = 'commerce-api-postgres-1'
    )
    $oneLine = ($SelectQuery -replace "`r?`n", ' ' -replace '\s+', ' ').Trim()
    $copySql = "COPY ($oneLine) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
    $dir = Split-Path -Parent $OutFile
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    docker exec $LocalContainer psql -U catalog -d catalog -v ON_ERROR_STOP=1 -c $copySql 2>&1 |
        Out-File -LiteralPath $OutFile -Encoding utf8 -Force
    if ($LASTEXITCODE -ne 0) { throw "Export failed for $OutFile" }
}

function Import-CommerceCatalogFromDir {
    param(
        [hashtable]$PgEnv,
        [string]$DataDir,
        [string[]]$TableOrder
    )
    $importSqlPath = Join-Path $env:TEMP "commerce-import-$(New-Guid).sql"
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('SET session_replication_role = replica;')
    foreach ($table in $TableOrder) {
        $csv = Join-Path $DataDir "$table.csv"
        if (-not (Test-Path -LiteralPath $csv)) { continue }
        $lineCount = (Get-Content -LiteralPath $csv | Measure-Object -Line).Lines
        if ($lineCount -le 1) { continue }
        $dockerPath = "/data/$table.csv"
        $lines.Add("\copy $table FROM '$dockerPath' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');")
    }
    $lines.Add('SET session_replication_role = DEFAULT;')
    Set-Content -Path $importSqlPath -Value ($lines -join "`n") -Encoding UTF8

    $envArgs = @(
        '-e', "PGHOST=$($PgEnv['PGHOST'])",
        '-e', "PGPORT=$($PgEnv['PGPORT'])",
        '-e', "PGDATABASE=$($PgEnv['PGDATABASE'])",
        '-e', "PGUSER=$($PgEnv['PGUSER'])",
        '-e', "PGPASSWORD=$($PgEnv['PGPASSWORD'])",
        '-e', "PGSSLMODE=$($PgEnv['PGSSLMODE'])"
    )
    $dataMount = "${DataDir}:/data:ro"
    $sqlMount = "${importSqlPath}:/import.sql:ro"
    docker run --rm @envArgs -v $dataMount -v $sqlMount postgres:16-alpine psql -v ON_ERROR_STOP=1 -f /import.sql
    if ($LASTEXITCODE -ne 0) { throw "Catalog import failed." }
    Remove-Item $importSqlPath -Force -ErrorAction SilentlyContinue
}

function Resolve-CommerceAzureConnectionString {
    param(
        [string]$ConnectionString,
        [string]$ResourceGroup = 'rg-nistta-prod',
        [string]$WebAppName = 'commerce-api-webkitfx-dev'
    )
    if (-not [string]::IsNullOrWhiteSpace($ConnectionString)) { return $ConnectionString }
    $cs = $env:COMMERCE_DATABASE_CONNECTION_STRING
    if (-not [string]::IsNullOrWhiteSpace($cs)) { return $cs }
    Write-Host "Reading ConnectionStrings__Commerce from App Service $WebAppName ..."
    return az webapp config appsettings list `
        --name $WebAppName --resource-group $ResourceGroup `
        --query "[?name=='ConnectionStrings__Commerce'].value" -o tsv
}
