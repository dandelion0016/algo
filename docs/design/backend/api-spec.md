# バックエンド ＆ ゲームロジック API詳細仕様書: アルゴ（algo）Web対戦システム

本仕様書は、「アルゴ（algo）Web対戦システム」におけるコアゲームエンジン、CPU推論AI、および将来拡張されるオンライン対戦用WebSocket/REST APIの設計・インターフェース規約を定義します。

---

## 1. アーキテクチャ概要

本システムは、**単一責任の原則**と**純粋関数型アーキテクチャ**に基づき、ゲームルール・状態遷移ロジックをUIから完全に分離して設計されています。

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (React)                       │
│  GameBoard / CardComponent / AttackModal / SetupModal / etc.│
└──────────────────────────────┬──────────────────────────────┘
                               │ State Action Dispatch
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Game Logic Layer (Headless)                 │
│  ┌──────────────────────────────┐ ┌──────────────────────┐  │
│  │    algoEngine (純粋関数)     │ │     cpuAI (推論)     │  │
│  │  - createDeck / shuffleDeck  │ │  - getUnknownCards   │  │
│  │  - compareCards / sortCards  │ │  - getPossibleNums   │  │
│  │  - checkAttack / insertOrder │ │  - decideCpuAttack   │  │
│  └──────────────────────────────┘ └──────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 将来拡張 (Phase 2)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│         Online Server Layer (AWS Serverless / WebSocket)    │
│    API Gateway WebSocket + AWS Lambda + Amazon DynamoDB     │
│       (サーバー権威型ゲームエンジン ＆ ステートマスキング)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. コアゲームエンジン関数仕様 (Core Game Engine)

`src/lib/algoEngine.ts` に実装される純粋関数群の仕様です。ゲーム状態の不変性を維持し、副作用を排除した設計となっています。

### 2.1 データ型定義 (`src/types/game.ts`)

```typescript
export type CardColor = 'black' | 'white';

export interface SecretCard {
  id: string;        // ユニークID (例: "b-0", "w-11")
  color: CardColor;  // カードの色 ('black' | 'white')
  number: number;    // 数字 (0 〜 11)
  isOpen: boolean;   // 表向き（全開示）かどうか
}

export interface PublicCard {
  id: string;        // ユニークID (例: "b-0", "w-11")
  color: CardColor;  // カードの色 ('black' | 'white')
  number: number | null; // 数字 (0 〜 11) または 伏せ状態の相手カードは null
  isOpen: boolean;   // 表向き（全開示）かどうか
}

export type Card = SecretCard;

export type PlayerCount = 2 | 3 | 4;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type TimeLimit = 0 | 15 | 30; // 0=無制限, 15秒, 30秒

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  cards: Card[];
  isEliminated: boolean;
  avatarColor: string;
}

export type GamePhase =
  | 'SETUP'                 // 初期設定中
  | 'PLAYER_TURN_START'     // プレイヤードロー待ち
  | 'PLAYER_SELECT_TARGET'  // 相手の裏向きカードを選択中
  | 'PLAYER_GUESS_NUMBER'   // 数字を予想入力中
  | 'PLAYER_DECIDE_NEXT'    // 的中後の継続/ステイ選択中
  | 'CPU_ACTING'            // CPU思考・実行中
  | 'GAME_OVER';            // 決着・サバイバル勝者確定

export interface AttackLog {
  id: string;
  attackerId: string;
  attackerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  targetCardIndex: number;
  targetColor: CardColor;
  guessedNumber: number;
  isHit: boolean;
  actualNumber?: number; // 的中時（isHit === true）のみ開示カードの数字を記録。ハズレ時は漏洩防止のため undefined (Issue #84)
  drawnCard?: Card;
  timestamp: number;
  message: string;
}

export interface GameState {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  remainingTime: number;
  deck: Card[];
  players: Player[];
  activePlayerIndex: number;
  drawnCard: Card | null;
  phase: GamePhase;
  selectedTarget: {
    playerId: string;
    cardIndex: number;
  } | null;
  logs: AttackLog[];
  winner: Player | null;
}
```

### 2.2 アルゴ基本ソートルール比較関数: `compareCards`

アルゴの絶対ルールである手札の整列順序を定義します。

```typescript
function compareCards(a: Card, b: Card): number
```
- **仕様**:
  1. 数字の小さいカードが左（先頭）、大きいカードが右。
  2. 数字が同じ場合、「黒 (`black`)」が左、「白 (`white`)」が右。
  - 完全順序規則: `(0, black) < (0, white) < (1, black) < (1, white) < ... < (11, black) < (11, white)`
- **戻り値**:
  - `a < b` のとき負数（`-1`）
  - `a > b` のとき正数（`1`）
  - 同一カードのとき `0`

### 2.3 手札ソート・挿入関数: `sortCards`, `insertCardInOrder`

```typescript
function sortCards(cards: Card[]): Card[]
function insertCardInOrder(hand: Card[], newCard: Card): Card[]
```
- **`sortCards`**: 指定されたカード配列を `compareCards` に従い昇順ソートした新たな配列を返却。
- **`insertCardInOrder`**: 既存の手札 `hand` に `newCard` を加え、ルール通りの位置に挿入・整列した新たな配列を返却。

### 2.4 デッキ生成・シャッフル: `createDeck`, `shuffleDeck`

```typescript
function createDeck(): Card[]
function shuffleDeck(deck: Card[]): Card[]
```
- **`createDeck`**:
  - 黒 (0〜11) 12枚、白 (0〜11) 12枚の計24枚の `Card` 配列を生成。初期状態はすべて `isOpen: false`。
- **`shuffleDeck`**:
  - Fisher-Yates (Knuth) アルゴリズムを用いた偏りのない完全ランダムシャッフル。

### 2.5 配札枚数判定: `getInitialCardCount`

```typescript
function getInitialCardCount(playerCount: PlayerCount): number
```
- **公式ルール準拠**:
  - 2人対戦: 各 **4枚**（山札 16枚）
  - 3人対戦: 各 **3枚**（山札 15枚）
  - 4人対戦: 各 **3枚**（山札 12枚）

### 2.6 ゲーム初期セットアップ: `setupGamePlayers`

```typescript
function setupGamePlayers(
  deck: Card[],
  playerCount: PlayerCount
): {
  players: Player[];
  remainingDeck: Card[];
}
```
- **処理フロー**:
  1. デッキをシャッフル。
  2. 人数に応じた枚数を各プレイヤー（人間1名＋CPU `playerCount - 1` 名）に配布。
  3. 各プレイヤーの手札を `sortCards` で自動整列（初期状態は伏せ `isOpen: false`）。
  4. 残ったカードを山札 `remainingDeck` として返却。

### 2.7 アタック判定関数: `checkAttack`

```typescript
function checkAttack(targetCard: Card, guessedNumber: number): boolean
```
- **仕様**: `targetCard.number === guessedNumber` の真偽値を返却。

### 2.8 情報秘匿マスキング関数: `maskCardForPlayer`

```typescript
function maskCardForPlayer(card: Card, isOwner: boolean): PublicCard
```
- **仕様**:
  - `card.isOpen === true` または `isOwner === true` の場合、元のカード情報をそのまま維持した `PublicCard` を返却。
  - それ以外（相手の裏向きカード: `!card.isOpen && !isOwner`）の場合、`number` を `null` に置換した `PublicCard` を返却し、クライアントUI層での覗き見チートを機械的に防止。

### 2.9 手番進行関数: `getNextActivePlayerIndex`

```typescript
function getNextActivePlayerIndex(currentIndex: number, players: Player[]): number
```
- **仕様**: 時計回りに次のインデックスを走査し、脱落（`isEliminated === true`）していない最も近いプレイヤーのインデックスを返却。

### 2.10 サバイバル・ゲーム終了評価: `isAllOpen` / `evaluateGameState`

```typescript
function isAllOpen(cards: Card[]): boolean
```
- 手札の全カードが `isOpen === true` になったプレイヤーは `isEliminated = true` となる。
- 未脱落（生存）プレイヤーが残り1名になった時点で即座に勝者が確定し、`phase = 'GAME_OVER'` へ遷移。

---

## 3. CPU推論AI仕様 (CPU Reasoning AI)

アルゴの醍醐味である「情報開示と論理的消去法」をアルゴリズム化したCPU思考エンジンの仕様です（`src/lib/cpuAI.ts`）。

### 3.1 推論の基本概念（不完全情報ゲームにおける情報セット）

CPUは人間と同様に**「不正な覗き見（チート）」を行わず**、ゲーム盤面から得られる以下の公開・非公開情報のみを利用して推論を行います：
1. **CPU自身の手札**（数字・色）
2. **CPUがそのターンに引いたカード**（数字・色）
3. **盤上の全プレイヤーの表向きカード（オープンカード）**
4. **対象カードの左右にあるオープンカードの大小境界**
5. **過去のアタック失敗履歴ログ**（Hard難易度のみ）

### 3.2 未知カード集合の算出: `getAvailableUnknownCardsMulti`

```typescript
function getAvailableUnknownCardsMulti(
  cpuPlayer: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[]
): { color: CardColor; number: number }[]
```
- **アルゴリズム**:
  全24枚（黒12枚、白12枚）の集合から、以下を差分除外：
  - CPU自身の手札（未公開カード含む）
  - CPU自身が今引いたドローカード
  - 他プレイヤーの既に表向きになっているカード
- **出力**: 相手の手札または山札のどこかに眠っている「未知のカード集合」。

### 3.3 相手カードの取りうる数字候補の絞り込み: `getPossibleNumbersForTarget`

```typescript
function getPossibleNumbersForTarget(
  targetIndex: number,
  targetHand: Card[],
  availableUnknownCards: { color: CardColor; number: number }[],
  logs: AttackLog[] = [],
  targetPlayerId: string = ''
): number[]
```
対象カード $C_i$（色 $Color_i$）の候補数字集合を以下のステップで絞り込みます：

1. **色フィルタリング**: 未知カード集合から同一色の数字を抽出。
2. **左側境界（下限）の適用**:
   - $C_i$ より左にある最も近いオープンカード $L$ を探索。
   - アルゴのルールにより $L < C_i$ が成立。よって $compareCards(L, (candNum, Color_i)) < 0$ を満たさない数字を除外。
3. **右側境界（上限）の適用**:
   - $C_i$ より右にある最も近いオープンカード $R$ を探索。
   - アルゴのルールにより $C_i < R$ が成立。よって $compareCards((candNum, Color_i), R) < 0$ を満たさない数字を除外。
4. **過去ログ消去法（Hard難易度のみ）**:
   - 過去に同一プレイヤーの同一カードインデックスに対して宣言しハズレた数字の履歴（`AttackLog`）を候補から除外。

### 3.4 難易度別アタック決定ロジック: `decideMultiCpuAttack`

```typescript
export interface MultiCpuAttackDecision {
  targetPlayerId: string;
  targetCardIndex: number;
  guessedNumber: number;
}

function decideMultiCpuAttack(
  currentCpu: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[],
  difficulty: Difficulty,
  logs: AttackLog[] = []
): MultiCpuAttackDecision
```

| 難易度 | アタック対象カードの選定方針 | 推理数字の決定ロジック | 的中率・特徴 |
| :--- | :--- | :--- | :--- |
| **初級 (Easy)** | 生存している全対戦相手の伏せカードから**完全ランダム**に選択。 | 絞り込み後の候補から**一様ランダム**に1つ選択。 | プレッシャーが少なく、初心者でも快適に勝てる。 |
| **中級 (Normal)** | 全相手の全伏せカードの候補数を計算し、**最も候補数が少ないカード（最も当たりやすいカード）**を選択。 | 絞り込み後の候補から**ランダム**に選択。 | ルール通りの範囲絞り込みを行う標準的強さ。 |
| **上級 (Hard)** | 1. **確定マス（候補数1）が存在すれば最優先で選択**。<br>2. 確定マスがない場合、候補数最小のカードを選択。 | 過去ログ除外を適用した上で、**候補配列の中央値（期待値・確率が最も高いゾーン）**を選択。 | 確定牌を絶対に逃さず、論理的消去法を駆使する本格派。 |

### 3.5 的中後の継続/ステイ判定ロジック: `decideMultiCpuContinue`

```typescript
function decideMultiCpuContinue(
  currentCpu: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[],
  difficulty: Difficulty
): boolean
```
- **初級 (Easy)**: 確率 $40\%$ でアタック継続、残り $60\%$ で安全にステイ。
- **中級 (Normal)**:
  - 盤面に**確定マス（候補数1）が存在すれば $100\%$ 継続**。
  - それ以外は $75\%$ の高確率で安全にステイ（引いたカードを伏せたまま保持）。
- **上級 (Hard)**:
  - 盤面に**候補数2以下の高確率マスが存在すれば果敢に継続**。
  - 候補が3つ以上残っている不確実な局面では、確実にステイして引いたカードを裏向きで確保する合理的リスク管理。

---

## 4. 将来拡張: オンライン対戦用 API仕様 (WebSocket & REST API)

Phase 2で導入予定のサーバーレス・リアルタイムオンライン対戦機能のためのAPI仕様です。

### 4.1 REST API エンドポイント（ルーム管理）

ベースURL: `/api/v1`

| メソッド | パス | 概要 | 認証 |
| :--- | :--- | :--- | :---: |
| `POST` | `/rooms` | 新規対戦ルーム作成 | 要 (JWT) |
| `GET` | `/rooms/{roomId}` | ルーム状態・参加者一覧取得 | 要 (JWT) |
| `POST` | `/rooms/{roomId}/join`| ルームへの参加リクエスト | 要 (JWT) |
| `DELETE`| `/rooms/{roomId}` | ルーム解散（ホストのみ） | 要 (JWT) |

#### ルーム作成リクエスト例 (`POST /api/v1/rooms`)
```json
{
  "playerCount": 2,
  "difficulty": "normal",
  "timeLimit": 30,
  "isPrivate": true
}
```

#### ルーム作成レスポンス例 (`201 Created`)
```json
{
  "roomId": "room_algo_98234",
  "hostUserId": "usr_abc123",
  "playerCount": 2,
  "timeLimit": 30,
  "status": "WAITING_FOR_PLAYERS",
  "wsEndpoint": "wss://ws.algo-game.example.com/live?roomId=room_algo_98234",
  "createdAt": "2026-09-28T12:00:00Z"
}
```

### 4.2 WebSocket 双方向リアルタイムプロトコル

- **エンドポイント**: `wss://ws.algo-game.example.com/live`
- **認証**: クエリパラメータ `?token=<JWT>&roomId=<ID>`

#### クライアント送信イベント (Client -> Server)

1. **ドロー要求 (`action:draw`)**
   ```json
   {
     "action": "action:draw",
     "roomId": "room_algo_98234"
   }
   ```
2. **アタック宣言 (`action:attack`)**
   ```json
   {
     "action": "action:attack",
     "roomId": "room_algo_98234",
     "targetPlayerId": "usr_xyz789",
     "targetCardIndex": 2,
     "guessedNumber": 7
   }
   ```
3. **継続/ステイ選択 (`action:continue` / `action:stay`)**
   ```json
   {
     "action": "action:stay",
     "roomId": "room_algo_98234"
   }
   ```

#### サーバー配信イベント (Server -> Broadcast)

1. **ターン開始通知 (`game:turn_start`)**
   ```json
   {
     "event": "game:turn_start",
     "activePlayerId": "usr_abc123",
     "remainingTime": 30,
     "deckRemaining": 15
   }
   ```
2. **ドロー結果通知 (個別配信 `game:draw_private`)**
   ※引いた本人にのみ数字を開示。他プレイヤーへは「カードが引かれたこと（色のみ）」をブロードキャスト。
   ```json
   {
     "event": "game:draw_private",
     "card": { "id": "b-7", "color": "black", "number": 7, "isOpen": false }
   }
   ```
3. **アタック結果通知 (`game:attack_result`)**
   ```json
   {
     "event": "game:attack_result",
     "attackerId": "usr_abc123",
     "targetPlayerId": "usr_xyz789",
     "targetCardIndex": 2,
     "guessedNumber": 7,
     "isHit": true,
     "revealedCard": { "id": "b-7", "color": "black", "number": 7, "isOpen": true },
     "isTargetEliminated": false,
     "nextPhase": "PLAYER_DECIDE_NEXT"
   }
   ```
4. **決着・サバイバル勝者通知 (`game:game_over`)**
   ```json
   {
     "event": "game:game_over",
     "winnerId": "usr_abc123",
     "winnerName": "Alice",
     "reason": "ALL_OPPONENTS_ELIMINATED"
   }
   ```

### 4.3 チート防止（Anti-Cheat）とサーバー権威型マスキング規約

クライアント側のブラウザメモリ・通信キャプチャによる相手の手札透視を完全に防止するため、**サーバー権威型（Server-Authoritative）設計**を機械的に強制します：

1. **ステートマスキング（State Masking）**:
   - サーバーは完全なカード情報（数字含む）を保持する。
   - クライアントへ配信するステートシリアライズ処理において、**「自プレイヤーのカード」または「表向き（`isOpen === true`）のカード」以外の `number` プロパティをサーバー側で削除（`null` または省略）**する。
   ```typescript
   // サーバー側シリアライズ処理例
   function maskCardForPlayer(card: Card, viewingPlayerId: string, cardOwnerId: string): MaskedCard {
     if (card.isOpen || viewingPlayerId === cardOwnerId) {
       return card; // 数字を開示
     }
     return {
       id: card.id,
       color: card.color,
       isOpen: false,
       // number は一切含めない（通信ペイロードから秘匿）
     };
   }
   ```
2. **サーバーサイド厳格バリデーション**:
   - クライアントからのアクションは、手番判定、フェーズ判定、対象カード存在判定、0〜11の数値範囲判定をサーバー上で再検証し、不正なリクエストは即座に遮断（拒絶）する。
