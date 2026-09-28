# バックエンド 業務シーケンス ＆ トランザクション設計書

## 1. 概要とアーキテクチャ境界
- **目的**: クライアントリクエストからコントローラー、業務ロジック層（Service）、永続化層（Repository/DB）、外部連携までのデータフローとトランザクション境界を可視化する。
- **認可・テナント境界の強制**:
  - コントローラー前の認証ミドルウェアでJWTをデコードし、コンテキストに `TenantContext(tenantId, userId, roles)` を格納。
  - Service/Repository層ではコンテキストから取り出した `tenantId` を必須パラメータとして扱い、プロンプトやクライアント送信パラメータに依存しない。

---

## 2. 標準業務シーケンス：リソース作成と監査記録

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client
    participant MW as Auth & Tenant Middleware
    participant Ctrl as ResourceController
    participant Svc as ResourceService
    participant Repo as ResourceRepository
    participant DB as PostgreSQL (RLS)
    participant Audit as AuditLogger

    Client->>MW: POST /api/v1/resources (Bearer Token, Payload)
    MW->>MW: JWT署名検証 ＆ 有効期限チェック
    alt トークン不正 / 期限切れ
        MW-->>Client: 401 Unauthorized
    else 認証成功
        MW->>MW: TenantContext 生成 (tenantId, userId)
        MW->>Ctrl: リクエスト伝搬 (Context, DTO)
    end

    Ctrl->>Ctrl: 入力バリデーション (Zod/Pydantic)
    alt バリデーションエラー
        Ctrl-->>Client: 400 Bad Request (RFC 7807)
    end

    Ctrl->>Svc: createResource(Context, ValidatedDTO)

    rect rgb(240, 248, 255)
        Note over Svc,DB: トランザクション境界 (DB Transaction Start)
        Svc->>Svc: 業務ルール検査 (同名重複チェック等)
        Svc->>Repo: insert(tenantId, EntityData)
        Repo->>DB: INSERT INTO resources ...
        DB-->>Repo: 登録レコード返却
        Svc->>Audit: recordEvent(ACTION_CREATE, resId, userId)
        Audit->>DB: INSERT INTO audit_logs ...
        Note over Svc,DB: トランザクションコミット (Commit)
    end

    Svc-->>Ctrl: 作成結果 Entity
    Ctrl-->>Client: 201 Created (JSON Response)
```

---

## 3. 例外・外部サービス障害時のフォールバックシーケンス

```mermaid
sequenceDiagram
    autonumber
    participant Svc as ResourceService
    participant ExtClient as ExternalServiceClient
    participant ExtAPI as External SaaS API
    participant Cache as Redis Cache

    Svc->>ExtClient: callExternalSync(params)
    ExtClient->>ExtAPI: HTTPS Request (Timeout: 2000ms)

    alt タイムアウト または 5xxエラー
        ExtAPI-->>ExtClient: 504 Gateway Timeout
        ExtClient->>ExtClient: サーキットブレーカー作動 (Half-Open/Open)
        ExtClient->>Cache: キャッシュ済み直近データを取得
        Cache-->>ExtClient: フォールバックデータ
        ExtClient-->>Svc: 縮退データ返却 (Degraded Response)
    else 正常応答
        ExtAPI-->>ExtClient: 200 OK
        ExtClient-->>Svc: 正常レスポンス
    end
```
