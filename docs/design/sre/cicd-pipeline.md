# SRE CI/CD パイプライン設計書

## 1. CI/CD 基本方針
- **採用プラットフォーム**: GitHub Actions
- **ブランチ戦略**: GitHub Flow 準拠（トピックブランチ ➔ Pull Request ➔ main）
- **セキュリティ方針**:
  - AWSアクセスには **GitHub OIDC (OpenID Connect)** を使用し、長期アクセスキー（AK/SK）を完全排除。
  - すべてのPRに対して静的解析、単体テスト、脆弱性スキャン、シークレット検出を必須化。
- **デプロイ戦略**:
  - Staging環境: `main` ブランチマージ時に自動デプロイ（Continuous Deployment）。
  - Production環境: ステージング検証完了後、GitHub Environments の承認ゲート（HITL承認）を経て Blue/Green または ローリングアップデートで安全にリリース。

---

## 2. パイプライン全体フロー

```mermaid
flowchart TD
    subgraph PullRequest["Pull Request イベント (CI)"]
        PR_Create["PR作成 / コミットPush"] --> CI_Lint["1. Lint & Format<br>(ESLint, Prettier / Ruff)"]
        CI_Lint --> CI_Test["2. 自動テスト & カバレッジ<br>(npm test / pytest / go test)"]
        CI_Lint --> CI_Sec["3. セキュリティ & 依存関係スキャン<br>(Trivy, Dependabot, GitGuardian)"]
        CI_Test --> CI_Build["4. コンテナビルド検証<br>(Docker build / dry-run)"]
        CI_Sec --> CI_Build
        CI_Build --> CI_Summary["5. 自動テスト結果サマリ生成<br>(PRコメントへ自動投稿)"]
    end

    subgraph MergeMain["main マージ後イベント (CD)"]
        Merge["main へのマージ"] --> CD_StgBuild["Stagingコンテナビルド & ECRプッシュ"]
        CD_StgBuild --> CD_StgDeploy["Staging環境へデプロイ (ECS Fargate)"]
        CD_StgDeploy --> CD_StgSmoke["スモークテスト & 外形ヘルスチェック"]

        CD_StgSmoke --> Gate_Prod{"🛑 Human-in-the-loop<br>本番デプロイ承認 (Environments)"}
        Gate_Prod -->|Approved| CD_ProdDeploy["Productionデプロイ (Blue/Green)"]
        CD_ProdDeploy --> CD_ProdVerify["Canary監視 & CloudWatch Alarms"]

        CD_ProdVerify -->|異常検知 (5xx急増)| Rollback["自動ロールバック (直前リビジョン)"]
        CD_ProdVerify -->|正常| Success["デプロイ完了通知 (Slack)"]
    end

    CI_Summary -->|LGTM & Status PASS| Merge
```

---

## 3. CI/CD ステージ定義マトリクス

| ステージ名 | トリガー | 主な実行タスク | ツール / アクション | 失敗時の振る舞い |
| :--- | :--- | :--- | :--- | :--- |
| **Lint & TypeCheck** | PR / Push | 静的解析、型チェック、フォーマット検証 | `npm run lint`, `tsc --noEmit`, `ruff check` | PRマージをブロック |
| **Unit & Integration Test** | PR / Push | 単体テスト実行、カバレッジ計測（目標80%以上） | `npm test -- --coverage`, `pytest --cov` | PRマージをブロック |
| **Security Scanning** | PR / 日次定期 | コンテナ・ライブラリ脆弱性検査、Secret漏洩検知 | `aquasecurity/trivy-action`, `gitguardian/ggshield` | `CRITICAL`/`HIGH` 検知でブロック |
| **Test Summary Reporter** | PR (CI完了時) | 各領域（DB, API, UI, Sec, SRE）テスト結果の集約 | 自律スクリプト ➔ PR本文・コメント更新 | 警告通知（CI自体は通過） |
| **Container Build & Push** | `main` マージ | マルチステージビルド、Amazon ECRへイメージ登録 | `docker/build-push-action`, AWS OIDC | デプロイ中断 |
| **Staging Deploy** | `main` マージ | ECSサービス更新、タスク定義登録、DBマイグレーション | `aws-actions/amazon-ecs-deploy-task-definition` | Slackアラート、旧版維持 |
| **Production Deploy** | 手動承認 (HITL) | 本番環境へのBlue/Green展開、カナリアトラフィック移行 | AWS CodeDeploy / ECS Blue-Green | 自動ロールバック発動 |

---

## 4. OIDC認証によるAWS最小権限連携

GitHub ActionsとAWS間の認証には、静的なアクセスキーをGitHub Secretsに保存せず、IAM OIDC IDプロバイダを用いた一時クレデンシャル（AssumeRoleWithWebIdentity）を採用します。

### GitHub Actions ワークフロー定義例 (`.github/workflows/ci.yml`)
```yaml
name: CI & Quality Gate

on:
  pull_request:
    branches: [main]

permissions:
  id-token: write # AWS OIDC用
  contents: read
  pull-requests: write # テスト結果サマリPRコメント用

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Linter & TypeCheck
        run: npm run lint

      - name: Run Tests with Coverage
        run: npm test -- --coverage

      - name: Run Security Scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Post Human-Readable Test Summary
        if: always()
        run: |
          node scripts/post-test-summary-to-pr.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5. デプロイ安全性 ＆ 自動ロールバック設計
1. **ゼロダウンタイムデプロイ**:
   - ECS Fargateの `minimumHealthyPercent=100`, `maximumPercent=200` を設定し、新規タスクのヘルスチェック成功を確認した後に旧タスクを終了させる。
2. **CloudWatch Alarms 連携の自動ロールバック**:
   - デプロイ直後15分間のカナリア監視期間中に、以下のいずれかが検知された場合、CodeDeploy / ECS が自動的に直前の安定タスクリビジョンへロールバックする：
     - `API 5xx エラーレート > 1.0%`
     - `外形ヘルスチェック連続失敗`
     - `コンテナタスク異常終了 (CrashLoop)`
3. **DBマイグレーションの互換性原則**:
   - デプロイとロールバックを安全に行うため、マイグレーションは常に「旧コード・新コードの双方が同時に動作可能な後方互換スキーマ変更（Expand and Contract パターン）」を徹底する。
