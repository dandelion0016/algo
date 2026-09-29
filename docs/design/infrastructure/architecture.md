# クラウドインフラ全体構成図 ＆ 方式設計書 (Architecture Spec)

本設計書は、「アルゴ（algo）Web対戦システム」におけるAWSインフラアーキテクチャの全体像を定義します。
要件定義書（`specs/requirements.md` 4章）に基づき、**AWS 常時無料枠（Always Free）および 12ヶ月無料枠（12-Month Free Tier）を最大限に活用し、月額利用料 $0 を達成する** サーバーレス・静的アーキテクチャを策定します。

---

## 1. インフラ基本方針 ＆ コスト設計原則

1. **ゼロコスト運用（Always Free 最大活用）**:
   - サーバー（EC2/ECS常駐インスタンス）や常時稼働ロードバランサー（ALB）、NAT Gateway等の課金が発生するマネージドサービスを完全に排除。
   - Next.js 15+ による静的エクスポート（Static Export: HTML/CSS/JS/アセット）を **Amazon S3** に格納し、**Amazon CloudFront** からグローバルエッジ配信する。
2. **高可用性・低レイテンシ（Edge-First）**:
   - CloudFront のエッジキャッシュにより、世界中どこからでも数十ミリ秒以内の高速アクセスを実現。オリジンS3へのアクセスを最小化。
3. **将来拡張性（Modular Serverless）**:
   - Phase 2 のオンラインリアルタイム対戦・アカウント戦績機能を見据え、AWS Lambda、Amazon API Gateway (HTTP/WebSocket API)、Amazon DynamoDB、Amazon Cognito へのシームレスな拡張が可能な境界設計とする。
4. **多層防御とゼロ課金ガード**:
   - CloudFront Origin Access Control (OAC) によるS3直アクセスの完全遮断。
   - AWS Budgets による「$0.01（1セント）課金アラート」および CloudFront レート制限によるDDoS・課金暴走抑止。

---

## 2. クラウドインフラ全体構成図 (AWS Architecture)

### 2.1 全体システム構成図（現在フェーズ ＆ 将来拡張フェーズ）

```mermaid
flowchart TD
    User["ユーザー / プレイヤーブラウザ<br>(PC / タブレット / スマホ)"] -->|HTTPS (Port 443)| CFDomain{"アクセス経路"}

    CFDomain -->|【初期】完全$0運用| CloudFront["Amazon CloudFront (CDN エッジ)<br>・初期URL: https://dxxxxxxxxxxxx.cloudfront.net<br>・CloudFrontデフォルトSSL/TLS証明書 (完全無料)<br>・常時無料 1TB/月, 1000万リクエスト<br>・HTTPS強制 / TLS 1.3"]
    CFDomain -.->|【将来拡張】カスタムドメイン| Route53["Amazon Route 53<br>(カスタムドメイン管理)"]
    Route53 -.-> ACM["AWS Certificate Manager (ACM)<br>(パブリックSSL/TLS証明書)"]
    Route53 -.-> CloudFront

    subgraph Phase1_Current["【Phase 1: 現在】静的ホスティング基盤 (完全月額 $0)"]
        CloudFront -->|OAC (Origin Access Control)<br>SigV4署名付き限定アクセス| S3Static["Amazon S3: 静的ホスティングバケット<br>・Next.js 15+ SSG成果物 (HTML/JS/CSS)<br>・パブリックアクセス完全ブロック<br>・バケットバージョニング & 暗号化 (SSE-S3)"]
    end

    subgraph Phase2_Future["【Phase 2: 将来拡張】サーバーレス対戦・認証・独自ドメイン"]
        CloudFront -.->|Path: /api/*<br>(HTTP API)| APIGW["Amazon API Gateway (HTTP API)<br>・低レイテンシ / 100万リクエスト無料"]
        CloudFront -.->|Path: /ws/*<br>(WebSocket)| WSSGW["Amazon API Gateway (WebSocket API)<br>・双方向リアルタイム対戦同期"]

        APIGW -.-> LambdaREST["AWS Lambda: REST Handler<br>・常時無料 100万回/月, 40万GB-秒<br>・ルーム管理 / 戦績集計"]
        WSSGW -.-> LambdaWS["AWS Lambda: WebSocket Handler<br>・接続管理 / 対戦メッセージ中継"]

        LambdaREST -.-> DynamoDB[("Amazon DynamoDB<br>・常時無料 25GB, 25 WCU/RCU<br>・Rooms, MatchHistories, Users")]
        LambdaWS -.-> DynamoDB

        User -.->|サインアップ / ログイン| Cognito["Amazon Cognito User Pool<br>・常時無料 50,000 MAU<br>・JWT認証 / 任意ユーザーID登録"]
        Cognito -.-> APIGW
    end

    subgraph Management_FinOps["SRE / ガバナンス / FinOps"]
        Budgets["AWS Budgets<br>・$0.01 予想・実績課金アラート<br>・メール / SNS即時発報"]
        CWAlarms["CloudWatch Alarms<br>・CloudFront 5xxエラー率<br>・Originレイテンシ監視"]
        OIDC["GitHub Actions CI/CD<br>・AWS IAM OIDC認証 (キーレス)<br>・S3同期 & CloudFront Invalidation"]
    end

    OIDC -.->|デプロイ (AssumeRole)| S3Static
    OIDC -.->|キャッシュ破棄| CloudFront
    Budgets -.->|通知| Admin[("運用管理者 / 開発者")]
    CWAlarms -.->|通知| Admin
```

---

## 3. 主要コンポーネント選定 ＆ 無料枠適用マトリクス

| コンポーネント | 採用AWSサービス | 役割・機能 | 無料枠の種別 ＆ 上限 | コスト超過対策 |
| :--- | :--- | :--- | :--- | :--- |
| **CDN / 配信** | **Amazon CloudFront** | グローバルエッジ配信、HTTPS終端、高速キャッシュ、OAC認証ヘッダー付与 | **常時無料 (Always Free)**<br>・データ転送量: 1TB / 月<br>・HTTP/HTTPSリクエスト: 1,000万回 / 月 | キャッシュヒット率95%以上維持、不必要なキャッシュ無効化（Invalidation）の制限（月1,000パスまで無料） |
| **静的ストレージ** | **Amazon S3** | Next.js静的エクスポート成果物（HTML/CSS/JS/画像）の非公開保管 | **12ヶ月無料 (Free Tier)**<br>・ストレージ: 5GB<br>・GETリクエスト: 20,000回 / 月<br>・PUTリクエスト: 2,000回 / 月 | CloudFrontキャッシュによるS3リクエスト激減、アセットの最小化・Gzip/Brotli圧縮、ライフサイクルルールによる旧世代削除 |
| **SSL/TLS証明書** | **AWS Certificate Manager (ACM)** | カスタムドメイン（`algo.example.com`等）用SSL/TLS証明書の自動発行・更新 | **完全無料**（CloudFront関連付け時） | なし（追加コストなし） |
| **DNS** | **Amazon Route 53** | ドメイン名前解決、CloudFrontエイリアスルーティング | ホストゾーン: $0.50/月<br>（独自ドメイン利用時のみ。CloudFront既定ドメイン `*.cloudfront.net` 利用時は $0） | 独自ドメイン不要時は標準CloudFrontドメインを活用し完全 $0 運用 |
| **API基盤**<br>(Phase 2) | **Amazon API Gateway** (HTTP API) | ルーム作成・対戦履歴用RESTエンドポイント | **12ヶ月無料**: 100万回 / 月<br>（超過後も $1.00 / 100万回と極めて低価格） | 取得データのフロントエンドキャッシュ、不要なポーリング排除 |
| **WebSocket**<br>(Phase 2) | **Amazon API Gateway** (WebSocket API) | リアルタイム双方向メッセージ通信（手番同期、カード開示） | **12ヶ月無料**: 100万回 / 月、接続時間 75万接続-分 / 月 | 手番完了時のみのメッセージ送受信、アイドル接続の自動切断（タイムアウト設定） |
| **サーバーレス計算**<br>(Phase 2) | **AWS Lambda** | ゲーム状態管理、勝敗判定、対戦戦績登録 | **常時無料 (Always Free)**<br>・リクエスト数: 100万回 / 月<br>・コンピュート時間: 400,000 GB-秒 / 月 | メモリ最適化（128MB〜256MB）、コールドスタート削減、Node.js 20+ 軽量ランタイム |
| **データベース**<br>(Phase 2) | **Amazon DynamoDB** | ルーム状態、対戦履歴、ユーザープロファイル永続化 | **常時無料 (Always Free)**<br>・ストレージ容量: 25GB<br>・スループット: 25 WCU / 25 RCU（毎月約2億リクエスト分） | オンデマンドキャパシティまたは無料枠内プロビジョンド（25 WCU/RCU固定）、TTLによる期限切れルーム自動削除 |
| **認証基盤**<br>(Phase 2) | **Amazon Cognito** | ユーザー登録、ソーシャルログイン、ゲスト用匿名認証 | **常時無料 (Always Free)**<br>・月間アクティブユーザー (MAU): 50,000人 / 月 | トークン有効期限の適正化（Access: 60分、Refresh: 30日） |
| **CI/CD** | **GitHub Actions + AWS OIDC** | 自動テスト、Next.js静的ビルド、S3同期、キャッシュ破棄 | **完全無料**（パブリックリポジトリ無制限 / プライベート2,000分/月無料） | OIDC（OpenID Connect）によるキーレス認証、ビルドキャッシュ活用 |

---

## 4. ゼロ課金ガード設計 (Zero-Cost Governance)

小規模・個人開発運用において予期せぬクラウド破産や課金を防ぐため、以下のガードレールを機械的に強制します：

1. **AWS Budgets 超過アラート ($0.01 Threshold)**:
   - 月額利用料金が **$0.01**（1セント）に達した（または当月末予測で超える）瞬間に、管理者メールおよびSlackへ緊急警報を発報。
   - 無料枠の適用漏れや設定ミスを即日検知する。
2. **CloudFront 自動リクエストレート制限**:
   - 悪意あるスクレイピングや短時間大量アクセスによるデータ転送量爆発を抑止するため、クライアントIPごとのアクセスレートを監視。
3. **S3 ライフサイクルルール**:
   - デプロイ時の旧バージョンファイルや削除マーカーが残り続けて5GB無料枠を圧迫しないよう、直近2世代を残して30日経過後に自動削除。
4. **DynamoDB TTL (Time-To-Live)** (Phase 2):
   - オンライン対戦終了後の部屋データ（Session State）には `ttl` 属性を付与し、24時間後にAWSバックグラウンド処理（無料）で自動パージ。25GBの無料ストレージ枠を恒久的に節約。
