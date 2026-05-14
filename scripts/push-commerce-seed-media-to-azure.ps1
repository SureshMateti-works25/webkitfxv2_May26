<#
.SYNOPSIS
  Zips a local Commerce.Api media root (folder that contains tenant subfolders like t1/) and deploys it to an
  Azure App Service (Linux) wwwroot so paths match Media:RootPath default uploads/media.

.PARAMETER ResourceGroup
  Azure resource group of the Web App.

.PARAMETER WebAppName
  App Service name (e.g. commerce-api-webkitfx-dev).

.PARAMETER LocalMediaRoot
  Absolute path to the same folder you used as SEED_MEDIA_ROOT when running Commerce.OneTimeSeed
  (contains t1/, not uploads/media itself unless that folder is the media root).

  Example after local seed:
    ...\webkitfxv2_May26\services\commerce-api\Commerce.Api\uploads\media
#>
param(
    [Parameter(Mandatory = $true)][string] $ResourceGroup,
    [Parameter(Mandatory = $true)][string] $WebAppName,
    [Parameter(Mandatory = $true)][string] $LocalMediaRoot
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path -LiteralPath $LocalMediaRoot
$stage = Join-Path $env:TEMP "commerce-media-zipstage-$([Guid]::NewGuid().ToString('n'))"
$uploadsMedia = Join-Path $stage "uploads\media"
New-Item -ItemType Directory -Path $uploadsMedia -Force | Out-Null
Copy-Item -Path (Join-Path $root "*") -Destination $uploadsMedia -Recurse -Force
$zip = Join-Path $env:TEMP "commerce-media-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Write-Host "Deploying $zip to $WebAppName ..."
az webapp deploy --resource-group $ResourceGroup --name $WebAppName --src-path $zip --type zip
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Done. Restart the Web App if cached files do not refresh."
