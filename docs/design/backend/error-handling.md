# バックエンド バリデーション ＆ エラーハンドリング規約

## 1. エラーレスポンス基本規約 (RFC 7807)
バックエンドAPIが返却するエラーレスポンスは、すべて **RFC 7807 (Problem Details for HTTP APIs)** に準拠したJSONフォーマットで統一します。

### 標準エラースキーマ
```json
{
  "type": "https://api.example.com/errors/RESOURCE_VALIDATION_FAILED",
  "title": "入力バリデーションエラー",
  "status": 400,
  "detail": "リクエストボディの1件以上の項目が制約を満たしていません。",
  "instance": "/api/v1/resources",
  "code": "VAL_001",
  "invalidParams": [
    {
      "name": "name",
      "reason": "1文字以上100文字以内で指定してください。"
    }
  ],
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

---

## 2. HTTPステータスコード ＆ アプリケーションエラーコード表

| HTTP Status | エラーコード | エラー分類 | 主な発生条件 |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VAL_001` | スキーマ違反 | 必須パラメータ欠落、型不一致、文字数超過 |
| `400 Bad Request` | `TOOL_ARG_INVALID` | ツール引数検証失敗 | LLMの生成したJSONがZod/Pydanticスキーマを満たさない |
| `401 Unauthorized` | `AUTH_TOKEN_EXPIRED` | 認証エラー | JWTの有効期限切れ |
| `401 Unauthorized` | `AUTH_TOKEN_INVALID` | 認証エラー | JWTの署名不正、フォーマット不正 |
| `403 Forbidden` | `AUTH_FORBIDDEN` | 認可エラー | ユーザーロールの権限スコープ不足 |
| `403 Forbidden` | `TENANT_CROSS_VIOLATION` | テナント境界違反 | 他テナントのリソースに対するアクセス要求 |
| `404 Not Found` | `RES_NOT_FOUND` | リソース不在 | 指定IDのリソースが存在しない（他テナント含む） |
| `409 Conflict` | `RES_ALREADY_EXISTS` | 整合性競合 | ユニーク制約違反、楽観的ロック不一致 |
| `422 Unprocessable` | `BIZ_RULE_VIOLATED` | 業務ルール違反 | 状態遷移不可（例: 既に完了したタスクの編集） |
| `429 Too Many Req` | `RATE_LIMIT_EXCEEDED` | レート制限 | クライアント毎の規定リクエスト数超過 |
| `500 Internal Error` | `SYS_INTERNAL_ERROR` | 内部システムエラー | 捕捉されなかったサーバー例外、DB接続障害 |

---

## 3. ツール層引数バリデーション（多層防御規約）
AIエージェントが呼び出すMCPツールや内部APIツールに対しては、以下の厳格な検証を義務付けます：

1. **スキーマライブラリによる機械的強制**:
   - Pydantic（Python）または Zod（TypeScript）を用いて厳格なバリデーション定義を行う。
   - `extra="forbid"`（未知のプロパティの自動拒絶）を適用する。
2. **サニタイズ・危険文字除去**:
   - SQL文やOSコマンドのインジェクションを誘発する特殊文字（`;`, `|`, `&`, `../` 等）をツール層でブロックする。
3. **安全なエラーメッセージ**:
   - クライアントへのレスポンスには、スタックトレースやSQL文などの内部構造を含めない（内部ログにのみ記録）。
