# バックエンド ＆ ゲームロジック バリデーション ＆ エラーハンドリング規約: アルゴ（algo）Web対戦システム

本規約は、「アルゴ（algo）Web対戦システム」における入力バリデーション規約、将来のオンライン対戦API向けRFC 7807準拠エラーレスポンス形式および生成ユーティリティ、自己修復型ステートリコンシリエーション（状態不整合修復）、およびクライアント側例外ハンドリング・フォールバック設計を定義します。

---

## 1. バリデーション規約 (Input Validation Rules)

ゲームの整合性・公平性を担保するため、クライアントUI層およびゲームロジック層（将来はサーバーAPI層）において多層防御による厳格なバリデーションを実施します。

### 1.1 手番およびフェーズのバリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **手番外アクション抑止** | `activePlayerIndex` とアクション実行者（プレイヤーID）が一致していること。 | アクションを破棄し、UI操作を無効化。 |
| **フェーズ整合性チェック** | 各アクションが許容される `GamePhase` であること。<br>- ドロー: `PLAYER_TURN_START`<br>- ターゲット選択: `PLAYER_SELECT_TARGET`<br>- 数字アタック: `PLAYER_GUESS_NUMBER`<br>- 継続/ステイ: `PLAYER_DECIDE_NEXT` | 無効フェーズでのアクションは状態変更を行わず無視。 |
| **脱落プレイヤー操作抑止** | `isEliminated === true` のプレイヤーは一切のアクションを行えない。 | 操作を即座にブロック。 |

### 1.2 カード選択・アタック対象の多層防護バリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **自身の手札アタック誤爆防止** | アタック対象プレイヤーIDが手番プレイヤー（自分）と異なること（`targetPlayerId !== activePlayer.id`）。 | 対象選択を機械的に拒否。自手札カードにはアタック選択イベントをバインドしない。 |
| **対象プレイヤー妥当性** | - 存在するプレイヤーIDであること。<br>- 既に脱落（`isEliminated === true`）したプレイヤーでないこと。 | 対象カード選択を拒否（赤枠強調またはトースト通知）。 |
| **対象カード状態** | - 手札インデックスが `0 <= cardIndex < cards.length` の範囲内であること。<br>- 選択対象カードが**伏せ状態（`isOpen === false`）**であること（表向きカードのアタック禁止）。 | クリック無効化およびカーソル禁止（`cursor-not-allowed`）。 |

### 1.3 アタック数字入力バリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **数字の範囲制約** | 整数値であり、`0 <= guessedNumber <= 11` を満たすこと。 | 入力ボタン（0〜11）のみUI上に提示し、直接の自由入力を排除。 |
| **型整合性** | `typeof guessedNumber === 'number'` かつ `Number.isInteger(guessedNumber)` かつ `!isNaN(guessedNumber)`。 | サーバー/ロジック層で即座に例外スロー。 |
| **既知・失策アシスト整合性** | 既にオープンされているカードの数字や同一カードで過去に外れた数字を警告/グレーアウト表示。 | 誤認による無駄な手番消費をアシスト機能で防止。 |

### 1.4 タイムアウト時の排他制御

- カウントダウンタイマーが `0` に達した瞬間、フロントエンドの入力受付状態（`AttackModal` 等）を強制クローズし、ロジック/Controller側でタイムアウトペナルティを確定実行。
- タイムアウト確定後に遅れて到着したアタック宣言リクエストは破棄（Idempotent Guard）。

---

## 2. RFC 7807 準拠エラーレスポンス仕様 ＆ 生成モジュール (`src/lib/problemDetails.ts`)

オンライン対戦API（WebSocket / REST）におけるエラーレスポンスは、すべて **RFC 7807 (Problem Details for HTTP APIs)** に準拠した構造で返却します。

### 2.1 RFC 7807 生成ユーティリティ (`src/lib/problemDetails.ts`)

システム内では、標準化されたファクトリ関数群を用いて一貫性のある Problem Details オブジェクトを動的生成します。

```typescript
// RFC 7807 生成関数シグネチャ
export function createProblemDetails(options: CreateProblemDetailsOptions): ProblemDetails
export function formatErrorType(errorCode: string, prefix?: string): string
export function generateUuid(): string

// 業務特化ファクトリ関数
export function createOutOfTurnProblem(expectedPlayerId: string, actualPlayerId: string): ProblemDetails
export function createInvalidTargetProblem(reason: string, details?: unknown): ProblemDetails
export function createRuleViolationProblem(ruleName: string, detail: string): ProblemDetails
```

### 2.2 標準エラースキーマ例

```json
{
  "type": "https://algo.internal/errors/game-out-of-turn",
  "title": "不正なゲームアクションです",
  "status": 400,
  "detail": "現在の手番プレイヤーではありません。",
  "instance": "urn:uuid:f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "code": "GAME_OUT_OF_TURN",
  "invalidParams": [
    {
      "name": "playerId",
      "reason": "手番は CPU 1 です。あなたの手番ではありません。"
    }
  ],
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "timestamp": 1759560800000
}
```

### 2.3 アルゴ対戦システム固有エラーコード一覧

| HTTP Status | エラーコード (`code`) | 分類 | 主な発生条件 |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `GAME_OUT_OF_TURN` | 手番不正 | 相手の手番中にアタックやドローを送信した |
| `400 Bad Request` | `GAME_PHASE_MISMATCH` | 状態不正 | ドロー前にアタックを送信した、またはアタック未的中時にステイを送信した |
| `400 Bad Request` | `GAME_INVALID_TARGET` | 対象不正 | 表向きのカードや自分自身のカードをアタック対象に指定した |
| `400 Bad Request` | `GAME_INVALID_NUMBER` | 入力値不正 | 0〜11の範囲外の数字や小数をアタック宣言した |
| `400 Bad Request` | `GAME_TIMEOUT_EXPIRED` | 時間切れ | 制限時間超過後にアタックリクエストが到着した |
| `404 Not Found` | `ROOM_NOT_FOUND` | ルーム不在 | 指定された `roomId` の対戦ルームが存在しない |
| `409 Conflict` | `ROOM_FULL` | 満員 | 既に定員（2〜4名）に達しているルームへ参加要求した |
| `409 Conflict` | `ROOM_ALREADY_STARTED` | 進行中 | 既に対戦開始済みのルームへ参加要求した |
| `500 Internal Error`| `GAME_ENGINE_PANIC` | 内部例外 | ゲーム状態計算中の予期せぬ不整合（カード枚数不一致等） |

---

## 3. クライアント側例外ハンドリング ＆ 自己修復設計

### 3.1 React Error Boundary による画面クラッシュ防止

- ゲーム画面全体を包含する `ErrorBoundary` コンポーネントを配置。
- レンダリング中や状態更新中に捕捉されない例外が発生した場合でも、画面全体が真っ白（White-out）になるのを防ぎ、以下のフォールバックUIを表示：
  - **北欧モダンデザイン**: パステル調イエロー・スカイブルー、柔らかなカード枠、システム保護警告アイコン。
  - **リカバリ操作**:
    - 「ページを再読み込み」ボタン: `window.location.reload()`
    - 「ゲームを初期化して再開」ボタン: LocalStorage/SessionStorage クリア後に安全リセット
    - 「エラー詳細を表示」アコーディオン: スタックトレース表示
  - **クラッシュレポート基盤**: `componentDidCatch` 内で `recordAuditEvent('CLIENT_CRASH', ...)` を自動発行。

### 3.2 状態不整合（State Inconsistency）からの自己修復 (`src/lib/stateReconciliation.ts`)

非同期処理やレースコンディションによってゲーム状態に万が一矛盾が発生した場合、`validateAndReconcileGameState` により**4大不整合修復ロジック（Self-Healing）**を機械的に実行します。

```typescript
export interface ReconciliationResult {
  state: GameState;
  wasRepaired: boolean;
  repairLogs: string[];
}

export function validateAndReconcileGameState(state: GameState): ReconciliationResult
```

#### 4大不整合修復ロジック:
1. **手札順序の修復 (Hand Sort Invariant)**:
   - `compareCards` に従い、全プレイヤーの手札が「数字昇順、同数字は黒が先」になっているかを検証。乱れがある場合は `sortCards` で再整列し修復。
2. **脱落判定の修復 (Elimination Status Invariant)**:
   - 手札全カードがオープン（`isAllOpen(player.cards)`）なのに `isEliminated === false` の場合は `true` に補正。
   - 逆に伏せカードが残っているのに `isEliminated === true` の場合は `false` に補正。
3. **勝者・決着判定の修復 (Winner & Phase Invariant)**:
   - 生存プレイヤーが1名以下で `phase !== 'GAME_OVER'` の場合、即座に `phase = 'GAME_OVER'` および唯一の生存者を `winner` に設定して勝敗を正常確定。
4. **手番インデックスの修復 (Active Player Invariant)**:
   - `activePlayerIndex` が脱落済みのプレイヤーを指している場合、`getNextActivePlayerIndex` により次の生存プレイヤーへ手番インデックスをスキップ修復。

### 3.3 オンライン対戦時のネットワーク切断・再接続ハンドリング

1. **ハートビート監視**: 5秒ごとに `ping/pong` を送受信。15秒間応答がない場合は「接続切断中」と判定。
2. **切断時の一時停止**: 切断プレイヤーに30秒の再接続猶予時間（Grace Period）を付与。
3. **State Re-sync**: 再接続成功時、クライアントはローカル状態を破棄し、サーバーから最新のマスク済み `GameState` を受信して完全同期（Snapshot Restore）。
