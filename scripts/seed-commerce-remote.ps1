# Stops Commerce.Api if it is listening on the default port (avoids MSB3027 DLL locks during OneTimeSeed build), then runs the seed.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

dotnet run --project services/commerce-api/Commerce.OneTimeSeed/Commerce.OneTimeSeed.csproj -c Release
