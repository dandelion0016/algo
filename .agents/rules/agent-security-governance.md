---
trigger: always_on
description: AIエージェントおよびシステム開発におけるセキュリティ・ガバナンスの設計・実装基準
---

# セキュリティ・ガバナンス設計基準

参照元: [AWS Summit Japan 2026から見る、AIエージェントのセキュリティ・ガバナンス](https://zenn.dev/nttdata_tech/articles/4bc069bcb74185)

システム設計および実装を行う際は、以下の原則を厳格に遵守すること。

## 1. 開発環境・MCP・初期IAMロールのセキュリティ基準（Phase 0-C）
- **最小権限の原則（Least Privilege）**:
  - エージェント用IAMロールに `AdministratorAccess` やワイルドカード（`*`）の特権ポリシーを付与してはならない。
  - 人間に依頼する初期IAMロールは、開発フェーズで必要な特定リソース（S3バケット、DynamoDBテーブル、Bedrockモデル呼び出し等）へのアクセスのみを許可するポリシーとして起草すること。
- **認証情報（クレデンシャル）の安全な取り扱い**:
  - AWSアクセスキーやトークンをコードベースや設定ファイル、チャットに平文で埋め込んではならない。
  - 環境変数、AWS IAMロール（AssumeRole）、またはSecrets Manager / Token Vault経由で安全に注入する設計とすること。
- **MCPツールのスコープ分離**:
  - 各サブエージェントに提供するMCPツールは、担当領域に必要なもの（例: DB担当にはDBツール、API担当にはAPIツール）に限定し、不要な権限の横断露出を防止すること。

## 2. プロンプトに依存しない多層防御の実装
- **4つの防護レイヤー**:
  1. **LLM層**: プロンプト制約、Amazon Bedrock Guardrails等の入出力フィルター、PIIマスキング。
  2. **呼び出し層**: JWT・セッションから取得したユーザーID・テナントID・権限スコープの検証と下流伝搬。
  3. **ツール層**: ツール引数のスキーマ検証（Zod/Pydantic等）、業務ロジックによる認可チェック、および Antigravity Lifecycle Hook（`.agents/hooks.json` の PreToolUse による `force_ask`）による機械的強制介入。
  4. **リソース層**: データベースのRow-Level Security（RLS）、IAMポリシー、暗号化、ストレージ境界。
- **テナント・ユーザー境界の機械的強制**:
  - テナントIDやユーザーIDのフィルタリングをLLMの推論（例: プロンプトで「WHERE句にtenant_idを含めて」と指示するなど）に依存させてはならない。
  - バックエンド側で実行コンテキストから機械的に識別子をインジェクションし、DB層やストレージ層で強制すること。

## 3. 認可と権限委任（Inbound / Outbound Auth）
- **Inbound Auth**: エージェント呼び出し元のユーザー/クライアントをIdPトークンで必ず認証・認可する。
- **Outbound Auth**: エージェントが外部SaaSや社内APIにアクセスする際は、静的な管理者キーを使わず、ユーザー委任トークンまたは適切なSecret管理機構（Token Vault / Secrets Manager）を経由し、最小権限（Least Privilege）でアクセスすること。

## 4. Human-in-the-loop (HITL) と破壊的操作の機械的遮断
- **取り消し不能または破壊的操作の強制抑止（PreToolUse Guard Hook）**:
  - Antigravity Lifecycle Hook (`.agents/hooks/guard-destructive.js` / `.ps1`) により、以下の破壊的操作は機械的に `deny`（即時拒否）または `force_ask`（人間の明示的承認必須）として強制介入する。
    1. **AWS破壊的操作の抑止**:
       - `deny`: `aws s3 rb`、`aws s3 rm --recursive` (バケット全体)、`aws dynamodb delete-table`、`aws rds delete-db-*`、`aws ec2 terminate-instances`、`aws cloudformation delete-stack`、`aws iam delete-*`、`terraform destroy`、`cdk destroy` 等のインフラ・データ全損コマンド。
       - `force_ask`: `terraform apply`、`cdk deploy`、`aws s3 rm`、`aws dynamodb batch-write-item`、権限変更（`iam attach/detach`）等。
    2. **Git破壊的操作の抑止**:
       - `deny`: `git push --force` / `-f`、`main` / `master` への直接プッシュ（GitHub Flow厳守）、主要ブランチの削除（`:main` / `branch -D main`）、`git clean -f`（未追跡ファイル全損）。
       - `force_ask`: `git reset --hard`、`git restore .`、トピックブランチ削除、`gh pr merge` 等。
- **業務・アプリケーション層におけるHITL組み込み**:
  - 以下の操作を実行する設計では、必ず人間の確認・承認ステップ（保留ステータス、承認Webhook、確認ダイアログ等）を挟むアーキテクチャにすること：
    - データの物理削除・バルク更新
    - 外部へのメッセージ・メール送信
    - 金銭・クレジットの移動
    - ユーザー権限・ロールの変更
    - 本番・ステージング環境への設定反映

## 5. 可観測性（Observability）と監査ログ
- エージェントの挙動を後から検証・説明できるよう、以下の情報を構造化ログおよび分散トレース（OpenTelemetry準拠等）として記録すること：
  - 呼び出し元情報（User ID, Tenant ID, Session ID）
  - 選択されたツール名と呼び出し引数
  - ツールの実行結果およびエラー情報
  - GuardrailsやPolicyによる遮断履歴
  - 人間の承認実行ステータス
- 機密情報（パスワード、APIトークン、平文PII）はログ出力前に必ずマスキングすること。
