<#
.SYNOPSIS
  Deploys a local Commerce.Api media root (folder that contains tenant subfolders like t1/) to an Azure App Service
  wwwroot so paths match Media:RootPath default uploads/media.

  Tries zip deploy first; on Linux .NET apps that often returns 400, falls back to Kudu VFS (PUT per file).

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

function Push-MediaViaKuduVfs {
    param(
        [string] $ResourceGroup,
        [string] $WebAppName,
        [string] $LocalRoot
    )
    $hosts = az webapp show --resource-group $ResourceGroup --name $WebAppName --query "enabledHostNames" -o json | ConvertFrom-Json
    $scmHost = $hosts | Where-Object { $_ -match '\.scm\.' } | Select-Object -First 1
    if (-not $scmHost) {
        throw "Could not resolve SCM host from enabledHostNames for $WebAppName"
    }
    $pub = az webapp deployment list-publishing-credentials --resource-group $ResourceGroup --name $WebAppName -o json | ConvertFrom-Json
    $pair = "$($pub.publishingUserName):$($pub.publishingPassword)"
    $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $hdr = @{ Authorization = "Basic $b64"; "If-Match" = "*" }
    $vfsBase = "https://$scmHost/api/vfs/site/wwwroot/uploads/media"
    $localRootPath = (Resolve-Path -LiteralPath $LocalRoot).Path
    $files = Get-ChildItem -LiteralPath $localRootPath -Recurse -File
    if ($files.Count -eq 0) {
        Write-Warning "No files under $localRootPath to upload."
        return
    }
    $n = 0
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($localRootPath.Length).TrimStart('\').Replace('\', '/')
        $uri = "$vfsBase/$rel"
        $n++
        Invoke-WebRequest -Uri $uri -Method Put -Headers $hdr -InFile $f.FullName -ContentType "application/octet-stream" -UseBasicParsing | Out-Null
        if ($n % 25 -eq 0) { Write-Host "  ... $n / $($files.Count) files" }
    }
    Write-Host "Kudu VFS upload complete ($n files)."
}

$stage = Join-Path $env:TEMP "commerce-media-zipstage-$([Guid]::NewGuid().ToString('n'))"
$uploadsMedia = Join-Path $stage "uploads\media"
New-Item -ItemType Directory -Path $uploadsMedia -Force | Out-Null
Copy-Item -Path (Join-Path $root "*") -Destination $uploadsMedia -Recurse -Force
$zip = Join-Path $env:TEMP "commerce-media-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Deploying $zip to $WebAppName (zip) ..."
$prevEa = $ErrorActionPreference
$ErrorActionPreference = "Continue"
az webapp deploy --resource-group $ResourceGroup --name $WebAppName --src-path $zip --type zip 2>&1 | Out-Host
$zipExit = $LASTEXITCODE
$ErrorActionPreference = $prevEa
if ($zipExit -ne 0) {
    Write-Warning "az webapp deploy --type zip failed (exit $zipExit). Using Kudu VFS instead."
    Push-MediaViaKuduVfs -ResourceGroup $ResourceGroup -WebAppName $WebAppName -LocalRoot $root
}
else {
    Write-Host "Zip deploy succeeded."
}

if (Test-Path $zip) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
Write-Host "Done. Restart the Web App if cached files do not refresh."
