# Antigravity プロジェクト開発指示書 (GEMINI.md)

本プロジェクトでは、Google Antigravity を「自律型AIエージェントチーム」として稼働させ、堅牢なセキュリティ・ガバナンスと高品質なコードベースを維持しながらシステム開発を推進します。

---

## 1. 基本運用原則

1. **動的コンテキスト管理（Token Bloat防止）の徹底**:
   - **Subagent-per-Issue（1 Issue 1 Subagent原則）によるコンテキスト完全分離**:
     - メインエージェントはオーケストレーター（統括管理者）として動作し、個別のIssue対応（コード探索、詳細実装、テスト実行、自己修正）はすべて1つのIssueごとに専門サブエージェント（`.agents/subagents/`）へ丸ごと委任すること。
     - サブエージェント側で作業ブランチ上の実装とテストを完結させ、メインコンテキストには「PRリンクおよびテスト結果サマリ」のみを報告させることで、メインエージェントのコンテキスト汚染を完全に防止する。
     - これにより、メインエージェントはセッションリフレッシュ（/clear）を行わずとも、同一セッション内で複数のIssueを連続的・自律的に次々と推進できる。
   - **Externalized State ＆ GitHub Projects一元管理**:
     - 状態はすべて外部ファイル（`PROJECT_STATUS.md`、`specs/`）および GitHub Issue / Projects に永続化。
     - `PROJECT_STATUS.md`: マクロなフェーズ・ゲート承認状況（Phase 0-A, 0-B, 0-C, Phase 1, Gate 1）のみを管理（フェーズ移行時のみ人間ゲートキーパー承認が必要）。
     - **GitHub Projects**: 全フェーズ（Phase 0-A〜Phase 1）の個別Issue進捗（Todo / In Progress / Done）、ブランチ、PR、テスト結果を一元管理（エージェントが承認不要で即時自動同期）。
   - **Progressive Disclosure**: ルールやスキルは常時全文注入せず、必要局面（`model_decision`, `@メンション`）でのみオンデマンドに読み込むこと。
2. **四段階の自律型開発プロセス（要件・骨格 → コア設計 → 環境整備・疎通 → 自律実装 ＆ 継続的受入・仕上げ）**:
   - **Phase 0-A**: 要件定義書（`specs/requirements.md`）とWalking Skeleton（最小疎通基盤）を一貫自律構築。人間のFIX承認を得る。
   - **Phase 0-B**: 一般的なシステム開発で作るべき設計書群（フロントエンド、バックエンド、DB、セキュリティ、SRE、インフラ）を人間が読みやすい構造（Mermaid図、一覧表、型定義）で自律策定（`docs/design/`）。人間の設計書FIX承認を得る。
   - **Phase 0-C**: 承認済み設計書に基づき、エージェント・AI担当がMCP・権限設定を行い、人間へAWS初期環境の作業依頼を実施。完了後に自律疎通テストを行い、人間の環境整備完了承認を得る。
   - **Phase 1**: 自律実装 ＆ 継続的受入・仕上げ（Continuous Delivery & Feedback）。設計書群（`docs/design/`）と初期基盤コードを照合し、`spec-gap-auditor` が課題抽出・Issue起票し、トピックブランチで自律実装・自動テスト・UAT自動化アシスト（E2E・画面スナップショット）付きPRを作成（`@autonomous-gap-resolver`）。全フェーズの作業進捗は GitHub Projects（カンバン）に自律同期し、日常タスク更新で承認は求めない。人間はPRの受入サマリ確認・実機操作・マージ承認を行い、設計乖離はADRで吸収しながら完全なシステムへ仕上げる。全要件充足でプロジェクト完了（Gate 1）。
3. **レビュー観点の明確化と継続的ブラッシュアップ**:
   - レビュアーは `@generate-review-criteria` スキルを活用し、システム固有要件および採用クラウド・製品の公式ベストプラクティスを網羅したレビュー観点シート（`docs/review-checklists/`）を定義すること。
   - 後続工程やテストで不具合が検知された場合、管理者とAI担当が `@refine-review-criteria` スキルを実行し、レビュー観点シートを自律的にブラッシュアップして再発防止すること。
4. **チーム横断のシステム運用・SRE設計の徹底**:
   - 障害検知・初動復旧フロー、脆弱性定期スキャン、シークレットローテーション、DBバックアップ手順（Runbook）をコード・ドキュメントとして仕組み化すること。
5. **要件定義の変更管理（Change Control）の徹底**:
   - 水平タスク開発中の要件変更は開発者が独断で行わず、システムアーキテクトが点検した上でユーザー承認を得てから更新すること。
6. **人間は「ゲートキーパー（承認者）」に集中する**:
   - 各フェーズ内のリサーチ・設計・実装・テスト・レビュー・自己修正、および日常のタスク進捗更新（GitHub Projects）はエージェントが完全自律で完走すること。
   - 要件定義FIX、設計書FIX、環境疎通FIX、Gate 1（プロジェクト完了）のフェーズ節目でのみ人間へ承認を要請すること。日常的なタスク更新・ステータス更新でユーザー承認を求めてはならない。
7. **多層防御のセキュリティ・ガバナンス**:
   - プロンプトだけに依存せず、呼び出し層、ツール層、リソース層（DB等）でテナント境界・認可を機械的に強制すること。
   - 破壊的操作・重要更新にはHuman-in-the-loop（承認）を必須とすること。
   - **Turboモード抑止（Lifecycle Hooks）**: Phase移行やGate承認書き換えは `.agents/hooks.json`（PreToolUse）により機械的にインターセプトされ、Turboモード実行中であっても必ず人間に承認（`force_ask`）を求めるよう保護されていること（Phase内の日常タスク更新は自律実行を維持）。
8. **Issue駆動型ブランチ・Pull Request運用の徹底（GitHub Flow ＆ ブランチ規約）**:
   - `main` ブランチへの直接コミット・直接プッシュは厳禁とする。
   - GitHub Issue対応時は、必ず最新の `main` から規約に則った個別のトピックブランチ（`feature/*`, `fix/*`, `chore/*`）を新設して作業すること。
   - **ブランチプレフィックス命名規約 ＆ ADR・設計書同期マトリクス**:
     | ブランチ名 | 用途 | ADR要否 (`docs/adr/`) | 設計書同期 (`docs/design/`) |
     | :--- | :--- | :---: | :---: |
     | **`feature/*`** | **機能追加** (新機能・新コンポーネント・新ルール) | **必須** (ADR起票・承認が前提) | **必須** (該当設計書を同時更新) |
     | **`fix/*`** | **軽微な修正** (バグ修正・UI崩れ・タイポ・軽微ロジック) | **不要** (ADRなしでOK) | 設計変更を伴う場合は更新、内部バグ修正は `[skip-doc-sync]` 許容 |
     | **`chore/*`** | **その他** (ガバナンス・CI/CD・依存更新・リファクタ・環境整備) | **不要** (ADRなしでOK) | 必要に応じて更新（SRE/インフラ等） |
     - ※ 上記3つ以外のブランチ名（例: `test/*`, `update/*`, `bugfix/*` 等）は機械的に禁止（Git Pre-Push Hook ＆ CI Branch Naming Guard によりブロック）。また、`src/` 変更時の設計書同時更新（Atomic Doc-Code Diff Guard）はローカル Git Native Pre-Push Hook（`.githooks/pre-push`）によりプッシュ時に機械的検証される。
   - 実装・検証（テスト、セキュリティ検査等）が完了後、作業ブランチをリモートへプッシュし、`main` を宛先（base）としたPull Requestを作成する。
   - PR本文に `Closes #<番号>` および実装サマリを明記すること。
   - **各チーム自動テスト結果の人間向けサマリ必須化**:
     - 単なる生ログ出力だけでなく、人間がひと目で直感的に理解できるよう、**各専門チーム・領域ごと（データベース、フロントエンド、バックエンド/API、セキュリティ監査、SRE運用等）のテスト種別、実行件数、合否ステータス、主な検証観点・成果** を構造化テーブル（Markdown形式）および解説箇条書きとしてPR本文に必ず明記すること。
9. **コード品質・自動フォーマット＆Lintの機械的強制（PostToolUse ＆ Git Hooks）**:
   - ソースファイル作成時（`write_to_file`）および変更時（`replace_file_content`）には、Antigravity Lifecycle Hook（`PostToolUse`）により Prettier / ESLint / Biome / 内蔵正規化処理（行末空白除去、末尾改行保証、JSON構文検証、JS構文チェック等）が機械的に自動実行されること。
10. **トークン消費最適化・コンテキスト監視の機械的強制（PreToolUse ＆ PreInvocation Hooks）**:
    - `view_file` による巨大ファイル（>300行）やロックファイルの無制限全量読み込みは、`token-budget-guard`（PreToolUse）により安全な行範囲（先頭150〜250行）へ overwrite される。
    - `run_command` による件数制限のない `git log`（自動 `-n 20` 付与）や `npm list`（自動 `--depth=0` 付与）、再帰探索（自動 `-Depth 3` 付与）も機械的に最適化され、ロックファイルの全画面ダンプは即時拒否（deny）される。
    - モデル推論直前（PreInvocation）には `token-context-monitor` が累積ステップ数（20/35ステップ）とトランスクリプトサイズを常時監視し、Token Bloat 発生時に警告メッセージを動的注入してサブエージェント委任およびセッションリフレッシュ（/clear）を機械的にガイドすること。
11. **ADR（Architecture Decision Records）による設計書ドリフト防止と追従同期**:
    - 実装中に設計書（`docs/design/`）との乖離や技術変更が発生した場合、エージェントは独断でコードを変えて設計書を形骸化させてはならない。
    - 必ず `docs/adr/` に ADR を `PROPOSED` で起票し、人間ゲートキーパーの承認を得た後、ステータスを `ACCEPTED` に更新して影響する設計書群を即座に追従更新すること。
12. **サーキットブレーカー（Circuit Breaker）による過剰リトライ・課金暴走の機械的抑止**:
    - 自律タスク実行中（Phase 1 ギャップ解消等）に同一コマンド（テスト失敗等）の連続実行（5回以上）や同一ファイルの短時間編集ループ（6回以上）を検知した場合、`circuit-breaker-guard`（PreToolUse）が作動し、`force_ask` により機械的に自律実行を一時停止して人間の判断を仰ぐこと。
13. **実機UAT・継続的受入の自動化アシスト（E2Eエビデンス・レポートの事前提示）**:
    - Phase 1 のPR作成時や受入時には、人間の目視受入負荷を極小化するため、Playwright 等による主要フローのE2Eテスト、画面スナップショット、受入サマリレポートをAIが自律生成してPRやステータスに提示すること。人間はエビデンスを確認した上で、気になったピンポイントのみを実機操作できる。
14. **小規模プロジェクト向け軽量・実用的設計（Pragmatic & Lightweight Governance）**:
    - 本スターターキットは少人数・小規模チームが迅速に動くものを作り、安全にスケールさせることを主目的とする。
    - 最初から20以上の設計書を過密に埋め立てる BDUF を強制せず、Phase 0-A（Walking Skeleton）→ Phase 0-B（コア設計: API・DB・画面・最小IAM）を優先構築し、高度なSREや監査設計はADRとともに必要に応じてJIT（Just-In-Time）で肉付けする軽量運用を推奨する。
15. **テスト完全性と骨抜き防止（Test Integrity ＆ Anti-Tampering）**:
    - **テスト期待値の書き換えによる通過の厳禁**:
      - テスト失敗時に、設計書（`docs/design/`）の記述や要件を確認せず、実装の返り値に合わせてテスト側の期待値やアサーションを緩める・書き換えてパスさせる行為（偽装追認）を「テスト改ざん」とみなし厳禁とする。
      - 設計書と実装に乖離が生じた場合は、独断でテストを書き換えてはならず、必ずADR（`docs/adr/`）を起票して人間ゲートキーパーの承認を得た上で設計書とテストを同期すること。
    - **自作自演・ロジック捏造テストの禁止**:
      - テスト対象コンポーネントをマウントせず、テストコード内にダミー関数（キーハンドラ等）を自作して呼び出す行為や、テストコード内で変数を算数減算して「機能合格」と判定する行為を厳禁とする。
      - UIコンポーネントテストは JSDOM + `@testing-library/react` を標準とし、ユーザーの操作（DOMイベント発火）と状態遷移を検証すること。
    - **ミューテーション耐性（骨抜きアサーションの排除）**:
      - テスト対象が何もしない恒等写像（例: `shuffleDeck` が単に配列コピーを返す等）であってもパスしてしまうような甘いアサーションを禁止し、破壊的変更に対して確実にFAILする検証項目を定義すること。
    - **非同期・PR前一括検証による軽量ガバナンス（Pragmatic Integrity Check）**:
      - 開発中のテンポを損なうリアルタイムの同期ブロック（PreToolUseフックによる都度承認）は行わず、コミット前またはPR作成時に一括自動監査（`npm run test:integrity`）を実行すること。
      - PR作成時には、既存テストの改ざんがないこと、スキップ（`.skip`）やダミー検証（`expect(true).toBe(true)`）が排除されていることを自動検証し、差分サマリ（Test Diff Transparency）をPR本文に明記すること。
16. **リリース完走保証とマージ後監視（Post-Merge Verification ＆ Anti-Silent-Fallback）**:
    - **マージ後CDワークフロー監視の義務化（DoDの拡張）**:
      - タスク完了（DoD: Definition of Done）は「PR作成」や「マージ完了」で終わらせず、**「mainマージ後のCDワークフロー（GitHub Actions）が完全SUCCESSで終了し、自動タグ・GitHub Release・S3/CloudFrontデプロイが完了したことを確認するまで」** を必須とする。
    - **クリーンインストール整合性の検証保証**:
      - ローカルの既存 `node_modules` に依存せず、CI環境（クリーンコンテナ）での依存関係解決（`npm ci --dry-run`）をコミット前・PR前に確認すること。
    - **サイレントフォールバック（偽の正常性バイアス）の排除**:
      - 環境変数や外部依存が未注入の際に、静的な古い値で平然とフォールバックしてエラーを隠蔽する設計を禁止する。ローカル開発時は `v0.0.0-dev (local)` 等で明示的に区別し、本番ビルドでの未注入はビルド時に即時検知・警告できる構造を維持すること。
    - **全解像度（Responsive / Mobile）でのメタ情報・視認性検証**:
      - デスクトップ幅だけでなく、モバイル（幅 < 1024px）や実機viewportにおいても、バージョン表記やシステムメタ情報が見切れ・非表示にならず確実に視認できることをUI検証観点として徹底すること。
17. **ドキュメント整合性とアトミック更新の機械的強制（Atomic Doc-Code Sync & Anti-Drift）**:
    - **コード・設計書アトミック更新の義務化**:
      - UIコンポーネント（`src/components/`）、コアライブラリ（`src/lib/`）、データ型・監査定義、永続化キー等の新規追加・変更を含むPRは、必ず対応する `docs/design/` の設計書更新を同一PR内にアトミック（不可分）に含めなければならない。コードのみの変更で設計書を形骸化させるPRの作成・マージを厳禁とする。
    - **DoD（完了の定義）への組み込み**:
      - タスク完了条件に「自動テスト全件合格」に加え「`npm run test:doc-integrity` 完全パス」を必須化する。
    - **CI ＆ ローカルGit Hookによる機械的ブロック (Doc Integrity & Diff Guard)**:
      - CIワークフロー（GitHub Actions）で `verify-doc-integrity` が常時実行され、設計書追従漏れのあるPRは機械的にマージ不可（FAIL）となる。
      - **差分ガード（Atomic Doc-Code Diff Guard）**: ローカル Git Native Pre-Push Hook（`.githooks/pre-push`）にてプッシュ時に機械的検証され、`src/` 配下にコード変更があるにもかかわらず `docs/` 配下に差分がない場合、コミットメッセージに `[skip-doc-sync]` が含まれていなければプッシュを即時ブロック（FAIL）。
      - **ADR強制フック（ADR Requirement Guard）**: CI（`ci.yml`）にて `feature/*` ブランチのPRでは、`docs/adr/` への新規/更新ADRの差分が機械的に検証され、未起票のPRはブロックされる。

---

## 2. 参照ルール・サブエージェント・スキル一覧

- `PROJECT_STATUS.md` : プロジェクト全体マクロフェーズ・ゲート承認管理（セッション開始時必読）
- [algo - 自律開発カンバンボード (GitHub Projects)](https://github.com/users/dandelion0016/projects/1) : 全フェーズ（Phase 0-A〜Phase 1）のタスク・Issue進捗一元管理（リアルタイムカンバン）
- `docs/adr/` : アーキテクチャ決定記録（ADR）ディレクトリ
- `.agents/hooks.json` : フェーズ移行・破壊的操作・サーキットブレーカー・トークン予算ガード（PreToolUse / PreInvocation）および自動フォーマット＆Lint（PostToolUse）
- `@.agents/rules/agent-security-governance.md` : 多層防御・認可・運用セキュリティ基準（常時適用）
- `@.agents/rules/adr-protocol.md` : ADR起票および設計書追従同期プロトコル
- `@.agents/rules/context-management.md` : 動的コンテキスト管理（サブエージェント委任、1 Issue 1 Session）
- `@.agents/rules/autonomous-phase-workflow.md` : フェーズゲート・変更管理・観点改善ワークフロー
- `@.agents/rules/team-matrix.md` : 役割分担（Maker-Checker）およびサブエージェント連携規約
- `@.agents/rules/issue-decomposition.md` : タスク肥大化防止と機能・運用タスク分解ルール
- `@.agents/rules/antigravity-best-practices.md` : 公式ベストプラクティス（検証ループ、サンドボックス）
- `@.agents/rules/github-board-sync.md` : GitHub CLI (`gh`) によるカンバン同期手順
- **サブエージェント (`.agents/subagents/`)**:
  - `system-architect.md`, `db-agent.md`, `backend-agent.md`, `frontend-agent.md`, `infra-agent.md`, `security-auditor.md`, `sre-ops-agent.md`, `spec-gap-auditor.md`, `test-integrity-auditor.md`
- **スキル (`.agents/skills/`)**:
  - `autonomous-gap-resolver`, `generate-review-criteria`, `refine-review-criteria`
