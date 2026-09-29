# MCP 設定 ＆ サブエージェント権限設計書 (MCP & Agent Permissions Spec)

本ドキュメントは、「アルゴ（algo）Web対戦システム」における各専門サブエージェントの担当領域、利用可能なツールスコープ、およびMCP（Model Context Protocol）サーバー・クラウドアカウントの最小権限ポリシーを定義します。

---

## 1. サブエージェント別 役割 ＆ ツールスコープ・マトリクス

多層防御および最小権限の原則（Least Privilege）に基づき、各専門サブエージェントが必要とするツールのみを許可し、不要な横断権限を排除します：

| サブエージェント名 | 主担当領域 | 許可ツール / スコープ | 制限・禁止事項 |
| :--- | :--- | :--- | :--- |
| **`system-architect`** | 全体整合性・アーキテクチャ・ADR | 読み取り専用（設計書、コード）、ADR起票 | コード・インフラの直接改変禁止 |
| **`frontend-agent`** | Next.js UI、Tailwind CSS、画面遷移 | `src/app/`, `src/components/`, `public/` の編集 | インフラ・バックエンドAPIロジック改変禁止 |
| **`backend-agent`** | ゲームロジック、CPU推論、APIハンドラ | `src/lib/`, `src/app/api/`, テスト実行 | クラウド直接操作禁止 |
| **`db-agent`** | スキーマ、型定義、データ永続化（Phase 2） | `src/types/`, `infrastructure/cloudformation/` | パブリックアクセス許可設定禁止 |
| **`infra-agent`** | IaC、CloudFormation、GitHub Actions | `infrastructure/`, `.github/workflows/` | 本番破壊コマンド（`delete-stack`, `rb`）禁止 |
| **`sre-ops-agent`** | CI/CD、監視、FinOpsガード、Runbook | `.github/`, `docs/design/sre/`, テスト実行 | 権限昇格・認証情報出力禁止 |
| **`security-auditor`** | セキュリティ監査、多層防御検証 | 読み取り専用、静的解析実行 | 承認なしのポリシー変更禁止 |
| **`spec-gap-auditor`** | 設計書と実装のギャップ検出・Issue起票 | 読み取り専用、GitHub Issue起票 | コード直接改変禁止 |

---

## 2. MCP サーバー構成方針

| MCPサーバー名 | 用途 | 許可アクション | セキュリティ対策 |
| :--- | :--- | :--- | :--- |
| **`github-mcp-server`** | Issue/PR管理、ブランチ作成、コード参照 | Issue起票・更新、PR作成、差分参照 | `main` 直接プッシュ禁止、リポジトリ単位スコープ |
| **AWS CLI / OIDC** | CI/CDデプロイ、疎通テスト | S3同期（sync）、CloudFront無効化 | 短命トークン（15〜60分）、アクセスキー永続保存禁止 |

---

## 3. サーキットブレーカー ＆ 安全ガードの機械的保証

- **破壊的操作ガード (`.agents/hooks/guard-destructive.js`)**:
  - `aws s3 rb`、`aws cloudformation delete-stack`、`git push --force` などの破壊的コマンドは Lifecycle Hook で機械的に即時拒否（deny）または承認要求（force_ask）。
- **サーキットブレーカー (`.agents/hooks/circuit-breaker.js`)**:
  - 同一コマンドの連続失敗（5回以上）や同一ファイルの短時間編集ループ（6回以上）を検知した場合、自動停止して人間に介入を要求。
- **トークン予算ガード (`.agents/hooks/token-budget-guard.js`)**:
  - 巨大ファイルの一括読み込みや無制限のログダンプを安全な範囲（200行等）に機械的抑制。
