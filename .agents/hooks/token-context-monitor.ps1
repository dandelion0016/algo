# Token & Context Monitor Hook (PreInvocation) in PowerShell
# Fallback for Windows environments without Node.js

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    @{ injectSteps = @() } | ConvertTo-Json -Compress
    exit 0
}

try {
    $payload = $rawInput | ConvertFrom-Json
} catch {
    @{ injectSteps = @() } | ConvertTo-Json -Compress
    exit 0
}

$steps = 0
if ($null -ne $payload.initialNumSteps) {
    $steps = [int]$payload.initialNumSteps
}

$conversationId = "default-session"
if ($payload.conversationId) {
    $conversationId = [string]$payload.conversationId
}

$currentLevel = "normal"
if ($steps -ge 35) {
    $currentLevel = "alert"
} elseif ($steps -ge 20) {
    $currentLevel = "warning"
}

if ($currentLevel -eq "normal") {
    @{ injectSteps = @() } | ConvertTo-Json -Compress
    exit 0
}

# Rate limit using temp file
$safeId = $conversationId -replace '[^a-zA-Z0-9_-]', '_'
$stateFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "antigravity-token-monitor-$safeId.json")

$lastStep = 0
$lastLevel = "normal"
if (Test-Path $stateFile) {
    try {
        $st = Get-Content $stateFile -Raw | ConvertFrom-Json
        $lastStep = [int]$st.lastNotifiedStep
        $lastLevel = [string]$st.lastNotifiedLevel
    } catch {}
}

$isUpgrade = ($lastLevel -eq "warning" -and $currentLevel -eq "alert")
if (-not $isUpgrade -and ($steps - $lastStep -lt 10)) {
    @{ injectSteps = @() } | ConvertTo-Json -Compress
    exit 0
}

# Save state
try {
    @{
        lastNotifiedStep = $steps
        lastNotifiedLevel = $currentLevel
    } | ConvertTo-Json -Compress | Set-Content $stateFile -Encoding UTF8
} catch {}

$message = ""
if ($currentLevel -eq "alert") {
    $message = "⚠️ 【Token Bloat Alert / コンテキスト肥大化警告】`nセッションが累積 $steps ステップに達しています。推論精度劣化・トークン浪費防止のため、PROJECT_STATUS.mdに状態を保存して /clear または新規チャットでセッションをリフレッシュしてください。"
} else {
    $message = "ℹ️ 【Token Governance / コンテキスト管理ガイダンス】`nセッションが $steps ステップに達しました。探索やテスト実行はサブエージェントへオフロードし、タスク完了時はセッションリフレッシュを推奨します。"
}

@{
    injectSteps = @(
        @{
            ephemeralMessage = $message
        }
    )
} | ConvertTo-Json -Compress -Depth 5
