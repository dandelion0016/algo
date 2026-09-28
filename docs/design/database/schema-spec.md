# データベース テーブル定義書

## 1. テーブル一覧

| 物理テーブル名 | 論理テーブル名 | 概要 | RLS適用 |
| :--- | :--- | :--- | :---: |
| `tenants` | テナントマスタ | 契約テナント・組織の基本情報 | × (システム管理者管理) |
| `users` | ユーザーマスタ | ユーザーアカウント情報、ロール | ○ |
| `resources` | リソース管理テーブル | アプリケーションが管理する主要リソース | ○ |
| `approval_requests`| 承認リクエストテーブル | HITL承認対象の保留中アクションキュー | ○ |
| `audit_logs` | 監査ログテーブル | セキュリティ監査・操作履歴追跡 | ○ (INSERT/SELECTのみ) |

---

## 2. 詳細テーブル定義例：`resources` (リソース管理テーブル)

### 2.1 カラム定義

| 列名 (物理名) | カラム論理名 | データ型 | NULL | PK/FK | デフォルト値 | 制約・説明 |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | リソースID | `UUID` | NOT NULL | PK | `gen_random_uuid()` | 主キー |
| `tenant_id` | テナントID | `UUID` | NOT NULL | FK | なし | `tenants.id` を参照。RLSの境界キー |
| `created_by` | 作成者ユーザーID | `UUID` | NOT NULL | FK | なし | `users.id` を参照 |
| `name` | リソース名 | `VARCHAR(100)` | NOT NULL | - | なし | リソースの表示名 |
| `category` | カテゴリ | `VARCHAR(50)` | NOT NULL | - | なし | `TECH`, `OPS`, `FIN` など |
| `scope` | 公開範囲 | `VARCHAR(20)` | NOT NULL | - | `'INTERNAL'` | `'INTERNAL'` または `'PUBLIC'` |
| `status` | ステータス | `VARCHAR(30)` | NOT NULL | - | `'ACTIVE'` | `'ACTIVE'`, `'INACTIVE'`, `'ARCHIVED'` |
| `payload` | 拡張メタデータ | `JSONB` | NULL | - | `'{}'::jsonb` | 任意の付加設定情報 |
| `created_at` | 作成日時 | `TIMESTAMPTZ` | NOT NULL | - | `CURRENT_TIMESTAMP` | 作成時刻 |
| `updated_at` | 更新日時 | `TIMESTAMPTZ` | NOT NULL | - | `CURRENT_TIMESTAMP` | 最終更新時刻 |
| `deleted_at` | 削除日時 | `TIMESTAMPTZ` | NULL | - | NULL | 論理削除日時 |

### 2.2 インデックス定義

| インデックス名 | 対象列 | 種別 | 想定クエリ ＆ 選定理由 |
| :--- | :--- | :---: | :--- |
| `idx_resources_tenant_status` | `(tenant_id, status)` | B-Tree | テナント内リソース一覧取得時の最頻出クエリ（WHERE tenant_id = ? AND status = ?）を高速化 |
| `idx_resources_tenant_created_at` | `(tenant_id, created_at DESC)` | B-Tree | ダッシュボード等での新着順ソート・ページネーション高速化 |
| `idx_resources_payload_gin` | `payload` | GIN | JSONB内の特定キー検索（`payload @> '{"env": "prod"}'`）に対応 |
