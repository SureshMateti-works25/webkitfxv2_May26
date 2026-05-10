# Polls a URL until HTTP 200 or timeout (for dev stack readiness).

param(
    [Parameter(Mandatory = $true)]
    [string] $Url,
    [int] $TimeoutSec = 120,
    [int] $IntervalSec = 1
)

$ErrorActionPreference = "Continue"
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$attempt = 0

while ((Get-Date) -lt $deadline) {
    $attempt++
    try {
        $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        if ($res.StatusCode -eq 200) {
            Write-Host "`nReady: $Url ($attempt attempts)" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        # still starting
    }
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    Start-Sleep -Seconds $IntervalSec
}

Write-Host ""
Write-Host "Timeout after ${TimeoutSec}s waiting for $Url" -ForegroundColor Red
Write-Host "Check the Commerce.Api window for build errors or Postgres (Docker)." -ForegroundColor Yellow
exit 1
