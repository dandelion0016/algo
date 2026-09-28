# システム設計書体系ガイドライン (Phase 0-B)

本ディレクトリ（`docs/design/`）は、**Phase 0-B（システム設計書作成フェーズ）** において各専門サブエージェントが自律策定する設計ドキュメント群を格納します。

一般的なシステム開発の品質標準を満たしつつ、**「人間（レビュアー・承認者・ステークホルダー）がひと目で構造や振る舞いを直感的に理解できる」** ように、Mermaidダイアグラム、構造化Markdownテーブル、型定義を徹底して活用します。

---

## 1. 専門領域別ドキュメント体系一覧

| 領域 | 格納ディレクトリ | 作成ドキュメント | 一般的なシステム開発における目的と内容 | 主な可読性表現（図・表） |
| :--- | :--- | :--- | :--- | :--- |
| **フロントエンド** | [`frontend/`](./frontend/) | `screen-flow.md`<br>`screen-specs.md`<br>`hitl-flow.md`<br>`uat-assistance-spec.md` | 画面一覧、画面遷移、ステートマシン、ワイヤーフレーム、入力バリデーション、HITL承認ダイアログ仕様、実機UAT自動化アシスト仕様 | Mermaid `stateDiagram-v2` / `flowchart`<br>画面一覧表、バリデーション表、UATエビデンス表 |
| **バックエンド/API**| [`backend/`](./backend/) | `api-spec.md`<br>`sequence-diagrams.md`<br>`error-handling.md` | エンドポイント定義、型安全なI/Oスキーマ、業務ロジック処理フロー、例外・RFC7807エラー規約 | Mermaid `sequenceDiagram`<br>API仕様表、エラーコードマトリクス |
| **データベース** | [`database/`](./database/) | `er-diagram.md`<br>`schema-spec.md`<br>`rls-multitenant.md` | データモデリング、ER関係、テーブル定義、型・制約・インデックス選定、RLSマルチテナント分離設計 | Mermaid `erDiagram`<br>テーブル定義表、インデックス一覧表、RLSポリシー表 |
| **セキュリティ** | [`security/`](./security/) | `defense-in-depth.md`<br>`auth-spec.md`<br>`threat-modeling.md`<br>`audit-logging.md` | 4層防御アーキテクチャ、認証・認可シーケンス、STRIDE/OWASP脅威分析と対策、構造化監査ログ設計 | Mermaid `flowchart` / `sequenceDiagram`<br>4層防護表、脅威対策表、ログスキーマ表 |
| **SRE・運用** | [`sre/`](./sre/) | `observability-sli-slo.md`<br>`alert-matrix.md`<br>`incident-runbook.md`<br>`backup-dr-maintenance.md`<br>`cicd-pipeline.md` | SLO/SLI目標値、監視アラート基準、インシデント初動エスカレーションフロー、バックアップ・PITR・DR設計、GitHub Actions CI/CD・品質ゲート・自動ロールバック設計 | Mermaid `flowchart TD` (エスカレーション、CI/CDパイプライン)<br>SLI/SLO定義表、P1〜P4アラート表、CI/CDステージマトリクス |
| **インフラ基盤** | [`infrastructure/`](./infrastructure/) | `architecture.md`<br>`network-spec.md`<br>`iac-spec.md`<br>`iam-least-privilege.md` | クラウド全体構成図、VPC/サブネット・SG通信マトリクス、IaC構成・タグ規約、IAM最小権限ポリシー | Mermaid `graph TD` / `flowchart TD`<br>CIDR一覧表、通信マトリクス表、IAMポリシー表 |

---

## 2. 人間可読性（Human Readability）を高める必須ルール

各専門エージェントは、ドキュメント作成時に以下の表現原則を遵守してください：

1. **ビジュアルファースト（Mermaidの積極活用）**:
   - 画面遷移、コンポーネント構成、API呼び出しシーケンス、データモデル（ER）、インフラネットワーク構成、インシデント初動フローは、テキストの羅列ではなく必ず Mermaid ダイアグラムで図解する。
2. **構造化テーブル（Markdown Tables）の標準化**:
   - 入力項目、APIパラメータ、テーブルカラム、監視アラート、脅威分析など、一覧性が必要な情報はすべてMarkdownテーブルとして記載し、物理名・論理名・型・必須区分・説明を揃える。
3. **サマリと詳細の分離（TL;DR / 設計方針の明示）**:
   - 各ドキュメントの冒頭に「目的・概要」「主要な設計方針（3〜5行サマリ）」を配置し、詳細を追わなくても全体方針が把握できるようにする。
4. **単一の真実源（Single Source of Truth）との連携**:
   - 要件定義書（`specs/requirements.md`）の要件IDやユースケースとの対応関係を明記する。
