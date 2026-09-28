# Destructive Operation Guard Hook for AWS & Git (PowerShell)
# Antigravity Lifecycle Hook (PreToolUse)

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

# 1. run_command Check
if ($toolName -eq "run_command") {
    $cmd = if ($args.CommandLine) { $args.CommandLine.Trim() } else { "" }
    if ([string]::IsNullOrWhiteSpace($cmd)) {
        Write-Output '{"decision":"allow"}'
        exit 0
    }

    # Normalize whitespace
    $normalized = $cmd -replace '\s+', ' '

    # ==========================================
    # A. GIT DESTRUCTIVE OPERATIONS
    # ==========================================

    # A-1. Hard Deny: Force Push
    if ($normalized -match 'git\s+push\b.*(-f\b|--force\b|--force-with-lease\b|\+[a-zA-Z0-9_\-\./]+)') {
        $res = @{
            decision = "deny"
            reason = "[Destructive Git Guard (DENY)] Force push (-f / --force) is prohibited to prevent remote history destruction. Please use topic branch and Pull Request."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-2. Hard Deny: Direct push to protected branches (main / master)
    if ($normalized -match 'git\s+push\b.*(\borigin\s+(main|master)\b|\b(main|master)\b)') {
        $res = @{
            decision = "deny"
            reason = "[Destructive Git Guard (DENY)] Direct push to main/master branch is prohibited (GitHub Flow violation). Please create a topic branch and submit a PR."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-3. Hard Deny: Deletion of protected branches
    if (($normalized -match 'git\s+push\b.*(:main|:master|--delete\s+(main|master))') -or `
        ($normalized -match 'git\s+branch\s+(-D|-d)\s+(main|master)\b')) {
        $res = @{
            decision = "deny"
            reason = "[Destructive Git Guard (DENY)] Deletion of main/master branch is prohibited."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-4. Hard Deny: git clean -f
    if ($normalized -match 'git\s+clean\b.*-[a-zA-Z]*f') {
        $res = @{
            decision = "deny"
            reason = "[Destructive Git Guard (DENY)] git clean -f is prohibited as it permanently removes untracked files."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-5. Force Ask: git reset --hard
    if ($normalized -match 'git\s+reset\s+--hard\b') {
        $res = @{
            decision = "force_ask"
            reason = "[High Risk Git Guard (FORCE_ASK)] git reset --hard permanently discards uncommitted changes. Human confirmation required."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-6. Force Ask: git restore . / git checkout -- .
    if ($normalized -match 'git\s+(checkout|restore)\b.*(\s+--\s+\.|\s+\.)') {
        $res = @{
            decision = "force_ask"
            reason = "[High Risk Git Guard (FORCE_ASK)] Discarding all working tree changes. Human confirmation required."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-7. Force Ask: git branch -D / branch deletion
    if (($normalized -match 'git\s+push\b.*(--delete\s+|:\w+)') -or ($normalized -match 'git\s+branch\s+-D\b')) {
        $res = @{
            decision = "force_ask"
            reason = "[Branch Deletion Guard (FORCE_ASK)] Branch deletion detected. Human confirmation required."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # A-8. Force Ask: gh pr merge
    if ($normalized -match 'gh\s+pr\s+merge\b') {
        $res = @{
            decision = "force_ask"
            reason = "[PR Merge Guard (FORCE_ASK)] PR merge execution detected. Human confirmation required."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # ==========================================
    # B. AWS DESTRUCTIVE OPERATIONS
    # ==========================================

    # B-1. Hard Deny: IaC Destroy
    if ($normalized -match '(terraform\s+destroy|cdk\s+destroy|pulumi\s+destroy|(sls|serverless)\s+remove)\b') {
        $res = @{
            decision = "deny"
            reason = "[Destructive AWS Guard (DENY)] Full infrastructure destruction (destroy/remove) is strictly prohibited."
        } | ConvertTo-Json -Compress
        Write-Output $res
        exit 0
    }

    # B-2. Hard Deny: High Impact Resource Deletion
    $awsHardDenyRegexes = @(
        'aws\s+s3\s+rb\b',
        'aws\s+s3\s+rm\s+s3:\/\/[^\s\/]+\/?(\s+--recursive|\s*$)',
        'aws\s+dynamodb\s+delete-table\b',
        'aws\s+rds\s+(delete-db-instance|delete-db-cluster)\b',
        'aws\s+ec2\s+terminate-instances\b',
        'aws\s+cloudformation\s+delete-stack\b',
        'aws\s+iam\s+(delete-role|delete-user|delete-group|delete-policy)\b',
        'aws\s+kms\s+(schedule-key-deletion|disable-key)\b'
    )

    foreach ($regex in $awsHardDenyRegexes) {
        if ($normalized -match $regex) {
            $res = @{
                decision = "deny"
                reason = "[Destructive AWS Guard (DENY)] Permanent AWS resource deletion detected ($regex). Automated execution is blocked."
            } | ConvertTo-Json -Compress
            Write-Output $res
            exit 0
        }
    }

    # B-3. Force Ask: AWS Modifications & Partial Deletions
    $awsForceAskRegexes = @(
        'aws\s+s3\s+rm\b',
        'aws\s+s3api\s+(delete-object|delete-objects)\b',
        'aws\s+dynamodb\s+(delete-item|batch-write-item)\b',
        'aws\s+(ec2|rds)\s+(stop-|reboot-)',
        'aws\s+iam\s+(attach-|detach-|put-)',
        'aws\s+(secretsmanager|ssm)\s+(delete-|put-|update-)',
        '(terraform\s+apply|cdk\s+deploy|pulumi\s+up)\b'
    )

    foreach ($regex in $awsForceAskRegexes) {
        if ($normalized -match $regex) {
            $res = @{
                decision = "force_ask"
                reason = "[Critical AWS Guard (FORCE_ASK)] Important AWS modification detected ($regex). Human approval required."
            } | ConvertTo-Json -Compress
            Write-Output $res
            exit 0
        }
    }
}

# 2. call_mcp_tool Check
if ($toolName -eq "call_mcp_tool") {
    $serverName = if ($args.ServerName) { $args.ServerName } else { "" }
    $mcpTool = if ($args.ToolName) { $args.ToolName } else { "" }
    $mcpArgs = $args.Arguments

    if ($serverName -like "*github*" -or $mcpTool -like "github_*") {
        if ($mcpTool -eq "delete_file") {
            $branch = if ($mcpArgs.branch) { $mcpArgs.branch } else { "" }
            if ($branch -eq "main" -or $branch -eq "master") {
                $res = @{
                    decision = "deny"
                    reason = "[Destructive GitHub MCP Guard (DENY)] Direct file deletion on protected branch ($branch) is prohibited."
                } | ConvertTo-Json -Compress
                Write-Output $res
                exit 0
            } else {
                $res = @{
                    decision = "force_ask"
                    reason = "[GitHub File Deletion (FORCE_ASK)] File deletion requested on branch $branch. Human confirmation required."
                } | ConvertTo-Json -Compress
                Write-Output $res
                exit 0
            }
        }
        if ($mcpTool -eq "merge_pull_request") {
            $res = @{
                decision = "force_ask"
                reason = "[GitHub PR Merge (FORCE_ASK)] PR merge requested. Human confirmation required."
            } | ConvertTo-Json -Compress
            Write-Output $res
            exit 0
        }
    }
}

Write-Output '{"decision":"allow"}'
exit 0
