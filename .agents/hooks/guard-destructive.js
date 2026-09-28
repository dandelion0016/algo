#!/usr/bin/env node

/**
 * Destructive Operation Guard Hook for AWS & Git
 *
 * Antigravity Lifecycle Hook (PreToolUse)
 * Intercepts tool executions (`run_command`, `call_mcp_tool`) to block or require
 * explicit human confirmation (HITL) for destructive actions on AWS environments and Git repositories.
 */

const fs = require('fs');

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    output({ decision: 'allow' });
    return;
  }

  if (!rawInput || !rawInput.trim()) {
    output({ decision: 'allow' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    output({ decision: 'allow' });
    return;
  }

  const toolCall = payload.toolCall;
  if (!toolCall || !toolCall.name) {
    output({ decision: 'allow' });
    return;
  }

  const toolName = toolCall.name;
  const args = toolCall.args || {};

  // 1. Inspect run_command
  if (toolName === 'run_command') {
    const commandLine = (args.CommandLine || '').trim();
    if (!commandLine) {
      output({ decision: 'allow' });
      return;
    }

    const checkResult = checkCommandLine(commandLine);
    if (checkResult) {
      output(checkResult);
      return;
    }
  }

  // 2. Inspect call_mcp_tool (e.g. GitHub MCP server)
  if (toolName === 'call_mcp_tool') {
    const serverName = args.ServerName || '';
    const mcpToolName = args.ToolName || '';
    const mcpArgs = args.Arguments || {};

    const checkResult = checkMcpTool(serverName, mcpToolName, mcpArgs);
    if (checkResult) {
      output(checkResult);
      return;
    }
  }

  // Default: Allow safe operations
  output({ decision: 'allow' });
}

/**
 * Checks command line string for destructive AWS and Git operations.
 */
function checkCommandLine(cmd) {
  // Normalize multiple spaces
  const normalized = cmd.replace(/\s+/g, ' ');

  // ==========================================
  // A. GIT DESTRUCTIVE OPERATIONS
  // ==========================================

  // A-1. Hard Deny: Force Push
  if (/git\s+push\b.*(-f\b|--force\b|--force-with-lease\b|\+[a-zA-Z0-9_\-\./]+)/i.test(normalized)) {
    return {
      decision: 'deny',
      reason: '【破壊的Git操作の拒否 (DENY)】--force / -f による強制プッシュはリモート履歴を不可逆に上書き・破壊する可能性があるため禁止されています。通常のトピックブランチを作成し、Pull Requestを利用してください。'
    };
  }

  // A-2. Hard Deny: Direct push to protected branches (main / master)
  if (/git\s+push\b.*(\borigin\s+(main|master)\b|\b(main|master)\b)/i.test(normalized)) {
    return {
      decision: 'deny',
      reason: '【破壊的Git操作の拒否 (DENY)】main / master ブランチへの直接プッシュは禁止されています（GitHub Flow違反）。必ず最新のmainからトピックブランチ（例: feature/issue-<番号>-<概要>）を作成し、Pull Request経由でマージしてください。'
    };
  }

  // A-3. Hard Deny: Deletion of protected branches (remote or local)
  if (/git\s+push\b.*(:main|:master|--delete\s+(main|master))/i.test(normalized) ||
      /git\s+branch\s+(-D|-d)\s+(main|master)\b/i.test(normalized)) {
    return {
      decision: 'deny',
      reason: '【破壊的Git操作の拒否 (DENY)】主要ブランチ（main / master）の削除操作は禁止されています。'
    };
  }

  // A-4. Hard Deny: Untracked files irreversible purge (git clean -f)
  if (/git\s+clean\b.*-[a-zA-Z]*f/i.test(normalized)) {
    return {
      decision: 'deny',
      reason: '【破壊的Git操作の拒否 (DENY)】git clean -f による未追跡ファイルの一括削除は作業内容を不可逆に消失させる危険があります。不要なファイルは個別に確認して削除するか、.gitignore を更新してください。'
    };
  }

  // A-5. Force Ask: Destructive working tree reset (git reset --hard)
  if (/git\s+reset\s+--hard\b/i.test(normalized)) {
    return {
      decision: 'force_ask',
      reason: '【高リスクGit操作の確認 (FORCE_ASK)】git reset --hard は未コミットの変更をすべて破棄します。不可逆な変更破棄となるため、人間の明示的な承認が必要です。'
    };
  }

  // A-6. Force Ask: Discarding unstaged/staged working tree files wholesale
  if (/git\s+(checkout|restore)\b.*(\s+--\s+\.|\s+\.)/i.test(normalized)) {
    return {
      decision: 'force_ask',
      reason: '【高リスクGit操作の確認 (FORCE_ASK)】カレントディレクトリ全体の作業変更を破棄しようとしています。人間の承認が必要です。'
    };
  }

  // A-7. Force Ask: Remote branch deletion or branch force deletion
  if (/git\s+push\b.*(--delete\s+|:\w+)/i.test(normalized) ||
      /git\s+branch\s+-D\b/i.test(normalized)) {
    return {
      decision: 'force_ask',
      reason: '【ブランチ削除操作の確認 (FORCE_ASK)】ブランチの完全削除が検知されました。実行前に人間の承認が必要です。'
    };
  }

  // A-8. Force Ask: GitHub PR merge via CLI
  if (/gh\s+pr\s+merge\b/i.test(normalized)) {
    return {
      decision: 'force_ask',
      reason: '【Pull Requestマージの確認 (FORCE_ASK)】PRのマージ実行が検知されました。CI/テスト通過およびレビュアー承認を確認のうえ、人間の承認が必要です。'
    };
  }

  // ==========================================
  // B. AWS DESTRUCTIVE OPERATIONS
  // ==========================================

  // B-1. Hard Deny: IaC Destroy (Terraform / CDK / Pulumi / Serverless)
  if (/(terraform\s+destroy|cdk\s+destroy|pulumi\s+destroy|(sls|serverless)\s+remove)\b/i.test(normalized)) {
    return {
      decision: 'deny',
      reason: '【破壊的AWSインフラ操作の拒否 (DENY)】IaC環境の全体破棄（terraform destroy / cdk destroy等）は本番・ステージング環境を全損させる危険があるため禁止されています。リソース削除は設計書および計画を承認した上で個別に行ってください。'
    };
  }

  // B-2. Hard Deny: AWS High-Impact Resource Deletions
  const awsHardDenyPatterns = [
    // S3 bucket removal
    {
      regex: /aws\s+s3\s+rb\b/i,
      msg: 'aws s3 rb によるS3バケット完全削除'
    },
    // S3 bucket-wide recursive wipe
    {
      regex: /aws\s+s3\s+rm\s+s3:\/\/[^\s\/]+\/?(\s+--recursive|\s*$)/i,
      msg: 'aws s3 rm --recursive によるバケット全体のオブジェクト一括消去'
    },
    // DynamoDB Table Deletion
    {
      regex: /aws\s+dynamodb\s+delete-table\b/i,
      msg: 'aws dynamodb delete-table によるDynamoDBテーブルの物理削除'
    },
    // RDS Instance/Cluster Deletion
    {
      regex: /aws\s+rds\s+(delete-db-instance|delete-db-cluster)\b/i,
      msg: 'aws rds delete-db-* によるデータベースインスタンス/クラスタの削除'
    },
    // EC2 Termination
    {
      regex: /aws\s+ec2\s+terminate-instances\b/i,
      msg: 'aws ec2 terminate-instances による仮想マシンの完全破棄'
    },
    // CloudFormation Stack Deletion
    {
      regex: /aws\s+cloudformation\s+delete-stack\b/i,
      msg: 'aws cloudformation delete-stack によるスタック全体の削除'
    },
    // IAM Role/User Deletion
    {
      regex: /aws\s+iam\s+(delete-role|delete-user|delete-group|delete-policy)\b/i,
      msg: 'aws iam delete-* によるセキュリティ・アクセス権限エンティティの削除'
    },
    // KMS Key Deletion
    {
      regex: /aws\s+kms\s+(schedule-key-deletion|disable-key)\b/i,
      msg: 'aws kms schedule-key-deletion による暗号化マスターキーの破棄'
    }
  ];

  for (const item of awsHardDenyPatterns) {
    if (item.regex.test(normalized)) {
      return {
        decision: 'deny',
        reason: `【破壊的AWS操作の拒否 (DENY)】${item.msg} が検知されました。データの恒久的な喪失やサービス停止を引き起こす破壊的操作はエージェントからの自動実行が禁止されています。`
      };
    }
  }

  // B-3. Force Ask: AWS Modifications & Partial Deletions (Requiring HITL Approval)
  const awsForceAskPatterns = [
    // S3 partial rm
    {
      regex: /aws\s+s3\s+rm\b/i,
      msg: 'aws s3 rm によるS3オブジェクトの削除'
    },
    // S3api delete-object
    {
      regex: /aws\s+s3api\s+(delete-object|delete-objects)\b/i,
      msg: 'S3オブジェクトの削除'
    },
    // DynamoDB Item Deletion
    {
      regex: /aws\s+dynamodb\s+(delete-item|batch-write-item)\b/i,
      msg: 'DynamoDBデータの削除または一括書き込み'
    },
    // EC2/RDS Stop/Reboot
    {
      regex: /aws\s+(ec2|rds)\s+(stop-|reboot-)/i,
      msg: 'インスタンス/DBの停止または再起動'
    },
    // IAM Policy Changes
    {
      regex: /aws\s+iam\s+(attach-|detach-|put-)/i,
      msg: 'IAMポリシーや権限の変更'
    },
    // Secrets Manager / SSM Parameter modifications
    {
      regex: /aws\s+(secretsmanager|ssm)\s+(delete-|put-|update-)/i,
      msg: 'シークレットやパラメータストアの更新または削除'
    },
    // Terraform / CDK / Pulumi Apply
    {
      regex: /(terraform\s+apply|cdk\s+deploy|pulumi\s+up)\b/i,
      msg: 'IaCによるインフラリソースの作成・変更（デプロイ）'
    }
  ];

  for (const item of awsForceAskPatterns) {
    if (item.regex.test(normalized)) {
      return {
        decision: 'force_ask',
        reason: `【重要AWS操作の確認 (FORCE_ASK)】${item.msg} が検知されました。環境への影響を考慮し、実行前に人間の承認（Human-in-the-loop）を要求します。`
      };
    }
  }

  return null;
}

/**
 * Checks call_mcp_tool calls for destructive actions.
 */
function checkMcpTool(serverName, toolName, mcpArgs) {
  // GitHub MCP Server
  if (serverName.includes('github') || toolName.startsWith('github_') || toolName.includes('issue') || toolName.includes('pull_request')) {
    if (toolName === 'delete_file') {
      const branch = mcpArgs.branch || '';
      if (branch === 'main' || branch === 'master') {
        return {
          decision: 'deny',
          reason: '【破壊的GitHub操作の拒否 (DENY)】保護ブランチ（main / master）上のファイルを直接削除することは禁止されています。トピックブランチからPull Requestを作成してください。'
        };
      }
      return {
        decision: 'force_ask',
        reason: `【GitHubファイル削除の確認 (FORCE_ASK)】ブランチ「${branch}」上のファイル削除が要求されました。人間の承認が必要です。`
      };
    }

    if (toolName === 'merge_pull_request') {
      return {
        decision: 'force_ask',
        reason: '【Pull Requestマージの確認 (FORCE_ASK)】GitHub MCP経由でのPRマージが要求されました。レビュー完了を確認のうえ、人間の明示的な承認が必要です。'
      };
    }
  }

  return null;
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

main();
