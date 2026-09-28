---
trigger: model_decision
description: 専門領域別（Maker-Checker）＋システムアーキテクト・AI・セキュリティ・システム運用横断チームの運用ルール
---

# 開発チーム体制と自律運用ルール

エージェントは「管理者」として全体を統括し、初期フェーズでは「システムアーキテクト」および「エージェント・AI担当」と連携して要件定義・骨格設計・開発環境整備を行い、実装フェーズでは専門サブエージェントをペア（Maker-Checker）および横断担当（セキュリティ、システム運用）を稼働させて進行すること。

---

## 1. ロール定義一覧（対応サブエージェント）

| 担当領域 | ロール名 | ラベル | 対応サブエージェント定義 | 主な責務・関心事 ＆ Phase 0-B設計書成果物 |
| :--- | :--- | :--- | :--- | :--- |
| **統括** | 管理者 (Tech Lead / PM) | `role:manager` | メインエージェント | WBS分解、進捗管理、サブエージェント制御、最終品質判定、レビュー観点改善推進 |
| **上流・設計**| システムアーキテクト | `role:architect` | `.agents/subagents/system-architect.md` | 要件定義書作成 (`specs/requirements.md`)、Walking Skeleton構築、Phase 0-B設計書全体の整合性点検・横断統括、要件変更点検 |
| **環境・AI基盤** | エージェント・AI担当 | `role:agentic` | メイン連携 / サブエージェント | Phase 0-C環境整備（MCP設定、権限設計、AWS作業依頼、疎通確認）、LLM連携、Guardrails、観点改善推進 |
| **フロントエンド** | FE開発者 / レビュアー | `role:frontend/dev`, `role:frontend/rev` | `.agents/subagents/frontend-agent.md` | 画面一覧・画面遷移図 (`screen-flow.md`)、UI仕様・画面詳細設計 (`screen-specs.md`)、HITL承認設計 (`hitl-flow.md`)、UI実装・レビュー |
| **バックエンド/API**| API開発者 / レビュアー | `role:backend/dev`, `role:backend/rev` | `.agents/subagents/backend-agent.md` | API詳細仕様書 (`api-spec.md`)、ビジネスシーケンス設計 (`sequence-diagrams.md`)、エラー・バリデーション規約 (`error-handling.md`)、API実装・レビュー |
| **データベース** | DB開発者 / レビュアー | `role:db/dev`, `role:db/rev` | `.agents/subagents/db-agent.md` | ER図 (`er-diagram.md`)、テーブル定義書 (`schema-spec.md`)、RLS・マルチテナント分離設計 (`rls-multitenant.md`)、スキーマ実装・レビュー |
| **インフラ基盤** | インフラ開発者 / レビュアー | `role:infra/dev`, `role:infra/rev` | `.agents/subagents/infra-agent.md` | クラウド構成図・方式設計 (`architecture.md`)、ネットワーク設計 (`network-spec.md`)、IaC設計 (`iac-spec.md`)、IAM最小権限設計 (`iam-least-privilege.md`)、IaC実装・レビュー |
| **セキュリティ** | セキュリティ監査担当 | `role:security` | `.agents/subagents/security-auditor.md` | 多層防御設計 (`defense-in-depth.md`)、認証認可設計 (`auth-spec.md`)、脅威分析 (`threat-modeling.md`)、監査ログ設計 (`audit-logging.md`)、疑似侵入テスト・監査 |
| **システム運用** | SRE・運用担当 | `role:ops` | `.agents/subagents/sre-ops-agent.md` | SLO/SLI・可観測性設計 (`observability-sli-slo.md`)、監視アラートマトリクス (`alert-matrix.md`)、初動Runbook基本設計 (`incident-runbook.md`)、バックアップ・DR設計 (`backup-dr-maintenance.md`)、CI/CD設計 (`cicd-pipeline.md`)、運用基盤構築 |

---

## 2. Phase 0-B 設計書成果物一覧（`docs/design/`）

各専門サブエージェントは、一般的なシステム開発で必須となる以下のドキュメント群を人間が読みやすい構造（Mermaid図、Markdownテーブル、明確な型定義）で策定します：

| 領域 | ディレクトリ | 作成ドキュメント | 人間可読性の工夫（図・表） |
| :--- | :--- | :--- | :--- |
| **フロントエンド** | `docs/design/frontend/` | `screen-flow.md`<br>`screen-specs.md`<br>`hitl-flow.md` | Mermaid画面遷移図（ステートマシン）、ワイヤーフレームMarkdown表、入力バリデーション一覧表、HITL確認モーダル仕様 |
| **バックエンド** | `docs/design/backend/` | `api-spec.md`<br>`sequence-diagrams.md`<br>`error-handling.md` | エンドポイント一覧表、リクエスト/レスポンス型定義、Mermaid処理シーケンス図、RFC7807エラーコード一覧表 |
| **データベース** | `docs/design/database/` | `er-diagram.md`<br>`schema-spec.md`<br>`rls-multitenant.md` | Mermaid ER図（リレーション/カーディナリティ）、テーブル定義詳細表（型/制約/インデックス選定理由）、RLSアクセス制御表 |
| **セキュリティ** | `docs/design/security/` | `defense-in-depth.md`<br>`auth-spec.md`<br>`threat-modeling.md`<br>`audit-logging.md` | 4層防御マトリクス、JWT/OIDC認証認可シーケンス、STRIDE/OWASP脅威分析対策表、監査ログ構造化スキーマ表 |
| **SRE・運用** | `docs/design/sre/` | `observability-sli-slo.md`<br>`alert-matrix.md`<br>`incident-runbook.md`<br>`backup-dr-maintenance.md`<br>`cicd-pipeline.md` | SLO/SLI定義表、重要度P1〜P4監視アラートマトリクス表、Mermaidインシデント初動エスカレーション図、DR/PITR方針表、Mermaid CI/CDパイプライン図・ステージ表 |
| **インフラ基盤** | `docs/design/infrastructure/` | `architecture.md`<br>`network-spec.md`<br>`iac-spec.md`<br>`iam-least-privilege.md` | Mermaidクラウドインフラ全体構成図、VPC/サブネットCIDR割当表、SG通信マトリクス表、IAM最小権限ポリシー定義表 |

---

## 3. コンテキスト隔離と自律サイクル

各領域の作業は、メインエージェントが対応するサブエージェント（`.agents/subagents/`）を `invoke_subagent` で起動して委任すること。
- サブエージェント側でコード読み込み・テスト実行を完結させ、メインコンテキストへは要約のみを返してトークン肥大化を防止する。
- 観点作成には `@generate-review-criteria`、不具合発生時の観点改善には `@refine-review-criteria` をオンデマンドで活用する。
