# AWS 初期環境整備 ＆ 作業依頼書 (Gate 0-C-1 作業ガイド)

本ドキュメントは、「アルゴ（algo）Web対戦システム」を AWS クラウド（S3 + CloudFront + Budgets ゼロ課金ガード + GitHub Actions デプロイ用IAMロール）上で安全に運用・デプロイするための**人間管理者向け初期作業手順書**です。

> [!TIP]
> **すべてのクラウドリソース（S3、CloudFront、Budgets $0.01アラート、OIDC連携IAMロール）が1つの CloudFormation テンプレートに統合されています。**
> 手動でのIAM作成やJSON書き換えは不要で、スタックを1回作成するだけで全基盤が自動構築されます。

---

## 📌 作業サマリ（所要時間：約3〜5分）

| ステップ | 作業内容 | 実施方法 |
| :---: | :--- | :--- |
| **Step 1** | **AWS CloudFormation スタック作成**<br>（S3 + CloudFront + Budgets + デプロイ用IAMロールを一括自動構築） | AWS CLI または AWS マネジメントコンソール |
| **Step 2** | **GitHub Secrets への環境変数登録**<br>（スタックの出力値 `AWS_ACCOUNT_ID`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID` を登録） | GitHub リポジトリ設定画面 |

---

## 🛠️ Step 1. AWS CloudFormation スタックの一括構築

本リポジトリに用意されている CloudFormation テンプレート [`infrastructure/cloudformation/main.yaml`](file:///infrastructure/cloudformation/main.yaml) を実行します。

### 【方法 A: AWS CLI で実行する場合（推奨・1コマンド）】

ターミナルで以下のコマンドを実行してください（`your-email@example.com` をアラート受信用メールアドレスに書き換えてください）：

```bash
aws cloudformation create-stack \
  --stack-name algo-prod-stack \
  --template-body file://infrastructure/cloudformation/main.yaml \
  --parameters ParameterKey=AlertEmail,ParameterValue="your-email@example.com" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1
```

> **注記**: すでにAWSアカウント内に GitHub OIDC プロバイダ（`token.actions.githubusercontent.com`）が作成済みの場合は、パラメータに `ParameterKey=CreateOIDCProvider,ParameterValue="false"` を追加してください。

> **確認**: 約3〜5分でスタック作成が完了します。完了後、以下のコマンドで出力値を確認できます：
> ```bash
> aws cloudformation describe-stacks --stack-name algo-prod-stack --query "Stacks[0].Outputs" --output table --region ap-northeast-1
> ```

### 【方法 B: AWS マネジメントコンソールで実行する場合】
1. AWSマネジメントコンソールにログインし、**東京リージョン（ap-northeast-1）** の **CloudFormation** を開きます。
2. **「スタックの作成」>「新しいリソースを使用 (標準)」** をクリック。
3. 「テンプレートの指定」で **「テンプレートファイルのアップロード」** を選び、[`infrastructure/cloudformation/main.yaml`](file:///infrastructure/cloudformation/main.yaml) をアップロードして「次へ」。
4. パラメータを入力して「次へ」：
   - スタック名: `algo-prod-stack`
   - `AlertEmail`: ご自身のメールアドレス
   - `CreateOIDCProvider`: 既にOIDCプロバイダがある場合は `false`、初めての場合は `true` のまま
5. 「スタックオプションの設定」はそのままで「次へ」。
6. 最下部の **「AWS CloudFormation によってカスタム名を持つ IAM リソースが作成される場合があることを承認します」** にチェックを入れて **「スタックの作成」** を実行。
7. ※ メールアドレスに AWS Notifications から確認メールが届くので、メール内の **「Confirm subscription」** をクリックしてください。

---

## 🔑 Step 2. GitHub Secrets への環境変数登録

CloudFormation スタックの作成が完了したら、コンソールの「出力 (Outputs)」タブ、または CLI 出力から値を確認し、GitHubリポジトリ（`dandelion0016/algo`）の **Settings > Secrets and variables > Actions** に進み、**「New repository secret」** から以下の3項目を登録してください：

| Secret名 | 設定する値 | スタックの出力キー (OutputKey) | 例 |
| :--- | :--- | :--- | :--- |
| `AWS_ACCOUNT_ID` | ご自身の12桁のAWSアカウントID | - | `123456789012` |
| `S3_BUCKET_NAME` | 作成されたS3バケット名 | `HostingBucketName` | `algo-prod-apne1-static-hosting-123456789012` |
| `CLOUDFRONT_DISTRIBUTION_ID` | 作成されたディストリビューションID | `CloudFrontDistributionId` | `E1A2B3C4D5E6F7` |

---

## ✅ Step 3. 完了後のご報告

上記 Step 1〜2 が完了しましたら、チャットにて **「作業完了しました」** とお知らせください。
AIエージェントが自動で疎通テスト（AWS接続・静的デプロイ疎通）を実施し、環境整備完了（Gate 0-C-2）および自律実装フェーズ（Phase 1）への移行確認を行います。
