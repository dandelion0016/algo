# Circuit Breaker Hook (PreToolUse) - PowerShell Version

[CmdletBinding()]
param()

$InputData = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($InputData)) {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

try {
    $Payload = $InputData | ConvertFrom-Json
} catch {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

$ToolCall = $Payload.toolCall
if (-not $ToolCall -or -not $ToolCall.name) {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

$ConversationId = if ($Payload.conversationId) { $Payload.conversationId } else { "default-session" }
$ToolName = $ToolCall.name
$Args = $ToolCall.args

$MaxCommands = 5
$MaxEdits = 6
$MaxActions = 30
$WindowMinutes = 3

$SanitizedId = $ConversationId -replace '[^a-zA-Z0-9_\-]', '_'
$StateFile = Join-Path ([System.IO.Path]::GetTempPath()) "antigravity-circuit-breaker-$SanitizedId.json"

$State = @{ history = @() }
if (Test-Path $StateFile) {
    try {
        $State = Get-Content -Raw -Path $StateFile | ConvertFrom-Json
    } catch {
        $State = @{ history = @() }
    }
}

$Now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$Cutoff = $Now - ($WindowMinutes * 60 * 1000)

# Filter history
$History = @()
if ($State.history) {
    foreach ($item in $State.history) {
        if ($item.timestamp -gt $Cutoff) {
            $History += $item
        }
    }
}

$ActionKey = ""
if ($ToolName -eq "run_command") {
    $ActionKey = ($Args.CommandLine).Trim()
} elseif ($ToolName -eq "replace_file_content" -or $ToolName -eq "write_to_file") {
    $ActionKey = ($Args.TargetFile).Trim()
} elseif ($ToolName -eq "call_mcp_tool") {
    $ActionKey = "$($Args.ServerName):$($Args.ToolName)"
} else {
    $ActionKey = $ToolName
}

# Check consecutive commands
if ($ToolName -eq "run_command" -and $ActionKey) {
    $Count = 0
    for ($i = $History.Count - 1; $i -ge 0; $i--) {
        if ($History[$i].toolName -eq "run_command" -and $History[$i].key -eq $ActionKey) {
            $Count++
        } else {
            break
        }
    }
    if ($Count -ge ($MaxCommands - 1)) {
        @{
            decision = "force_ask"
            reason = "【サーキットブレーカー発動 (Circuit Breaker)】同一コマンド（`$ActionKey`）が $($Count + 1) 回連続して実行されようとしています。エラーリトライループや過剰課金を防止するため一時停止しました。"
        } | ConvertTo-Json -Compress
        exit 0
    }
}

# Check consecutive edits
if (($ToolName -eq "replace_file_content" -or $ToolName -eq "write_to_file") -and $ActionKey) {
    $Count = 0
    for ($i = $History.Count - 1; $i -ge 0; $i--) {
        if (($History[$i].toolName -eq "replace_file_content" -or $History[$i].toolName -eq "write_to_file") -and $History[$i].key -eq $ActionKey) {
            $Count++
        } else {
            break
        }
    }
    if ($Count -ge ($MaxEdits - 1)) {
        @{
            decision = "force_ask"
            reason = "【サーキットブレーカー発動 (Circuit Breaker)】同一ファイルに対する編集が $($Count + 1) 回連続して試行されています。無限編集ループを防ぐため一時停止しました。"
        } | ConvertTo-Json -Compress
        exit 0
    }
}

# Record action
$History += @{
    toolName = $ToolName
    key = $ActionKey
    timestamp = $Now
}

try {
    @{ history = $History } | ConvertTo-Json -Depth 5 | Set-Content -Path $StateFile -Encoding UTF8
} catch {}

@{ decision = "allow" } | ConvertTo-Json -Compress
exit 0
