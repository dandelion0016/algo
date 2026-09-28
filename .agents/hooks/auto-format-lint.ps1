# Source File Auto-Format & Linter Hook (PowerShell Fallback)
# Antigravity Lifecycle Hook (PostToolUse) & Git Hook (pre-commit)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rawInput = ""
try {
    if ([Console]::IsInputRedirected) {
        $rawInput = [Console]::In.ReadToEnd()
    }
} catch {
    $rawInput = ""
}

$payload = $null
if ($rawInput -and $rawInput.Trim().Length -gt 0) {
    try {
        $payload = $rawInput | ConvertFrom-Json
    } catch {
        $payload = $null
    }
}

$filesToProcess = [System.Collections.Generic.List[string]]::new()

# 1. From CLI arguments
foreach ($arg in $args) {
    if ($arg -and (Test-Path $arg -PathType Leaf)) {
        $filesToProcess.Add((Resolve-Path $arg).Path)
    }
}

# 2. From ToolCall payload
if ($payload) {
    $target = $null
    if ($payload.toolCall -and $payload.toolCall.args -and $payload.toolCall.args.TargetFile) {
        $target = $payload.toolCall.args.TargetFile
    } elseif ($payload.toolArgs -and $payload.toolArgs.TargetFile) {
        $target = $payload.toolArgs.TargetFile
    } elseif ($payload.args -and $payload.args.TargetFile) {
        $target = $payload.args.TargetFile
    }

    if ($target -and (Test-Path $target -PathType Leaf)) {
        $filesToProcess.Add((Resolve-Path $target).Path)
    }
}

$sourceExtensions = @('.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.yaml', '.yml', '.py', '.go', '.rs', '.html', '.css', '.scss', '.sh', '.ps1', '.md', '.sql')

foreach ($filePath in $filesToProcess) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    if (-not ($sourceExtensions -contains $ext)) {
        continue
    }

    try {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $original = $content

        # JSON formatting & validation
        if ($ext -eq '.json') {
            try {
                $obj = $content | ConvertFrom-Json
                $formatted = $obj | ConvertTo-Json -Depth 20
                if ($formatted) {
                    $content = $formatted + "`n"
                }
            } catch {
                [Console]::Error.WriteLine("⚠️  [Auto-Format/Lint Error] $($filePath): JSON syntax error.")
            }
        } else {
            # Trim trailing whitespace & normalize trailing newline
            $lines = $content -split "\r?\n"
            $newLines = @()
            foreach ($line in $lines) {
                $newLines += $line.TrimEnd()
            }
            $content = ($newLines -join "`n").TrimEnd("`n") + "`n"
        }

        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
            [Console]::Error.WriteLine("✨ [Auto-Format/Lint] Formatted: $(Split-Path -Leaf $filePath)")
        }
    } catch {
        [Console]::Error.WriteLine("⚠️  [Auto-Format/Lint Failed] $($filePath): $_")
    }
}

# Always output empty JSON object
Write-Output "{}"
