# インフラ クラウドリソース一覧 ＆ IaC設計書

## 1. IaC方式方針
- **採用ツール**: CloudFormation または AWS CDK (TypeScript)
- **ステート管理**: Amazon S3 (State Bucket 暗号化・バージョニング) ＋ DynamoDB (State Locking)
- **モジュール分割方針**:
  - `network`: VPC, Subnet, Route Tables, NAT Gateway
  - `security`: Security Groups, KMS Keys, IAM Roles
  - `data`: Aurora PostgreSQL, ElastiCache Redis, S3 Buckets
  - `compute`: ECS Cluster, Task Definitions, ALB, Auto Scaling
  - `monitoring`: CloudWatch Alarms, Log Groups, Dashboard

---

## 2. ディレクトリ構成規約 (Terraform標準)

```text
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── stg/
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── modules/
    ├── networking/
    ├── compute/
    ├── database/
    └── security/
```

---

## 3. リソース命名規則 (Naming Convention)
リソース名はすべて以下のプレフィックス規約で統一します：
- **フォーマット**: `{project}-{environment}-{region}-{resource_name}`
- **例**:
  - VPC: `agy-prod-apne1-vpc`
  - ECS Service: `agy-prod-apne1-backend-svc`
  - Aurora Cluster: `agy-prod-apne1-aurora-cluster`
  - S3 Bucket: `agy-prod-apne1-audit-logs-<unique-id>`

---

## 4. 共通タグ設計 (Tagging Strategy)
全リソースに対して以下のタグをIaCの `default_tags` で自動強制付与します：

| タグ名 (Key) | 必須 | 設定値の例 | 用途 |
| :--- | :---: | :--- | :--- |
| `Project` | ○ | `antigravity-governance` | プロジェクト識別 |
| `Environment` | ○ | `dev`, `stg`, `prod` | 環境分離・フィルタリング |
| `ManagedBy` | ○ | `terraform` | IaC管理リソース識別 |
| `CostCenter` | ○ | `Engineering-Core` | AWSコスト配分タグ（FinOps） |
| `SecurityTier` | ○ | `Tier-1` (最高機密), `Tier-2` | セキュリティポリシー適用対象 |
