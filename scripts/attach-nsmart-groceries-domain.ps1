# Attach nsmart.nistta.com to Groceries Azure Static Web App (green-glacier / swa-groceries-dev).
# Step 1: Add DNS in Cloudflare (see output below). Step 2: Run this script (or -SkipDnsCheck after CNAME exists).
param(
    [string]$Hostname = 'nsmart.nistta.com',
    [string]$SwaName = 'swa-groceries-dev',
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$SwaDefaultHost = 'green-glacier-04e1d9b00.7.azurestaticapps.net',
    [string]$CommerceApiName = 'commerce-api-webkitfx-dev',
    [switch]$SkipDnsCheck,
    [switch]$SkipCors
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '=== Cloudflare DNS (nistta.com zone) ===' -ForegroundColor Cyan
Write-Host '  Type:   CNAME'
Write-Host '  Name:   nsmart'
Write-Host "  Target: $SwaDefaultHost"
Write-Host '  Proxy:  DNS only (grey cloud) until Azure shows the domain Validated'
Write-Host '          Then you may enable Proxied (orange cloud) with SSL/TLS = Full (strict)'
Write-Host ''
Write-Host "  SWA default URL: https://$SwaDefaultHost/"
Write-Host "  Custom URL:      https://$Hostname/"
Write-Host ''

if (-not $SkipDnsCheck) {
    Write-Host 'Checking public DNS for CNAME...'
    $ok = $false
    for ($i = 1; $i -le 24; $i++) {
        try {
            $answers = Resolve-DnsName -Name $Hostname -Type CNAME -ErrorAction Stop
            foreach ($a in $answers) {
                $raw = if ($null -ne $a.NameHost) { $a.NameHost } else { '' }
                $target = $raw.ToString().TrimEnd('.')
                if ($target -ieq $SwaDefaultHost) {
                    $ok = $true
                    break
                }
            }
        } catch {
            # not propagated yet
        }
        if ($ok) { break }
        Write-Host "  attempt $i/24 — CNAME not ready yet; waiting 15s..."
        Start-Sleep -Seconds 15
    }
    if (-not $ok) {
        throw "CNAME for $Hostname must point to $SwaDefaultHost before Azure can bind. Add the Cloudflare record, then re-run with -SkipDnsCheck if DNS is correct but Resolve-DnsName fails locally."
    }
    Write-Host '  CNAME looks correct.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Binding custom domain on Azure Static Web App...'
az staticwebapp hostname set `
    --hostname $Hostname `
    --name $SwaName `
    --resource-group $ResourceGroup
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipCors) {
    Write-Host ''
    Write-Host 'Ensuring Azure App Service CORS (platform layer) allows the custom origin...'
    az webapp cors add `
        --name $CommerceApiName `
        --resource-group $ResourceGroup `
        --allowed-origins "https://$Hostname" `
        2>$null | Out-Null

    Write-Host 'Ensuring Commerce.Api CORS (ASP.NET) allows the custom origin...'
    $existing = az webapp config appsettings list `
        --name $CommerceApiName `
        --resource-group $ResourceGroup `
        -o json | ConvertFrom-Json
    $corsSlots = @($existing | Where-Object { $_.name -match '^Cors__Origins__\d+$' })
    $already = $corsSlots | Where-Object { $_.value -eq "https://$Hostname" }
    if ($already) {
        Write-Host "  https://$Hostname already in Cors__Origins."
    } else {
        $next = 0
        foreach ($s in $corsSlots) {
            if ($s.name -match '__(\d+)$' -and [int]$Matches[1] -ge $next) { $next = [int]$Matches[1] + 1 }
        }
        $key = "Cors__Origins__$next"
        az webapp config appsettings set `
            --name $CommerceApiName `
            --resource-group $ResourceGroup `
            --settings "${key}=https://$Hostname" `
            -o none | Out-Null
        Write-Host "  Added $key=https://$Hostname"
    }
}

Write-Host ''
Write-Host 'Done. Verify:' -ForegroundColor Green
Write-Host "  https://$Hostname/"
Write-Host '  Azure Portal → Static Web App → swa-groceries-dev → Custom domains → Validated'
Write-Host ''
