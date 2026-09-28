# データベース 行レベルセキュリティ (RLS) ＆ マルチテナント分離設計書

## 1. マルチテナント分離の設計方針
- **テナント境界の機械的強制**:
  - アプリケーションコード（WHERE句の指定）やプロンプト推論だけに依存せず、**リソース層（データベース）で機械的に他テナントのデータアクセスを遮断**する。
  - PostgreSQLの **Row-Level Security (RLS)** を全マルチテナントテーブルに適用。
  - セッション接続時にセッション変数 `app.current_tenant_id` をセットし、RLSポリシーで自動評価。

---

## 2. RLSポリシーアーキテクチャ

```mermaid
flowchart TD
    Req["API リクエスト (JWT: tenant_id = 'A')"] --> MW["Backend Session Initialization"]
    MW -->|SET LOCAL app.current_tenant_id = 'A'| DBConn["DB Connection"]
    DBConn --> Query["SELECT * FROM resources"]

    subgraph PostgreSQL Engine
        Query --> RLSEngine["RLS Policy Check"]
        RLSEngine --> Condition{"tenant_id = current_setting('app.current_tenant_id')"}
        Condition -->|Yes| MatchedRows["テナントAの行のみ返却"]
        Condition -->|No (テナントB)| HiddenRows["除外 / 遮断 (404/空配列)"]
    end
```

---

## 3. RLSポリシー定義（SQL標準実装例）

```sql
-- 1. テーブルのRLSを有効化
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- 2. テナント分離ポリシー（一般ユーザー向け）
CREATE POLICY tenant_isolation_policy ON resources
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );

-- 3. スーパー管理者・内部監査向けバイパス（明示的ロールのみ）
CREATE POLICY admin_bypass_policy ON resources
    FOR SELECT
    TO system_auditor_role
    USING (true);
```

---

## 4. マイグレーション運用規約
1. **RLS強制チェック**:
   - 新規テーブル追加時は、マイグレーションスクリプト内で必ず `ENABLE ROW LEVEL SECURITY` およびポリシー作成を含めること。CIで未設定テーブルを検出した場合はビルドを失敗させる。
2. **ロールバックの完全性**:
   - すべてのマイグレーションは `up` と `down`（または対応するリバートSQL）をペアで用意し、本番適用前にロールバックテストを完了すること。
3. **無停止マイグレーション方針**:
   - カラム追加時は `NULL` 許容またはデフォルト値を指定し、既存の稼働中バックエンドと互換性を維持する（Expand and Contract パターン）。
