[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RunnerRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExitCode = 0

function Set-DiagnosticFailure {
    param([int]$Code)
    if ($Code -gt $script:ExitCode) {
        $script:ExitCode = $Code
    }
}

function Write-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $state = if ($Passed) { 'PASS' } else { 'CHECK' }
    Write-Host "[$state] $Name - $Detail"
}

Write-Host 'Brovexa M01 GitHub Actions self-hosted runner diagnostics'
Write-Host 'This script is read-only: it does not start, stop, install, remove, register, or reconfigure a runner.'
Write-Host ''

$runnerServices = @(
    Get-CimInstance Win32_Service |
        Where-Object { $_.Name -like 'actions.runner.*' }
)

if ($runnerServices.Count -eq 0) {
    Write-Check 'Runner service registration' $false 'No Windows service matching actions.runner.* was found.'
    Set-DiagnosticFailure 2
} else {
    foreach ($service in $runnerServices) {
        $running = $service.State -eq 'Running'
        Write-Check \
            "Runner service $($service.Name)" \
            $running \
            "State=$($service.State); StartMode=$($service.StartMode)"

        if (-not $running) {
            Set-DiagnosticFailure 3
        }
    }
}

$listenerProcesses = @(Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue)
$listenerRunning = $listenerProcesses.Count -gt 0
Write-Check \
    'Runner.Listener process' \
    $listenerRunning \
    $(if ($listenerRunning) { "Found $($listenerProcesses.Count) listener process(es)." } else { 'No Runner.Listener process is currently visible.' })

if (-not $listenerRunning) {
    Set-DiagnosticFailure 4
}

$detectedRoots = New-Object System.Collections.Generic.List[string]

if ($RunnerRoot) {
    try {
        $resolved = (Resolve-Path -LiteralPath $RunnerRoot).Path
        $detectedRoots.Add($resolved)
    } catch {
        Write-Check 'Explicit runner root' $false "Path does not exist: $RunnerRoot"
        Set-DiagnosticFailure 5
    }
}

foreach ($service in $runnerServices) {
    $pathName = [string]$service.PathName
    if ([string]::IsNullOrWhiteSpace($pathName)) {
        continue
    }

    $executablePath = $null
    if ($pathName -match '^\s*"([^"]+)"') {
        $executablePath = $Matches[1]
    } elseif ($pathName -match '^\s*([^\s]+)') {
        $executablePath = $Matches[1]
    }

    if ($executablePath -and (Test-Path -LiteralPath $executablePath)) {
        $binDirectory = Split-Path -Parent $executablePath
        $candidateRoot = Split-Path -Parent $binDirectory
        if ($candidateRoot -and -not $detectedRoots.Contains($candidateRoot)) {
            $detectedRoots.Add($candidateRoot)
        }
    }
}

if ($detectedRoots.Count -eq 0) {
    Write-Check 'Runner installation root' $false 'Could not infer a runner root from the Windows service. Pass -RunnerRoot if the runner is installed elsewhere.'
    Set-DiagnosticFailure 5
} else {
    foreach ($root in $detectedRoots) {
        Write-Host ''
        Write-Host "Runner root: $root"

        $runnerMetadata = Join-Path $root '.runner'
        Write-Check \
            'Runner registration metadata' \
            (Test-Path -LiteralPath $runnerMetadata) \
            $(if (Test-Path -LiteralPath $runnerMetadata) { '.runner exists (contents intentionally not printed).' } else { '.runner is missing.' })

        if (-not (Test-Path -LiteralPath $runnerMetadata)) {
            Set-DiagnosticFailure 6
        }

        $listenerBinary = Join-Path $root 'bin\Runner.Listener.exe'
        if (Test-Path -LiteralPath $listenerBinary) {
            $version = (Get-Item -LiteralPath $listenerBinary).VersionInfo.FileVersion
            Write-Check 'Runner.Listener binary' $true "Present; file version=$version"
        } else {
            Write-Check 'Runner.Listener binary' $false "Missing: $listenerBinary"
            Set-DiagnosticFailure 6
        }

        $diagDirectory = Join-Path $root '_diag'
        if (Test-Path -LiteralPath $diagDirectory) {
            $latestDiag = Get-ChildItem -LiteralPath $diagDirectory -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

            if ($latestDiag) {
                Write-Check 'Runner diagnostic logs' $true "Latest file=$($latestDiag.FullName); LastWriteTime=$($latestDiag.LastWriteTime)"
            } else {
                Write-Check 'Runner diagnostic logs' $false '_diag exists but contains no files.'
            }
        } else {
            Write-Check 'Runner diagnostic logs' $false "Directory not found: $diagDirectory"
        }
    }
}

Write-Host ''
Write-Host 'Outbound HTTPS checks (TCP 443 only)'
$networkTargets = @(
    'github.com',
    'api.github.com',
    'codeload.github.com',
    'results-receiver.actions.githubusercontent.com',
    'objects.githubusercontent.com'
)

foreach ($target in $networkTargets) {
    $reachable = Test-NetConnection -ComputerName $target -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
    Write-Check "TCP 443 $target" $reachable $(if ($reachable) { 'Reachable.' } else { 'Not reachable from this machine.' })
    if (-not $reachable) {
        Set-DiagnosticFailure 7
    }
}

Write-Host ''
if ($script:ExitCode -eq 0) {
    Write-Host '[PASS] Local runner service/process/basic network diagnostics found no blocker.'
    Write-Host 'Next: confirm the runner is Idle in GitHub Settings > Actions > Runners and manually dispatch M01 Self-hosted Verification Dispatch.'
} else {
    Write-Host "[CHECK] Diagnostics found one or more conditions requiring attention. ExitCode=$($script:ExitCode)"
    Write-Host 'See docs/SELF_HOSTED_RUNNER_RECOVERY.md. No machine state was changed by this script.'
}

exit $script:ExitCode
