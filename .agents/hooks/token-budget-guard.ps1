# Token Budget Guard Hook (PreToolUse) in PowerShell
# Fallback for Windows environments without Node.js

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

try {
    $payload = $rawInput | ConvertFrom-Json
} catch {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

$toolCall = $payload.toolCall
if (-not $toolCall -or -not $toolCall.name) {
    @{ decision = "allow" } | ConvertTo-Json -Compress
    exit 0
}

$toolName = $toolCall.name
$args = $toolCall.args

# 1. view_file
if ($toolName -eq "view_file") {
    $filePath = $args.AbsolutePath
    if ($filePath -and (Test-Path $filePath -PathType Leaf)) {
        $fileName = [System.IO.Path]::GetFileName($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $hasStartLine = ($null -ne $args.StartLine -and [int]$args.StartLine -gt 0)
        $hasEndLine = ($null -ne $args.EndLine -and [int]$args.EndLine -gt 0)

        # Lockfiles
        $lockfiles = @("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "cargo.lock", "composer.lock", "gemfile.lock")
        if ($lockfiles -contains $fileName.ToLower()) {
            if (-not $hasStartLine -and -not $hasEndLine) {
                @{
                    decision = "allow"
                    reason = "【Token Saver】ロックファイル ($fileName) は巨大なため、トークン消費を防ぐ目的で閲覧範囲を先頭150行に自動制限しました。"
                    overwrite = @{
                        StartLine = 1
                        EndLine = 150
                    }
                } | ConvertTo-Json -Compress
                exit 0
            }
        }

        # Large files (> 300 lines)
        $fileInfo = Get-Item $filePath
        if ($fileInfo.Length -gt 15KB) {
            $lineCount = 0
            $reader = [System.IO.File]::OpenText($filePath)
            try {
                while ($reader.ReadLine() -ne $null) { $lineCount++ }
            } finally {
                $reader.Close()
            }

            if ($lineCount -gt 300) {
                if (-not $hasStartLine -and -not $hasEndLine) {
                    @{
                        decision = "allow"
                        reason = "【Token Saver】ファイル ($fileName, 計$lineCount行) の全体読み込みによるToken Bloatを防ぐため、先頭250行に自動スライスしました。"
                        overwrite = @{
                            StartLine = 1
                            EndLine = 250
                        }
                    } | ConvertTo-Json -Compress
                    exit 0
                }
                if ($hasStartLine -and $hasEndLine -and ([int]$args.EndLine - [int]$args.StartLine -gt 400)) {
                    $newEnd = [int]$args.StartLine + 400
                    @{
                        decision = "allow"
                        reason = "【Token Saver】指定された行範囲が広すぎるため、トークン節約のため最大400行に補正しました。"
                        overwrite = @{
                            EndLine = $newEnd
                        }
                    } | ConvertTo-Json -Compress
                    exit 0
                }
            }
        }
    }
}

# 2. run_command
if ($toolName -eq "run_command") {
    $cmd = [string]$args.CommandLine
    if (-not [string]::IsNullOrWhiteSpace($cmd)) {
        # git log without count limit
        if ($cmd -match "(^|[;&|]\s*)git\s+log\b" -and $cmd -notmatch "\s+(-n\b|--max-count\b|-[0-9]+)\b") {
            $newCmd = $cmd -replace "(\bgit\s+log\b)", "`$1 -n 20"
            @{
                decision = "allow"
                reason = "【Token Saver】git log に件数制限がないため、自動的に '-n 20' を付加しました。"
                overwrite = @{
                    CommandLine = $newCmd
                }
            } | ConvertTo-Json -Compress
            exit 0
        }

        # npm / pnpm list without depth
        if ($cmd -match "(^|[;&|]\s*)(npm|pnpm)\s+(list|ls)\b" -and $cmd -notmatch "--depth\b") {
            $newCmd = $cmd -replace "(\b(npm|pnpm)\s+(list|ls)\b)", "`$1 --depth=0"
            @{
                decision = "allow"
                reason = "【Token Saver】npm/pnpm list の全依存ツリー展開を防ぐため、'--depth=0' を自動付加しました。"
                overwrite = @{
                    CommandLine = $newCmd
                }
            } | ConvertTo-Json -Compress
            exit 0
        }

        # Get-ChildItem -Recurse without -Depth
        if ($cmd -match "(^|[;&|]\s*)(Get-ChildItem|gci|ls|dir)\b.*-Recurse\b" -and $cmd -notmatch "-Depth\b") {
            $newCmd = $cmd -replace "(-Recurse\b)", "`$1 -Depth 3"
            @{
                decision = "allow"
                reason = "【Token Saver】Get-ChildItem -Recurse に階層制限がないため、'-Depth 3' を自動付加しました。"
                overwrite = @{
                    CommandLine = $newCmd
                }
            } | ConvertTo-Json -Compress
            exit 0
        }

        # Dumping lockfiles
        if ($cmd -match "(^|[;&|]\s*)(cat|type|Get-Content|gc)\s+.*(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock)") {
            @{
                decision = "deny"
                reason = "【Token Saver 拒否】ロックファイルをターミナルで丸ごと出力すると大量のトークンを消費します。view_file (先頭スライス付き) または検索コマンドで参照してください。"
            } | ConvertTo-Json -Compress
            exit 0
        }
    }
}

@{ decision = "allow" } | ConvertTo-Json -Compress
