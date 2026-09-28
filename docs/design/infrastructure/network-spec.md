# インフラ ネットワーク ＆ 通信経路設計書

## 1. VPC ＆ サブネット設計方針
- **CIDRブロック**: `10.0.0.0/16` (最大65,536 IP)
- **3層サブネット構造**:
  - **Public Subnet**: インターネット向けALB、NAT Gatewayを配置。
  - **Private App Subnet**: バックエンドコンテナ（ECS）、内部サービスを配置。外部への発信はNAT Gateway経由のみ。
  - **Isolated Data Subnet**: データベース（Aurora）、キャッシュ（ElastiCache）を配置。インターネット通信を完全遮断。

---

## 2. サブネットCIDR割当表

| サブネット論理名 | AZ | CIDRブロック | 収容リソース | ルーティング概要 |
| :--- | :--- | :--- | :--- | :--- |
| `public-1a` | `ap-northeast-1a` | `10.0.1.0/24` | ALB, NAT Gateway (AZ-a) | Internet Gateway (IGW) 宛てデフォルトルート |
| `public-1c` | `ap-northeast-1c` | `10.0.2.0/24` | ALB, NAT Gateway (AZ-c) | Internet Gateway (IGW) 宛てデフォルトルート |
| `private-app-1a` | `ap-northeast-1a` | `10.0.11.0/24`| ECS Fargate (AZ-a) | NAT Gateway (AZ-a) 宛てデフォルトルート |
| `private-app-1c` | `ap-northeast-1c` | `10.0.12.0/24`| ECS Fargate (AZ-c) | NAT Gateway (AZ-c) 宛てデフォルトルート |
| `isolated-data-1a`| `ap-northeast-1a` | `10.0.21.0/24`| Aurora (Primary), Redis | 内部通信のみ (IGW/NATルートなし) |
| `isolated-data-1c`| `ap-northeast-1c` | `10.0.22.0/24`| Aurora (Replica), Redis | 内部通信のみ (IGW/NATルートなし) |

---

## 3. セキュリティグループ通信マトリクス表

| 送信元 (Source SG) | 宛先 (Destination SG) | プロトコル | ポート | 用途・通信理由 |
| :--- | :--- | :---: | :---: | :--- |
| `Internet` (CloudFront) | `sg-alb` | TCP | 443 | ユーザーからのHTTPSリクエスト受付 |
| `sg-alb` | `sg-ecs-app` | TCP | 8080 | ALBからコンテナバックエンドへのリクエスト転送 |
| `sg-ecs-app` | `sg-aurora-db` | TCP | 5432 | アプリケーションからPostgreSQLへのクエリ通信 |
| `sg-ecs-app` | `sg-elasticache` | TCP | 6379 | アプリケーションからRedisへのキャッシュ通信 |
| `sg-ecs-app` | `VPC Endpoints` | TCP | 443 | S3, ECR, Secrets Manager へのAWS内部通信 |
| `sg-aurora-db` | `Any (0.0.0.0/0)` | ALL | ALL | **拒絶 (DBからの外部発信は完全ブロック)** |

---

## 4. VPCエンドポイント（PrivateLink）設計
AWSサービスへの通信をパブリックインターネットに露出させず、AWS内部バックボーンで完結させるため、以下のVPCエンドポイントをPrivate App Subnet向けに配備します：
- `com.amazonaws.ap-northeast-1.s3` (Gateway型)
- `com.amazonaws.ap-northeast-1.ecr.api` (Interface型)
- `com.amazonaws.ap-northeast-1.ecr.dkr` (Interface型)
- `com.amazonaws.ap-northeast-1.secretsmanager` (Interface型)
- `com.amazonaws.ap-northeast-1.logs` (Interface型 / CloudWatch Logs)
