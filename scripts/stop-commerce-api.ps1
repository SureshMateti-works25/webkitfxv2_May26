# Stops processes listening on the Commerce.Api HTTP port so dotnet build can replace the DLL.
# Safe for local dev: only targets the given port (default 5055).

param(
    [int] $Port = 5055
)

$ErrorActionPreference = "Stop"

function Get-PidsListeningOnPort([int] $LocalPort) {
    $set = New-Object "System.Collections.Generic.HashSet[int]"
    $cmd = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($cmd) {
        foreach ($conn in Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue) {
            $owningPid = [int]$conn.OwningProcess
            if ($owningPid -gt 4) { [void]$set.Add($owningPid) }
        }
    }
    if ($set.Count -gt 0) {
        return @($set)
    }
    # Fallback: netstat -ano (Windows)
    $lines = netstat -ano 2>$null
    if (-not $lines) { return @() }
    foreach ($line in $lines) {
        if ($line -notmatch "LISTENING") { continue }
        if ($line -notmatch ":$LocalPort\s") { continue }
        if ($line -match "LISTENING\s+(\d+)\s*$") {
            $owningPid = [int]$Matches[1]
            if ($owningPid -gt 4) { [void]$set.Add($owningPid) }
        }
    }
    return @($set)
}

$pids = Get-PidsListeningOnPort -LocalPort $Port
if ($pids.Count -eq 0) {
    Write-Host "No listener on port $Port (nothing to stop)." -ForegroundColor DarkGray
    exit 0
}

foreach ($procId in ($pids | Sort-Object -Unique)) {
    try {
        $p = Get-Process -Id $procId -ErrorAction Stop
        Write-Host "Stopping $($p.ProcessName) (PID $procId) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force
    }
    catch {
        Write-Host "Could not stop PID $procId : $_" -ForegroundColor Red
        exit 1
    }
}

Start-Sleep -Milliseconds 400
Write-Host "Port $Port is free." -ForegroundColor Green
