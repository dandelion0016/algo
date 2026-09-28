# セキュリティ 監査ログ ＆ トレーサビリティ設計書 (Audit Logging Spec)

本設計書は、「アルゴ（algo）Web対戦システム」における対戦監査ログ、システムログ、およびトレーサビリティの設計を定義します。
ゲームの公平性の検証（チート・不具合調査）とセキュリティインシデント追跡を可能にしつつ、**AWS CloudWatch Logs の無料枠（5GBデータ取り込み/月）を圧迫しない効率的なロギングと機密情報マスキング**を定めます。

---

## 1. 監査ログ基本方針

1. **ゲーム公平性の証明（Auditability）**:
   - すべてのアタック、的中/ハズレ判定、ドロー、カード開示、ターン遷移をタイムスタンプ付きの構造化JSONで記録。
   - 勝敗に関する疑義や不具合発生時に、最初の手札配分から完全再現（リプレイ）可能な状態を保持。
2. **プライバシー保護 ＆ PIIマスキング**:
   - メールアドレス、認証JWT、セッショントークンはログ出力前に完全にマスキング。
   - クライアントIPアドレスは末尾オクテットをハッシュ化またはゼロ埋め（`192.168.1.***`）して記録。
3. **無料枠を意識したログ保持ポリシー**:
   - CloudWatch Logs のログ保持期間（Retention Period）を **30日** に設定し、古いログが蓄積して無料枠（5GB）を超過することを防止。

---

## 2. 監査対象イベントマトリクス

| イベント種別 (`eventType`) | 重要度 | 記録タイミング | 主な記録項目 |
| :--- | :---: | :--- | :--- |
| `MATCH_INIT` | INFO | 対戦開始時（山札シャッフル・手札配布） | `matchId`, `playerCount`, `initialHandSizes`, `starterId` |
| `TURN_DRAW` | INFO | 山札からカードを引いた時 | `matchId`, `turnNumber`, `playerId`, `drawCardColor` (数字は秘匿) |
| `TURN_ATTACK` | INFO | プレイヤーが相手カードを推理した時 | `matchId`, `turnNumber`, `attackerId`, `targetPlayerId`, `targetCardIndex`, `declaredNumber`, `isHit` |
| `TURN_STAY` | INFO | 的中後、ステイを選択して手番終了した時 | `matchId`, `turnNumber`, `playerId` |
| `MATCH_FINISH` | INFO | 勝敗決定（全滅または単独生存） | `matchId`, `winnerId`, `durationSec`, `totalTurns`, `finalHands` |
| `SECURITY_RULE_VIOLATION` | WARN | 不正なパラメータ、手番外操作検知 | `matchId`, `playerId`, `violationType`, `requestPayload` |
| `AUTH_LINK_GUEST` | INFO | ゲストからCognitoアカウントへの昇格 | `userId`, `guestIdHash`, `timestamp` |

---

## 3. 構造化対戦ログスキーマ (JSON)

### 3.1 アタック判定イベント例 (`TURN_ATTACK`)
```json
{
  "timestamp": "2026-09-28T12:34:56.789Z",
  "logLevel": "INFO",
  "eventType": "TURN_ATTACK",
  "matchId": "match_9f8e7d6c5b4a",
  "turnNumber": 4,
  "attacker": {
    "playerId": "usr_alpha123",
    "role": "player"
  },
  "action": {
    "targetPlayerId": "cpu_bot_hard",
    "targetCardIndex": 2,
    "declaredNumber": 7,
    "result": "HIT",
    "revealedCard": {
      "color": "black",
      "number": 7
    },
    "isTargetEliminated": false
  },
  "metadata": {
    "timeRemainingMs": 18450,
    "clientVersion": "1.0.0"
  }
}
```

### 3.2 不正ルール違反イベント例 (`SECURITY_RULE_VIOLATION`)
```json
{
  "timestamp": "2026-09-28T12:35:10.123Z",
  "logLevel": "WARN",
  "eventType": "SECURITY_RULE_VIOLATION",
  "matchId": "match_9f8e7d6c5b4a",
  "playerId": "guest_attacker99",
  "clientIp": "203.0.113.***",
  "violationType": "INVALID_NUMBER_RANGE",
  "details": {
    "attemptedValue": 15,
    "expectedRange": "0 <= n <= 11",
    "action": "ATTACK_REJECTED"
  }
}
```

---

## 4. 機密情報マスキング規約

ログ出力ライブラリ（Winston / Pino 等）のカスタムフォーマッターにより、以下のパターンを機械的に置換します：

```typescript
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = ['password', 'authorization', 'token', 'idToken', 'refreshToken', 'email'];
  const cloned = { ...data };

  for (const [key, value] of Object.entries(cloned)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      cloned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cloned[key] = sanitizeLogData(value as Record<string, unknown>);
    }
  }

  // IPアドレスの部分匿名化
  if (typeof cloned.ipAddress === 'string') {
    cloned.ipAddress = cloned.ipAddress.replace(/\.\d+$/, '.***');
  }

  return cloned;
}
```
