# セキュリティ 監査ログ ＆ トレーサビリティ設計書 (Audit Logging Spec)

本設計書は、「アルゴ（algo）Web対戦システム」における対戦監査ログ、システムログ、およびトレーサビリティの設計を定義します。
ゲームの公平性の検証（チート・不具合調査）とセキュリティインシデント追跡を可能にしつつ、**AWS CloudWatch Logs の無料枠（5GBデータ取り込み/月）を圧迫しない効率的なロギングと機密情報マスキング**を定めます。

---

## 1. 監査ログ基本方針

1. **ゲーム公平性の証明（Auditability）**:
   - すべてのアタック、的中/ハズレ判定、ドロー、カード開示、ターン遷移をタイムスタンプ付きの構造化JSON（`AuditEvent`）で記録。
   - 勝敗に関する疑義や不具合発生時に、最初の手札配分から完全再現（リプレイ）可能な状態を保持。
2. **プライバシー保護 ＆ 機密情報マスキング**:
   - メールアドレス、認証JWT、セッショントークンはログ出力前に完全にマスキング（`[REDACTED]`）。
   - クライアントIPアドレスは末尾オクテットを匿名化（`192.168.1.***`）して記録。
   - アタック失敗時、対象カードの真の数字は漏洩防止のためペイロードに含めない（Issue #84）。
3. **無料枠を意識したログ保持ポリシー**:
   - CloudWatch Logs のログ保持期間（Retention Period）を **30日** に設定し、古いログが蓄積して無料枠（5GB）を超過することを防止。

---

## 2. 監査対象イベントマトリクス (`src/types/audit.ts`)

| イベント種別 (`AuditEventType`) | 重要度 | 記録タイミング | 主な記録項目（`payload`） |
| :--- | :---: | :--- | :--- |
| `GAME_INIT` | INFO | ゲーム初期化・対戦開始時 | `playerCount`, `difficulty`, `timeLimit`, `initialHandSizes`, `starterId` |
| `TURN_START` | INFO | 各ターンの手番開始時 | `turnNumber`, `activePlayerIndex`, `activePlayerId`, `timeLimit` |
| `DRAW_CARD` | INFO | 山札からカードを引いた時 | `playerId`, `drawCardId`, `color` (※相手カード数字は秘匿) |
| `ATTACK_ATTEMPT` | INFO | プレイヤー/CPUが相手カードを推理した時 | `attackerId`, `targetPlayerId`, `targetCardIndex`, `targetColor`, `guessedNumber` |
| `ATTACK_RESULT` | INFO | 推理判定結果確定時 | `attackerId`, `targetPlayerId`, `targetCardIndex`, `guessedNumber`, `isHit`, `actualNumber` (的中時のみ) |
| `TURN_PASS` | INFO | 的中後、ステイを選択して手番終了した時 | `playerId`, `stayedCardId`, `nextPlayerId` |
| `TIMEOUT_PENALTY` | WARN | 持ち時間切れで強制ペナルティ発生時 | `playerId`, `remainingTime`, `penalizedCardId`, `forcedAction` |
| `GAME_OVER` | INFO | 決着・サバイバル勝者確定時 | `winnerId`, `winnerName`, `playerCount`, `totalTurns`, `durationMs` |
| `SECURITY_VIOLATION` | WARN / ERROR | 手番外操作、不正数字入力、自手札アタック等 | `violationType`, `userId`, `action`, `invalidParams`, `clientIp` |
| `CLIENT_CRASH` | ERROR | ErrorBoundary による捕捉例外検知時 | `errorName`, `errorMessage`, `componentStack`, `url` |

---

## 3. 構造化対戦ログスキーマ (JSON)

### 3.1 監査イベントデータ型定義 (`src/types/audit.ts`)

```typescript
export type AuditEventType =
  | 'GAME_INIT'
  | 'TURN_START'
  | 'DRAW_CARD'
  | 'ATTACK_ATTEMPT'
  | 'ATTACK_RESULT'
  | 'TURN_PASS'
  | 'TIMEOUT_PENALTY'
  | 'GAME_OVER'
  | 'SECURITY_VIOLATION'
  | 'CLIENT_CRASH';

export interface AuditEvent {
  eventId: string;
  timestamp: number;
  eventType: AuditEventType;
  userId: string;
  payload: Record<string, unknown>;
  isMasked: boolean;
}
```

### 3.2 アタック結果判定イベント例 (`ATTACK_RESULT`)
```json
{
  "eventId": "evt_9f8e7d6c5b4a_0012",
  "timestamp": 1759560896789,
  "eventType": "ATTACK_RESULT",
  "userId": "usr_alpha123",
  "payload": {
    "attackerId": "usr_alpha123",
    "attackerName": "あなた",
    "targetPlayerId": "cpu-1",
    "targetPlayerName": "CPU アル",
    "targetCardIndex": 2,
    "targetColor": "black",
    "guessedNumber": 7,
    "isHit": true,
    "actualNumber": 7,
    "isTargetEliminated": false
  },
  "isMasked": true
}
```

### 3.3 セキュリティ違反イベント例 (`SECURITY_VIOLATION`)
```json
{
  "eventId": "evt_9f8e7d6c5b4a_0013",
  "timestamp": 1759560910123,
  "eventType": "SECURITY_VIOLATION",
  "userId": "usr_attacker99",
  "payload": {
    "violationType": "SELF_ATTACK_FORBIDDEN",
    "action": "ATTACK_ATTEMPT",
    "targetPlayerId": "usr_attacker99",
    "reason": "手番プレイヤー自身の手札をアタック対象に指定することはできません",
    "clientIp": "203.0.113.***"
  },
  "isMasked": true
}
```

### 3.4 クライアントクラッシュイベント例 (`CLIENT_CRASH`)
```json
{
  "eventId": "evt_9f8e7d6c5b4a_0014",
  "timestamp": 1759560920555,
  "eventType": "CLIENT_CRASH",
  "userId": "usr_alpha123",
  "payload": {
    "errorName": "TypeError",
    "errorMessage": "Cannot read properties of undefined (reading 'color')",
    "componentStack": "at CardComponent (CardComponent.tsx:45)\nat GameBoard (GameBoard.tsx:210)"
  },
  "isMasked": false
}
```

---

## 4. 機密情報マスキング規約 (`src/lib/auditLogger.ts`)

ログ出力前にカスタムサニタイザーを通し、個人情報・認証シークレットを確実に置換します：

```typescript
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = ['password', 'authorization', 'token', 'idtoken', 'refreshtoken', 'email', 'secret'];
  const cloned = { ...data };

  for (const [key, value] of Object.entries(cloned)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      cloned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cloned[key] = sanitizeLogData(value as Record<string, unknown>);
    }
  }

  // IPアドレスの部分匿名化
  if (typeof cloned.clientIp === 'string') {
    cloned.clientIp = cloned.clientIp.replace(/\.\d+$/, '.***');
  }

  return cloned;
}
```
