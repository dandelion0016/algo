# バックエンド ＆ ゲームロジック バリデーション ＆ エラーハンドリング規約: アルゴ（algo）Web対戦システム

本規約は、「アルゴ（algo）Web対戦システム」における入力バリデーション規約、将来のオンライン対戦API向けRFC 7807準拠エラーレスポンス形式、およびクライアント側例外ハンドリング・フォールバック設計を定義します。

---

## 1. バリデーション規約 (Input Validation Rules)

ゲームの整合性・公平性を担保するため、クライアントUI層およびゲームロジック層（将来はサーバーAPI層）において多層防御による厳格なバリデーションを実施します。

### 1.1 手番およびフェーズのバリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **手番外アクション抑止** | `activePlayerIndex` とアクション実行者（プレイヤーID）が一致していること。 | アクションを破棄し、UI操作を無効化。 |
| **フェーズ整合性チェック** | 各アクションが許容される `GamePhase` であること。<br>- ドロー: `PLAYER_TURN_START`<br>- ターゲット選択: `PLAYER_SELECT_TARGET`<br>- 数字アタック: `PLAYER_GUESS_NUMBER`<br>- 継続/ステイ: `PLAYER_DECIDE_NEXT` | 無効フェーズでのアクションは状態変更を行わず無視。 |
| **脱落プレイヤー操作抑止** | `isEliminated === true` のプレイヤーは一切のアクションを行えない。 | 操作を即座にブロック。 |

### 1.2 カード選択バリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **対象プレイヤー妥当性** | - 存在するプレイヤーIDであること。<br>- 自プレイヤー自身を選択していないこと（`playerId !== 'player'`）。<br>- 既に脱落（`isEliminated === true`）したプレイヤーでないこと。 | 対象カード選択を拒否（赤枠強調またはトースト通知）。 |
| **対象カード状態** | - 手札インデックスが `0 <= cardIndex < cards.length` の範囲内であること。<br>- 選択対象カードが**伏せ状態（`isOpen === false`）**であること（表向きカードのアタック禁止）。 | クリック無効化およびカーソル禁止（`cursor-not-allowed`）。 |

### 1.3 アタック数字入力バリデーション

| 検証項目 | 検証ルール | 違反時の処置 |
| :--- | :--- | :--- |
| **数字の範囲制約** | 整数値であり、`0 <= guessedNumber <= 11` を満たすこと。 | 入力ボタン（0〜11）のみUI上に提示し、直接の自由入力を排除。 |
| **型整合性** | `typeof guessedNumber === 'number'` かつ `Number.isInteger(guessedNumber)` かつ `!isNaN(guessedNumber)`。 | サーバー/ロジック層で即座に例外スロー。 |

### 1.4 タイムアウト時の排他制御

- カウントダウンタイマーが `0` に達した瞬間、フロントエンドの入力受付状態（`AttackModal` 等）を強制クローズし、サーバー/Controller側で `handleTimeout` を確定実行。
- タイムアウト確定後に遅れて到着したアタック宣言リクエストは破棄（Idempotent Guard）。

---

## 2. RFC 7807 準拠エラーレスポンス仕様 (将来のオンラインAPI向け)

オンライン対戦API（WebSocket / REST）におけるエラーレスポンスは、すべて **RFC 7807 (Problem Details for HTTP APIs)** に準拠した構造で返却します。

### 2.1 標準エラースキーマ

```json
{
  "type": "https://algo-game.example.com/errors/GAME_INVALID_ACTION",
  "title": "不正なゲームアクションです",
  "status": 400,
  "detail": "現在の手番プレイヤーではありません。",
  "instance": "/api/v1/rooms/room_algo_98234/actions",
  "code": "GAME_OUT_OF_TURN",
  "invalidParams": [
    {
      "name": "playerId",
      "reason": "手番は usr_opponent です。あなたの手番ではありません。"
    }
  ],
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "timestamp": 1759060800000
}
```

### 2.2 アルゴ対戦システム固有エラーコード一覧

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

## 3. クライアント側例外ハンドリング ＆ フォールバック設計

### 3.1 React Error Boundary による画面クラッシュ防止

- ゲーム画面全体を包含する `GameErrorBoundary` コンポーネントを配置。
- 万が一レンダリング中や状態更新中に捕捉されない例外が発生した場合でも、画面全体が真っ白（White-out）になるのを防ぎ、以下のフォールバックUIを表示：
  - 「ゲームの進行中に予期せぬエラーが発生しました」
  - 「現在の盤面をリセットして再起動する」ボタン（`initializeGame` 呼び出し）

### 3.2 不正操作時の視覚的・触覚的フィードバック

ユーザーの誤操作やルール違反に対しては、静かに無視するだけでなく直感的なフィードバックを提供：
1. **無効カードクリック時**: 対象カードが一瞬赤色にパルス振動し、操作不可であることを視覚的に通知。
2. **タイムアウト直前警告**: 残り5秒を切った段階でタイマー表示が赤く点滅し、警告音またはパルスアニメーションで注意喚起。
3. **アタック対象未選択時の確定ブロック**: `selectedTarget === null` の状態では「アタック確定」ボタンを無効化（`disabled`）。

### 3.3 状態不整合（State Inconsistency）からの自己修復・フォールバック

万が一、カードのオープン状態や手札枚数に不整合が生じた場合の自己修復ロジック：

```typescript
export function sanitizeGameState(state: GameState): GameState {
  // 1. 各プレイヤーの手札がルール通りソートされているか検証・再ソート
  const sanitizedPlayers = state.players.map((player) => ({
    ...player,
    cards: sortCards(player.cards),
    isEliminated: isAllOpen(player.cards),
  }));

  // 2. 生存プレイヤー数の再計算
  const activePlayers = sanitizedPlayers.filter((p) => !p.isEliminated);
  if (activePlayers.length <= 1 && state.phase !== 'GAME_OVER') {
    return {
      ...state,
      players: sanitizedPlayers,
      phase: 'GAME_OVER',
      winner: activePlayers[0] || null,
    };
  }

  return {
    ...state,
    players: sanitizedPlayers,
  };
}
```

### 3.4 オンライン対戦時のネットワーク切断・再接続ハンドリング

1. **ハートビート監視**: 5秒ごとに `ping/pong` を送受信。15秒間応答がない場合は「接続切断中」と判定。
2. **切断時の一時停止**: 切断プレイヤーに30秒の再接続猶予時間（Grace Period）を付与。
3. **State Re-sync**: 再接続成功時、クライアントはローカル状態を破棄し、サーバーから最新のマスク済み `GameState` を受信して完全同期（Snapshot Restore）。
