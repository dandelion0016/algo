# SRE インシデント初動 ＆ Runbook基本設計書 (Incident Runbook)

本設計書は、「アルゴ（algo）Web対戦システム」において障害・異常が発生した際の標準対応手順書（Runbook）を定義します。
特に**「静的デプロイ後の不具合に伴う迅速ロールバック手順」**および**「AWS無料枠超過・課金アラート発報時の緊急停止・初動対応手順」**を体系化します。

---

## 1. インシデント初動対応フロー (Incident Response Flow)

```mermaid
flowchart TD
    Detect["障害検知 (Budgets $0.01 / 5xx多発 / 画面白濁報告)"] --> Triage{"重大度判定"}

    Triage -->|課金発生 (ALM-001)| BudgetStop["【緊急Runbook 2.2】<br>課金元特定 & 流出遮断 (Distribution一時停止等)"]
    Triage -->|サービス停止 (ALM-003)| Rollback["【緊急Runbook 2.1】<br>S3直前安定バージョンへのロールバック & キャッシュ破棄"]
    Triage -->|軽度警告 (P2/P3)| NormalFix["ログ調査 & 原因究明"]

    BudgetStop --> PostMortem["ポストモーテム (原因究明・再発防止策策定)"]
    Rollback --> Verify["ヘルスチェック & 正常性確認"]
    Verify --> PostMortem
```

---

## 2. 標準運用Runbook

### 2.1 デプロイ即時ロールバック手順 (Deployment Rollback Runbook)

最新のGitHub Actionsデプロイ後、5xxエラーが急増した場合や重大な画面不具合が発生した場合の復旧手順です。

#### 方式 A: GitHub Actions 経由の即時再デプロイ（推奨）
1. GitHubリポジトリの Actions タブを開く。
2. 直前で「成功」していたワークフロー実行履歴を選択。
3. **「Re-run all jobs」** をクリックして直前の正常ビルドをS3へ再同期。
4. デプロイ完了後、CloudFrontキャッシュ破棄が自動実行されることを確認。

#### 方式 B: AWS CLI による手動ロールバック（緊急時）
ローカルのバックアップ成果物またはGit過去コミットから直接復旧する場合：
```bash
# 1. 安定コミットのチェックアウト
git checkout <previous-stable-commit-hash>

# 2. 静的ビルドの再生成
npm ci
npm run build

# 3. S3バケットへ即時同期（古いファイルの削除含む）
aws s3 sync out/ s3://algo-prod-apne1-static-hosting-123456789012 --delete

# 4. CloudFront キャッシュの即時破棄（全ファイル対象）
aws cloudfront create-invalidation \
  --distribution-id E1234EXAMPLE56 \
  --paths "/*"
```

---

### 2.2 AWS無料枠超過（$0.01課金検知）時の緊急停止・初動対応手順 (Zero-Cost Emergency Runbook)

AWS Budgets から「$0.01課金発生」アラートが届いた場合の緊急遮断手順です。

#### Step 1: 課金元サービスの特定（5分以内）
```bash
# 本日分の利用料金・発生サービスをAWS CLIで確認
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```
- **主な原因シナリオ**:
  - `AmazonCloudFront`: 転送量1TB超過、または過剰なInvalidation（月1,000パス超過）。
  - `AmazonS3`: キャッシュミス多発によるGETリクエスト20,000回超過。
  - `Route53`: ホストゾーン課金（$0.50/月）。

#### Step 2: 課金流出の緊急遮断（必要時）
悪意あるDDoSやボット攻撃による転送量爆発が原因である場合、被害拡大を防ぐためCloudFront Distributionを一時的に無効化（Disabled）します：

```bash
# 1. 現在のディストリビューション設定を取得
aws cloudfront get-distribution-config --id E1234EXAMPLE56 > /tmp/cf-config.json

# 2. ETagを取得し、設定ファイルの "Enabled": false に書き換え
# 3. 設定を反映して配信を即時停止
aws cloudfront update-distribution \
  --id E1234EXAMPLE56 \
  --if-match <ETag> \
  --distribution-config file:///tmp/cf-config-disabled.json
```

#### Step 3: キャッシュ設定・レート制限の恒久修正
- S3への直アクセスを防ぐCache-Controlヘッダー（長期キャッシュ）の再設定。
- クライアントIPごとのアクセスレート制限をCloudFront / WAFで引き締め。

#### Step 4: サービスの安全な再開
- 課金原因の解消を確認後、再度ディストリビューションを `Enabled: true` に戻す。

---

## 3. ポストモーテム（事後振り返り）テンプレート

インシデント収束後、24時間以内に以下の項目を記録し、チームで再発防止策を共有します：

1. **基本情報**: インシデント発生日時、収束日時、総停止時間、発生課金額（例: $0.03）
2. **影響サマリ**: 影響を受けたユーザー数、エラー件数
3. **根本原因（5 Whys）**:
   - なぜ課金が発生したか？ ➔ キャッシュ無効化の対象パスが細分化されすぎていたため
   - なぜ細分化されたか？ ➔ CI/CDスクリプトの指定が不適切だったため
4. **恒久再発防止アクション**:
   - CI/CDパイプラインへの課金ガードテスト導入
   - レビュー観点シート（`docs/review-checklists/`）の更新
