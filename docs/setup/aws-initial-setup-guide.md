# AWS 初期環境整備 ＆ 作業依頼書 (Gate 0-C-1 作業ガイド)

本ドキュメントは、「アルゴ（algo）Web対戦システム」を AWS クラウド（S3 + CloudFront + AWS Budgets ゼロ課金ガード）上で安全に運用・デプロイするための**人間管理者向け初期作業手順書**です。

---

## 📌 作業サマリ（所要時間：約5〜10分）

| ステップ | 作業内容 | 実施方法（選べます） |
| :---: | :--- | :--- |
| **Step 1** | **AWS CloudFormation スタック作成**<br>（S3バケット + CloudFront + Budgets $0.01アラートを自動一括構築） | AWS CLI または AWS マネジメントコンソール |
| **Step 2** | **GitHub Actions OIDC プロバイダ作成**<br>（キーレス一時認証用、既存であればスキップ可） | AWS CLI または AWS IAM コンソール |
| **Step 3** | **デプロイ用 IAM ロール作成 ＆ 最小権限ポリシー付与** | AWS CLI または AWS IAM コンソール |
| **Step 4** | **GitHub Secrets への環境変数登録**<br>（`AWS_ACCOUNT_ID`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`） | GitHub リポジトリ設定画面 |

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
  --region ap-northeast-1
```

> **確認**: 約3〜5分でスタック作成が完了します。完了後、以下のコマンドで出力値（BucketName, DistributionId, DomainName）を確認できます：
> ```bash
> aws cloudformation describe-stacks --stack-name algo-prod-stack --query "Stacks[0].Outputs" --output table --region ap-northeast-1
> ```

### 【方法 B: AWS マネジメントコンソールで実行する場合】
1. AWSマネジメントコンソールにログインし、**東京リージョン（ap-northeast-1）** の **CloudFormation** を開きます。
2. **「スタックの作成」>「新しいリソースを使用 (標準)」** をクリック。
3. 「テンプレートの指定」で **「テンプレートファイルのアップロード」** を選び、[`infrastructure/cloudformation/main.yaml`](file:///infrastructure/cloudformation/main.yaml) をアップロードして「次へ」。
4. スタック名に `algo-prod-stack`、`AlertEmail` に通知を受信したいご自身のメールアドレスを入力して「次へ」。
5. そのまま次へ進み、「スタックの作成」を実行。
6. ※ メールアドレスに AWS Notifications から確認メールが届くので、メール内の **「Confirm subscription」** をクリックしてください。

---

## 🔐 Step 2. GitHub Actions OIDC プロバイダの作成（未登録の場合）

すでにAWSアカウント内に `token.actions.githubusercontent.com` のOIDCプロバイダが存在する場合は本ステップはスキップできます。

### 【AWS CLI で実行する場合】
```bash
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" "1c58a3a8518e8759bf075b76b750d4f8d264fcd3"
```

### 【マネジメントコンソールの場合】
- IAMコンソール > **「ID プロバイダ」** > **「プロバイダを追加」**
  - プロバイダのタイプ: **OpenID Connect**
  - プロバイダの URL: `https://token.actions.githubusercontent.com`
  - 対象者: `sts.amazonaws.com`
  - 「サムプリントを取得」をクリックして「プロバイダを追加」。

---

## 🛡️ Step 3. デプロイ用 IAM ロール ＆ 最小権限ポリシーの作成

### 1. 信頼ポリシードキュメントの準備
[`infrastructure/iam/github-oidc-trust-policy.json`](file:///infrastructure/iam/github-oidc-trust-policy.json) の `ACCOUNT_ID_PLACEHOLDER` を、ご自身の12桁のAWSアカウントIDに置き換えます。

### 2. IAM ロールの作成
```bash
aws iam create-role \
  --role-name algo-github-deploy-role \
  --assume-role-policy-document file://infrastructure/iam/github-oidc-trust-policy.json \
  --description "Deployment role for Algo GitHub Actions CI/CD via OIDC"
```

### 3. 最小権限ポリシーの適用
[`infrastructure/iam/deploy-least-privilege-policy.json`](file:///infrastructure/iam/deploy-least-privilege-policy.json) の `ACCOUNT_ID_PLACEHOLDER` をご自身のAWSアカウントIDに置き換え、ポリシーをインライン付与します：

```bash
aws iam put-role-policy \
  --role-name algo-github-deploy-role \
  --policy-name algo-s3-cloudfront-deploy-policy \
  --policy-document file://infrastructure/iam/deploy-least-privilege-policy.json
```

---

## 🔑 Step 4. GitHub Secrets への環境変数登録

GitHubリポジトリ（`dandelion0016/algo`）の **Settings > Secrets and variables > Actions** に進み、**「New repository secret」** から以下の3項目を登録してください：

| Secret名 | 設定する値 | 例 |
| :--- | :--- | :--- |
| `AWS_ACCOUNT_ID` | ご自身の12桁のAWSアカウントID | `123456789012` |
| `S3_BUCKET_NAME` | Step 1 で作成されたS3バケット名 | `algo-prod-apne1-static-hosting-123456789012` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Step 1 で作成されたCloudFrontディストリビューションID | `E1A2B3C4D5E6F7` |

---

## ✅ Step 5. 完了後のご報告

上記 Step 1〜4 が完了しましたら、チャットにて **「作業完了しました」** とお知らせください。
AIエージェントが自動で疎通テスト（AWS接続・静的ビルド・デプロイ疎通）を実施し、環境整備完了（Gate 0-C-2）の確認へ進みます。
