---
trigger: model_decision
description: GitHub Issueおよびカンバンボードとの進捗自動同期ルール
---

# GitHub Issue・ブランチ・Pull Request 運用およびカンバン自動同期ルール

エージェントはすべてのIssue対応において**GitHub Flow（トピックブランチ作成 ➔ プルリクエスト ➔ mainへのマージ取り込み）**を厳格に順守すること。
**`main` ブランチへの直接コミット・直接プッシュは厳禁**とする。

---

## 1. ブランチ命名規則

Issueに着手する際は、最新の `main` から以下の命名規則に従って作業ブランチを作成する。

| プレフィックス | 用途 | 命名例 |
| :--- | :--- | :--- |
| `feature/` | 新機能の開発 | `feature/issue-2-frontend-portal` |
| `fix/` | バグ修正 | `fix/issue-7-auth-token-expiry` |
| `ops/` | SRE、運用設計、CI/CD、アラート | `ops/issue-5-cloudwatch-alarms` |
| `test/` | セキュリティ監査、テストスイート追加 | `test/issue-6-security-audit` |
| `refactor/` | 仕様変更を伴わないコード改善 | `refactor/issue-8-db-repository` |
| `docs/` | ドキュメント整備、設計書更新 | `docs/issue-9-api-spec` |

---

## 2. Issue対応の標準ワークフロー

### Step 1: ブランチ作成 ＆ カンバンステータス更新
1. 最新の `main` を取得し、作業ブランチをチェックアウトする。
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <branch-name> main
   ```
2. 対象Issueのステータスを `status:in-progress` に更新する（GitHub MCP `issue_write` または `gh issue edit`）。
   - コメントにて作業着手を通知。

### Step 2: サブエージェントによる自律実装 ＆ 検証
1. 専門サブエージェントが作業ブランチ上でコード実装およびテストを実施する。
2. レビュー観点シートに沿った検証、ビルド・テストが100%成功することを確認する。
3. Conventional Commits 形式でコミットする。
   ```bash
   git commit -m "feat(scope): 変更内容 (closes #<ISSUE_NUM>)"
   ```

### Step 3: リモートプッシュ ＆ Pull Request作成
1. 作業ブランチをリモートへプッシュする。
   ```bash
   git push -u origin <branch-name>
   ```
2. `main` を宛先（base）としたPull Requestを作成する（GitHub MCP `create_pull_request` または `gh pr create`）。
   - **タイトル**: `<type>(<scope>): <PR概要> (closes #<ISSUE_NUM>)`
   - **ベースブランチ**: `main`
   - **ヘッドブランチ**: `<branch-name>`
   - **本文**:
     ```markdown
     ## 概要
     Closes #<ISSUE_NUM>

     ### 変更内容
     - ...

     ### 自動テスト結果サマリ（人間向け）
     | 領域 / チーム | テスト種別 | 実行件数 | 合否ステータス | 主な検証観点・成果 |
     | :--- | :--- | :--- | :--- | :--- |
     | **DB / データ** | 単体・マイグレーション・RLS検証 | ○件 | PASS | ... |
     | **バックエンド/API** | 単体・エンドポイント統合テスト | ○件 | PASS | ... |
     | **フロントエンド** | コンポーネント・UI統合テスト | ○件 | PASS | ... |
     | **セキュリティ** | 認可・権限越境・多層防御テスト | ○件 | PASS | ... |
     | **SRE / 運用** | ビルド・設定・ヘルスチェック | ○件 | PASS | ... |

     ### 検証ハイライト・解説
     - ...

     ### レビュー観点チェック
     - [x] ...
     ```
3. Issueラベルを `status:in-review` に更新し、ユーザーにPRリンクとWalkthroughを提示する。

### Step 4: レビュー ＆ mainへのマージ（取り込み）
1. 人間のレビュー確認・承認（またはマージ指示）を得る。
2. Pull Requestを `main` にマージする（GitHub MCP `merge_pull_request` または GitHub UI上でのマージ）。
3. マージ完了後、ローカルおよびリモートの作業ブランチを削除し、Issueがクローズされたことを確認する。
   ```bash
   git checkout main
   git pull origin main
   git branch -d <branch-name>
   git push origin --delete <branch-name>
   ```
