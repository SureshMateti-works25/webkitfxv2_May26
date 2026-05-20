# Back-compat wrapper — use dev-local-stack.ps1 or npm run dev:stack.
param(
    [switch] $SkipDocker,
    [switch] $NoStopPort,
    [int] $ApiWaitSec = 120,
    [switch] $SareesOnly
)

$apps = if ($SareesOnly) { "sarees" } else { "commerce" }
$args = @("-Apps", $apps)
if ($SkipDocker) { $args += "-SkipDocker" }
if ($NoStopPort) { $args += "-NoStopPort" }
if ($ApiWaitSec -ne 120) { $args += "-ApiWaitSec"; $args += $ApiWaitSec }

& (Join-Path $PSScriptRoot "dev-local-stack.ps1") @args
