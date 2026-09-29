# Phase Transition Guard Hook (PowerShell)
param()

$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    Write-Output '{"decision":"allow"}'
    exit 0
}

try {
    $payload = $rawInput | ConvertFrom-Json
} catch {
    Write-Output '{"decision":"allow"}'
    exit 0
}

$toolCall = $payload.toolCall
if (-not $toolCall -or -not $toolCall.name) {
    Write-Output '{"decision":"allow"}'
    exit 0
}

$toolName = $toolCall.name
$args = $toolCall.args

# 1. Guard PROJECT_STATUS.md Phase & Gate Changes
if ($toolName -eq "replace_file_content" -or $toolName -eq "write_to_file") {
    $targetFile = if ($args.TargetFile) { $args.TargetFile.Replace('\', '/') } else { "" }
    if ($targetFile -like "*/PROJECT_STATUS.md" -or $targetFile -eq "PROJECT_STATUS.md") {
        $content = if ($args.ReplacementContent) { $args.ReplacementContent } elseif ($args.CodeContent) { $args.CodeContent } else { "" }

        $isPhaseChange = ($content -match '\|\s*\*\*カレントフェーズ\*\*\s*\|') -or `
                         ($content -match '-\s*\[x\]\s*🛑.*Gate') -or `
                         ($content -match 'ゲート承認状態.*\|\s*.*(APPROVED|承認完了)')

        if ($isPhaseChange) {
            $reason = "[Phase Transition Guard] Detected Phase or Gate status change in PROJECT_STATUS.md. Halting Turbo mode to require explicit human approval."
            $res = @{ decision = "force_ask"; reason = $reason } | ConvertTo-Json -Compress
            Write-Output $res
            exit 0
        }
    }
}

# 2. Guard Critical Git / PR Operations
if ($toolName -eq "run_command") {
    $commandLine = if ($args.CommandLine) { $args.CommandLine } else { "" }
    $isCriticalCommand = ($commandLine -match "git\s+push.*(\borigin\s+main\b|\bmain\b)") -or `
                         ($commandLine -match "gh\s+pr\s+merge") -or `
                         ($commandLine -match "git\s+merge\s+(feature|main)")

    if ($isCriticalCommand) {
        $reason = "[Critical Operation Guard] Merge or direct push detected. Requiring user approval."
        $res = @{ decision = "force_ask"; reason = $reason } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }
}

Write-Output '{"decision":"allow"}'
exit 0
