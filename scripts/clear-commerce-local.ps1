# Wipes tenant t1 on local Docker Postgres: all products/catalog rows, all lookups, and uploads/media/t1.
param([string]$TenantId = "t1")

$ErrorActionPreference = "Stop"
& "$PSScriptRoot\clear-commerce-products.ps1" -TenantId $TenantId -DeleteProductMedia
& "$PSScriptRoot\clear-commerce-lookups.ps1" -TenantId $TenantId -DeleteCategoryMedia

Write-Host ""
Write-Host "Local catalog + lookups + media cleared for $TenantId."
Write-Host "Commerce:EnsureGroceryStorefrontAisles=false prevents demo aisles on API restart."
Write-Host "Start API: npm run api:commerce:exec"
