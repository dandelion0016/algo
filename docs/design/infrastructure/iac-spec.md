# インフラ クラウドリソース一覧 ＆ IaC設計書 (IaC Spec)

本設計書は、「アルゴ（algo）Web対戦システム」におけるインフラ構成のコード化（Infrastructure as Code: IaC）方針、リソース設計、命名規約、およびタグ戦略を定義します。
手動コンソール操作による設定ミスやセキュリティホールを排除し、完全再現可能なインフラ基盤を提供します。

---

## 1. IaC ツール選定 ＆ ディレクトリ構成

### 1.1 ツール選定方針
- **主選定ツール**: **AWS CloudFormation** または **Terraform (OpenTofu)**
- **選定理由**:
  - S3 + CloudFront + ACM + Route53 + AWS Budgets の構成は軽量であり、AWSネイティブな CloudFormation (YAML) で完全に記述可能。追加の外部ツール依存を極小化。
  - 大規模化・マルチクラウド拡張時は Terraform への移行も容易な疎結合モジュール設計とする。

### 1.2 リポジトリ内IaCディレクトリ構成
```text
infrastructure/
├── cloudformation/                     # CloudFormation テンプレート
│   ├── root.yaml                       # メインスタック（ネストまたはパラメータ参照）
│   ├── modules/
│   │   ├── static-hosting.yaml         # S3, CloudFront, OAC, ResponseHeadersPolicy
│   │   ├── dns-acm.yaml                # Route 53, ACM Certificate
│   │   ├── zero-cost-guard.yaml        # AWS Budgets ($0.01アラート), CloudWatch Alarms
│   │   └── future-serverless.yaml      # (Phase 2) DynamoDB, Lambda, API Gateway, Cognito
│   └── parameters/
│       ├── dev.json                    # 開発環境パラメータ
│       └── prod.json                   # 本番環境パラメータ
└── terraform/                          # Terraform用（選択的利用）
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    └── terraform.tfvars
```

---

## 2. 管理リソース一覧 ＆ 定義詳細

### 2.1 静的ホスティング ＆ 配信レイヤー (`static-hosting.yaml`)
| 論理ID | AWSリソースタイプ | リソース名（本番例） | 設計概要 |
| :--- | :--- | :--- | :--- |
| `HostingBucket` | `AWS::S3::Bucket` | `algo-prod-apne1-static-hosting-<hash>` | パブリックアクセス完全ブロック、SSE-S3暗号化、バージョニング有効、ライフサイクルルール（旧版30日削除） |
| `HostingBucketPolicy` | `AWS::S3::BucketPolicy` | - | CloudFront OACからの `s3:GetObject` のみ許可 |
| `CloudFrontOAC` | `AWS::CloudFront::OriginAccessControl` | `algo-prod-oac` | S3オリジン向けSigV4署名制御（OriginAccessControlConfig） |
| `CloudFrontDistribution` | `AWS::CloudFront::Distribution` | - | 初期は標準ドメイン利用（`ViewerCertificate: { CloudFrontDefaultCertificate: true }`）、OAC連携、HTTPS強制、HTTP/2+HTTP/3、Brotli圧縮、SPA/Next.js用403/404エラーページ（`/index.html` または `/404.html` へ転送）。将来拡張時にRoute53/ACM用 `Aliases` を追加可能。 |
| `ResponseHeadersPolicy` | `AWS::CloudFront::ResponseHeadersPolicy` | `algo-prod-security-headers` | HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP |

### 2.2 ゼロ課金ガードレイヤー (`zero-cost-guard.yaml`)
| 論理ID | AWSリソースタイプ | リソース名（本番例） | 設計概要 |
| :--- | :--- | :--- | :--- |
| `ZeroCostBudget` | `AWS::Budgets::Budget` | `algo-prod-zero-cost-guard` | 月額予想・実績 **$0.01** 超過検知時にSNS/メールへ即時アラート送信 |
| `CloudFront5xxAlarm` | `AWS::CloudWatch::Alarm` | `algo-prod-cf-5xx-error-alarm` | 5xxエラー率 > 1%（5分間）で発報 |
| `BudgetNotificationTopic` | `AWS::SNS::Topic` | `algo-prod-finops-alerts` | 管理者向け緊急通知SNSトピック |

### 2.3 将来拡張サーバーレスレイヤー (Phase 2: `future-serverless.yaml`)
| 論理ID | AWSリソースタイプ | リソース名（本番例） | 設計概要 |
| :--- | :--- | :--- | :--- |
| `RoomsTable` | `AWS::DynamoDB::Table` | `algo-prod-rooms` | PK: `roomId` (String), TTL有効 (`ttl`), 従量課金 (PAY_PER_REQUEST) |
| `MatchHistoriesTable` | `AWS::DynamoDB::Table` | `algo-prod-match-histories` | PK: `userId`, SK: `matchedAt`, PAY_PER_REQUEST |
| `GameHttpApi` | `AWS::ApiGatewayV2::Api` | `algo-prod-http-api` | HTTP API (低レイテンシ, 100万回無料), CORS設定 |
| `GameWebSocketApi` | `AWS::ApiGatewayV2::Api` | `algo-prod-ws-api` | WebSocket API ($connect, $disconnect, action ルーティング) |
| `GameLogicFunction` | `AWS::Lambda::Function` | `algo-prod-game-handler` | Node.js 20.x, メモリ 128MB, タイムアウト 10秒, 最小権限ロール |
| `UserPool` | `AWS::Cognito::UserPool` | `algo-prod-user-pool` | メール認証、パスワードポリシー、ゲストログイン許可 |

---

## 3. リソース命名規則 (Naming Convention)

リソース名はすべて以下のプレフィックス規約で統一し、環境・用途の混同を防止します：

- **基本構文**: `{Project}-{Environment}-{Region}-{ResourceName}`
  - `{Project}`: `algo`
  - `{Environment}`: `prod`, `stg`, `dev`
  - `{Region}`: `apne1` (Tokyo: ap-northeast-1), `use1` (CloudFront/ACM用: us-east-1)
  - `{ResourceName}`: `static-hosting`, `game-handler`, `rooms-table`
- **命名例**:
  - S3バケット: `algo-prod-apne1-static-hosting-9a8b7c`
  - CloudFront OAC: `algo-prod-apne1-oac`
  - Budgetsアラート: `algo-prod-zero-cost-budget`
  - DynamoDBテーブル: `algo-prod-apne1-rooms`

---

## 4. 共通タグ設計 (Tagging Strategy)

CloudFormation / Terraform の共通タグ機能を活用し、全リソースに以下のタグを強制付与します：

| タグ名 (Key) | 必須 | 設定値の例 | 付与目的 |
| :--- | :---: | :--- | :--- |
| `Project` | ○ | `algo-game` | プロジェクトリソースの横断集計 |
| `Environment` | ○ | `prod`, `dev` | 環境分離、ステージごとのフィルタリング |
| `ManagedBy` | ○ | `cloudformation` (または `terraform`) | IaC管理リソース識別（手動変更抑止） |
| `CostCenter` | ○ | `free-tier-experiment` | コスト配分タグ（AWS Budgets / Cost Explorer） |
| `Owner` | ○ | `algo-lead` | リソース責任者識別 |
| `SecurityTier` | ○ | `Tier-Public-CDN` / `Tier-Internal` | セキュリティ監査分類 |

### 4.1 CloudFormationスタック適用例
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Algo Web Battle System - Static Hosting & Zero Cost Guard'

Parameters:
  ProjectName:
    Type: String
    Default: 'algo'
  Environment:
    Type: String
    Default: 'prod'

Resources:
  # リソース定義は共通タグを含む
  HostingBucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      BucketName: !Sub '${ProjectName}-${Environment}-apne1-static-hosting-${AWS::AccountId}'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        IgnorePublicAcls: true
        BlockPublicPolicy: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: CleanOldVersions
            Status: Enabled
            NoncurrentVersionExpiration:
              NoncurrentDays: 30
      Tags:
        - Key: Project
          Value: !Ref ProjectName
        - Key: Environment
          Value: !Ref Environment
        - Key: ManagedBy
          Value: 'cloudformation'
        - Key: CostCenter
          Value: 'free-tier-algo'
```
