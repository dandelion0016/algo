# インフラ IAM ＆ 最小権限ポリシー設計書

参照基準: [AWS Summit Japan 2026から見る、AIエージェントのセキュリティ・ガバナンス](https://zenn.dev/nttdata_tech/articles/4bc069bcb74185)

## 1. IAM設計基本方針
- **最小権限の原則（Least Privilege）**:
  - `AdministratorAccess` やワイルドカード（`Resource: *` や `Action: *`）の特権付与を厳禁とする。
  - 各ロールが必要とする具体的アクション（例: `dynamodb:GetItem`, `bedrock:InvokeModel`）のみを個別許可。
- **一時クレデンシャルの利用**:
  - 長期的なアクセスキー（AK/SK）をコンテナ内やコードに保持させず、**IAM Roles for ECS Tasks** または **AssumeRole** による一時認証情報を利用。
- **リソース限定 ＆ 条件付きアクセス (Condition Blocks)**:
  - リソースARNをピンポイントで指定し、タグ（`aws:ResourceTag/Project`）やVPCエンドポイント経由に限定。

---

## 2. 主要IAMロール一覧

| ロール名 | 引き受けプリンシパル | 用途 | 付与ポリシー概要 |
| :--- | :--- | :--- | :--- |
| `agy-ecs-task-execution-role` | `ecs-tasks.amazonaws.com` | ECSタスクの起動・停止 | ECRからのイメージプル、CloudWatch Logsへのログ出力、Secrets Managerからの環境変数取得 |
| `agy-backend-app-role` | `ecs-tasks.amazonaws.com` | バックエンドアプリ実行 | Aurora接続、KMS復号化、Bedrockモデル呼出、S3特定プレフィックスの読書 |
| `agy-agent-execution-role` | `lambda.amazonaws.com` / ECS | AIエージェントツール実行 | 許可されたツール対象リソース（特定テーブル、特定Secrets）への限定アクセス |
| `agy-sre-ops-role` | オンコールエンジニア (SSO) | インシデント初動調査 | CloudWatch閲覧、ECSタスク再起動、ログ調査（データ直接変更権限は剥奪） |

---

## 3. ポリシー実装例（バックエンド ＆ Bedrock呼び出しロール）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeSpecificModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-*"
      ]
    },
    {
      "Sid": "SecretsManagerGetSpecificSecret",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:agy-prod-db-creds-*"
    },
    {
      "Sid": "KMSDecryptSpecificKey",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"
    }
  ]
}
```

---

## 4. 人間に依頼する初期作業用テンプレート（Phase 0-C）
開発初期フェーズ（Phase 0-C）で人間（クラウド管理者）に依頼する初期IAMロール・ポリシーは、上記のようにリソースARNを特定し、過剰な権限を持たない形式で起草して提供すること。
