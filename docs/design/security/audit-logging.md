# セキュリティ 監査ログ ＆ トレーサビリティ設計書

## 1. 監査ログ基本方針
- **目的**: AIエージェントおよびユーザーによる重要操作を事後検証・説明可能（Accountability）にするため、改ざん不可能な形で永続化する。
- **記録原則**:
  - 全ログは **JSON構造化フォーマット** で記録。
  - 機密情報（パスワード、Bearerトークン、クレジットカード番号、個人特定情報）は **記録前に必ずマスキング**。
  - トレースID（W3C Trace Context準拠）を全レイヤーで伝搬し、1つのリクエストを起点とする全ログ・スパンを横断追跡可能にする。

---

## 2. 監査対象イベント一覧

| イベント種別 (`eventType`) | 重要度 | トリガー条件 | 必須記録項目 |
| :--- | :---: | :--- | :--- |
| `AUTH_LOGIN_SUCCESS` | INFO | 認証トークン発行成功 | `userId`, `tenantId`, `ipAddress` |
| `AUTH_LOGIN_FAILURE` | WARN | パスワード誤り、不正トークン | 入力識別子（ハッシュ化）, `ipAddress`, `reason` |
| `TOOL_INVOCATION` | INFO | AIエージェントによるツール実行 | `toolName`, `arguments`（マスキング済）, `executionTimeMs` |
| `HITL_APPROVAL_REQUEST`| INFO | 破壊的操作の承認待ち起票 | `actionType`, `targetResourceId`, `requestedBy` |
| `HITL_APPROVAL_RESOLVED`| WARN | HITLの承認または却下の実行 | `ticketId`, `resolvedBy`, `decision` (APPROVED/REJECTED) |
| `SECURITY_POLICY_BLOCKED`| ALERT| テナント越境試行、Guardrails遮断 | `blockedReason`, `ruleId`, `requestDetails` |
| `DATA_DELETION` | WARN | リソースの物理/論理削除 | `resourceId`, `targetType`, `userId` |

---

## 3. 構造化監査ログスキーマ

```json
{
  "timestamp": "2026-09-28T12:00:00.123Z",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "eventType": "TOOL_INVOCATION",
  "severity": "INFO",
  "principal": {
    "userId": "usr_01H1234567890",
    "tenantId": "tenant_acme",
    "roles": ["user"],
    "isAgent": true,
    "agentName": "backend-agent"
  },
  "action": {
    "service": "resource-service",
    "operation": "create_resource",
    "resourceId": "res_9876543210"
  },
  "client": {
    "ipAddress": "192.0.2.1",
    "userAgent": "Mozilla/5.0..."
  },
  "execution": {
    "status": "SUCCESS",
    "durationMs": 42
  }
}
```

---

## 4. マスキング規則 ＆ 改ざん防止
1. **マスキング正規表現フィルタ**:
   - `Authorization: Bearer .*` ➔ `Authorization: Bearer [REDACTED]`
   - `password`, `secret`, `apiKey`, `token` キーの値 ➔ `[REDACTED]`
   - メールアドレス ➔ `u***@example.com`
2. **改ざん防止（WORMストレージ）**:
   - 監査ログは Amazon S3 Glacier または CloudWatch Logs の Object Lock（WORM: Write Once, Read Many）を有効化し、管理者であっても一定期間削除・変更できない設定とする。
