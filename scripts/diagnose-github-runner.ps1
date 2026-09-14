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
    Write-Check -Name 'Runner service registration' -Passed $false -Detail 'No Windows service matching actions.runner.* was found.'
    Set-DiagnosticFailure 2
} else {
    foreach ($service in $runnerServices) {
        $running = $service.State -eq 'Running'
        $detail = "State=$($service.State); StartMode=$($service.StartMode)"
        Write-Check -Name "Runner service $($service.Name)" -Passed $running -Detail $detail

        if (-not $running) {
            Set-DiagnosticFailure 3
        }
    }
}

$listenerProcesses = @(Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue)
$listenerRunning = $listenerProcesses.Count -gt 0
$listenerDetail = if ($listenerRunning) {
    "Found $($listenerProcesses.Count) listener process(es)."
} else {
    'No Runner.Listener process is currently visible.'
}
Write-Check -Name 'Runner.Listener process' -Passed $listenerRunning -Detail $listenerDetail

if (-not $listenerRunning) {
    Set-DiagnosticFailure 4
}

$detectedRoots = New-Object System.Collections.Generic.List[string]

if ($RunnerRoot) {
    try {
        $resolved = (Resolve-Path -LiteralPath $RunnerRoot).Path
        $detectedRoots.Add($resolved)
    } catch {
        Write-Check -Name 'Explicit runner root' -Passed $false -Detail "Path does not exist: $RunnerRoot"
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
    Write-Check -Name 'Runner installation root' -Passed $false -Detail 'Could not infer a runner root from the Windows service. Pass -RunnerRoot if the runner is installed elsewhere.'
    Set-DiagnosticFailure 5
} else {
    foreach ($root in $detectedRoots) {
        Write-Host ''
        Write-Host "Runner root: $root"

        $runnerMetadata = Join-Path $root '.runner'
        $metadataExists = Test-Path -LiteralPath $runnerMetadata
        $metadataDetail = if ($metadataExists) {
            '.runner exists (contents intentionally not printed).'
        } else {
            '.runner is missing.'
        }
        Write-Check -Name 'Runner registration metadata' -Passed $metadataExists -Detail $metadataDetail

        if (-not $metadataExists) {
            Set-DiagnosticFailure 6
        }

        $listenerBinary = Join-Path $root 'bin\Runner.Listener.exe'
        if (Test-Path -LiteralPath $listenerBinary) {
            $version = (Get-Item -LiteralPath $listenerBinary).VersionInfo.FileVersion
            Write-Check -Name 'Runner.Listener binary' -Passed $true -Detail "Present; file version=$version"
        } else {
            Write-Check -Name 'Runner.Listener binary' -Passed $false -Detail "Missing: $listenerBinary"
            Set-DiagnosticFailure 6
        }

        $diagDirectory = Join-Path $root '_diag'
        if (Test-Path -LiteralPath $diagDirectory) {
            $latestDiag = Get-ChildItem -LiteralPath $diagDirectory -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

            if ($latestDiag) {
                Write-Check -Name 'Runner diagnostic logs' -Passed $true -Detail "Latest file=$($latestDiag.FullName); LastWriteTime=$($latestDiag.LastWriteTime)"
            } else {
                Write-Check -Name 'Runner diagnostic logs' -Passed $false -Detail '_diag exists but contains no files.'
            }
        } else {
            Write-Check -Name 'Runner diagnostic logs' -Passed $false -Detail "Directory not found: $diagDirectory"
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
    $networkDetail = if ($reachable) { 'Reachable.' } else { 'Not reachable from this machine.' }
    Write-Check -Name "TCP 443 $target" -Passed $reachable -Detail $networkDetail
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
