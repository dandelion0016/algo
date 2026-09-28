# バックエンド API詳細仕様書

## 1. API基本方針
- **プロトコル**: HTTPS / RESTful API (JSON)
- **認証方式**: Bearer JWT (`Authorization: Bearer <token>`)
- **ベースURL**: `/api/v1`
- **共通ヘッダー**:
  - `Content-Type: application/json`
  - `X-Request-ID`: クライアントまたはAPI Gatewayで発行されるUUIDv4（分散トレース連携）
  - `X-Tenant-ID`: 呼び出し層でJWTから抽出・インジェクションされたテナント識別子

---

## 2. エンドポイント一覧

| メソッド | パス | 概要 | 認証 | 必要ロール | べき等性 |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `GET` | `/api/v1/health` | ヘルスチェック（DB疎通含む） | 不要 | なし | ○ |
| `POST` | `/api/v1/auth/login` | 認証トークン発行 | 不要 | なし | × |
| `GET` | `/api/v1/resources` | リソース一覧取得（検索・ページ送り） | 要 | `user`, `admin` | ○ |
| `POST` | `/api/v1/resources` | 新規リソース作成 | 要 | `user`, `admin` | × |
| `GET` | `/api/v1/resources/{id}` | リソース個別取得 | 要 | `user`, `admin` | ○ |
| `PUT` | `/api/v1/resources/{id}` | リソース更新 | 要 | `user`, `admin` | ○ |
| `DELETE` | `/api/v1/resources/{id}` | リソース削除（HITL検証対象） | 要 | `admin` | ○ |
| `GET` | `/api/v1/approvals` | 承認待ちキュー一覧取得 | 要 | `approver`, `admin` | ○ |
| `POST` | `/api/v1/approvals/{id}/action` | 承認または却下の実行 | 要 | `approver`, `admin` | × |

---

## 3. 主要エンドポイント詳細仕様例

### 3.1 リソース一覧取得 (`GET /api/v1/resources`)

#### クエリパラメータ
| パラメータ | 型 | 必須 | デフォルト | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `page` | integer | × | `1` | ページ番号（1以上） |
| `limit` | integer | × | `20` | 1ページあたりの取得件数（最大100） |
| `category` | string | × | - | カテゴリ絞り込み (`TECH`, `OPS`, `FIN`) |
| `query` | string | × | - | 名称・説明の前方一致検索キーワード |

#### レスポンス (200 OK)
```json
{
  "items": [
    {
      "id": "res_01H1234567890",
      "tenantId": "tenant_acme",
      "name": "Production DB Config",
      "category": "TECH",
      "scope": "INTERNAL",
      "status": "ACTIVE",
      "createdAt": "2026-09-28T12:00:00Z",
      "updatedAt": "2026-09-28T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

### 3.2 リソース新規作成 (`POST /api/v1/resources`)

#### リクエストボディ
```json
{
  "name": "Production DB Config",
  "category": "TECH",
  "scope": "INTERNAL",
  "description": "Primary PostgreSQL connection parameters"
}
```

#### レスポンス (201 Created)
```json
{
  "id": "res_01H1234567890",
  "name": "Production DB Config",
  "category": "TECH",
  "scope": "INTERNAL",
  "status": "ACTIVE",
  "createdAt": "2026-09-28T12:00:00Z"
}
```
