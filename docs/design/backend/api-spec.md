# バックエンド ＆ ゲームロジック API詳細仕様書: アルゴ（algo）Web対戦システム

本仕様書は、「アルゴ（algo）Web対戦システム」におけるコアゲームエンジン、CPU推論AI、各種サポートライブラリ（推論補助、残弾トラッカー、AIヒント、音響、触覚、戦績・実績、バージョン管理）、およびオンライン対戦用WebSocket/REST APIの設計・インターフェース規約を定義します。

---

## 1. アーキテクチャ概要

本システムは、**単一責任の原則**と**純粋関数型アーキテクチャ**に基づき、ゲームルール・状態遷移ロジックをUIから完全に分離して設計されています。

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UI Layer (React / Next.js)                      │
│  GameBoard / CardComponent / AttackModal / SetupModal / DeckTracker / etc.│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ State Action Dispatch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Game Logic Layer (Headless)                       │
│  ┌──────────────────────────────┐ ┌─────────────────────────────────┐  │
│  │   algoEngine (コアエンジン)  │ │          cpuAI (推論AI)         │  │
│  │  - createDeck / shuffleDeck  │ │  - getUnknownCards              │  │
│  │  - compareCards / sortCards  │ │  - getPossibleNums              │  │
│  │  - checkAttack / insertOrder │ │  - decideCpuAttack              │  │
│  │  - insertCardInOrderWithIndex│ └─────────────────────────────────┘  │
│  │  - setupGamePlayers          │ ┌─────────────────────────────────┐  │
│  └──────────────────────────────┘ │      各種サポートモジュール       │  │
│  ┌──────────────────────────────┐ │  - candidateAssist / hintAdvisor│  │
│  │ stateReconciliation (不整合修復) │ │  - deckTracker / soundManager   │  │
│  │  - validateAndReconcileState │ │  - haptics / statsManager       │  │
│  │  - problemDetails (RFC 7807) │ │  - achievementManager / version │  │
│  └──────────────────────────────┘ └─────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 将来拡張 (ADR-0002)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Online Server Layer (AWS Serverless / WebSocket)            │
│         API Gateway WebSocket + AWS Lambda + Amazon DynamoDB           │
│           (サーバー権威型ゲームエンジン ＆ 不可逆ステートマスキング)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. コアゲームエンジン関数仕様 (`src/lib/algoEngine.ts`)

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

```typescript
function compareCards(a: Card, b: Card): number
```
- **仕様**:
  1. 数字の小さいカードが左（先頭）、大きいカードが右。
  2. 数字が同じ場合、「黒 (`black`)」が左、「白 (`white`)」が右。
  - 完全順序規則: `(0, black) < (0, white) < (1, black) < (1, white) < ... < (11, black) < (11, white)`
- **戻り値**:
  - `a < b` のとき `-1`
  - `a > b` のとき `1`
  - 同一カードのとき `0`

### 2.3 手札ソート・挿入関数: `sortCards`, `insertCardInOrder`, `insertCardInOrderWithIndex`

```typescript
function sortCards(cards: Card[]): Card[]
function insertCardInOrder(hand: Card[], newCard: Card): Card[]
function insertCardInOrderWithIndex(hand: Card[], newCard: Card): { newHand: Card[]; insertedIndex: number }
```
- **`sortCards`**: 指定されたカード配列を `compareCards` に従い昇順ソートした新たな配列を返却。
- **`insertCardInOrder`**: 既存の手札 `hand` に `newCard` を加え、ルール通りの位置に挿入・整列した新たな配列を返却。
- **`insertCardInOrderWithIndex`**: 手札挿入後の新配列 `newHand` に加え、新カードが挿入された正確な0-indexed位置 `insertedIndex` を返却（UIアニメーションやフォーカス制御用）。

### 2.4 デッキ生成・プレイヤー初期化: `createDeck`, `shuffleDeck`, `setupGamePlayers`

```typescript
function createDeck(): Card[]
function shuffleDeck(deck: Card[]): Card[]
function setupGamePlayers(count: PlayerCount, humanPlayerId: string = 'human'): { players: Player[]; deck: Card[] }
```
- **`createDeck`**: 黒0〜11（12枚）および白0〜11（12枚）の計24枚（`isOpen: false`）を生成。
- **`shuffleDeck`**: Fisher-Yates アルゴリズムによる偏りのない完全ランダムシャッフル。
- **`setupGamePlayers`**:
  - プレイヤー数に応じた初期手札枚数（2人: 各4枚、3人: 各3枚、4人: 各3枚）を配分し、各プレイヤーの手札をルール通りにソート。
  - 第一引数に対戦人数、第二引数に人間プレイヤーの識別子 `humanPlayerId`（ゲストUUID等）を受け取り、柔軟なプレイヤーID設定をサポート。
  - 残ったカードを山札 `deck`（2人: 16枚、3人: 15枚、4人: 12枚）として返却。

### 2.5 アタック判定: `checkAttack`

```typescript
function checkAttack(targetCard: Card, guessedNumber: number): boolean
```
- `targetCard.number === guessedNumber` のとき `true`（的中）、不一致のとき `false`（ハズレ）。

### 2.6 山札枯渇時のゲームルール仕様
- **山札0枚時の手番開始**:
  - 手番開始時（`PLAYER_TURN_START`）に山札残数が0枚の場合、ドロー処理をスキップし、手札ドローなしのまま直ちにアタック対象選択（`PLAYER_SELECT_TARGET`）へ自動移行する。
- **山札枯渇時のアタック的中・ステイ**:
  - アタック成功後、ステイを選択した場合は新たに加えるドローカードが存在しないため、追加手札なしでそのまま次プレイヤーへ手番が移る。
- **山札枯渇時のペナルティ**:
  - 山札枯渇時にアタックを失敗した場合、あるいは持ち時間を超過した場合は、手札内の既存の裏向きカード（伏せカード）から1枚が強制的にオープン（`isOpen = true`）される。

---

## 3. サポートライブラリ詳細仕様 (`src/lib/`)

### 3.1 推理候補アシスト (`src/lib/candidateAssist.ts`)
プレイヤーおよびCPUがターゲットカードの数字を論理的に絞り込むための推論支援関数群。

- **`getPossibleNumbersForCard(params)`**:
  ```typescript
  export interface CandidateAssistParams {
    targetPlayer: Player;
    targetCardIndex: number;
    targetColor: CardColor;
    players?: Player[];
    drawnCard?: Card | null;
    playerHand?: (Card | PublicCard)[];
    failedGuesses?: number[];
  }
  export function getPossibleNumbersForCard(params: CandidateAssistParams): number[]
  ```
  - アルゴの基本ソートルール（小さい順、同数は黒が先）と、両隣の確定カード（手札内のオープン済みカードや自手札）の境界値から、ターゲットカードが取り得る数字の最小値・最大値を数学的に算出。
  - 既にオープンされたカード、自分の手札、引いたカード、および過去に外れた数字（`failedGuesses`）を除外し、有効な候補数字配列（昇順）を返却。
- **`getFailedGuessNumbersForCard`**:
  ```typescript
  export function getFailedGuessNumbersForCard(
    logs: AttackLog[],
    targetPlayerId: string,
    targetCardIndex: number,
    targetColor: CardColor
  ): number[]
  ```
  - 対戦ログ（`AttackLog[]`）を走査し、同一カードに対して過去に推理されて外れた数字を重複なく抽出。

### 3.2 AIヒントアドバイザー (`src/lib/hintAdvisor.ts`)
1戦1回限定でプレイヤーに最善手・確定マスを助言するAI推論モジュール。

- **`getBestHint`**:
  ```typescript
  export interface HintResult {
    targetPlayerId: string;
    targetPlayerName: string;
    targetCardIndex: number;
    color: CardColor;
    possibleNumbers: number[];
    isDefinite: boolean;
    adviceText: string;
  }
  export function getBestHint(
    players: Player[],
    humanId: string = 'human',
    drawnCard?: Card | null,
    logs?: AttackLog[]
  ): HintResult | null
  ```
  - 全対戦相手の裏向きカードを走査し、`getPossibleNumbersForCard` を実行。
  - **確定マス（候補数1）**: 候補が1つのカード（`isDefinite = true`）が存在すれば最優先で提案。
  - **最善候補マス（候補数最小）**: 確定マスがない場合、候補数が最も少なく的中期待値が最も高いカードを抽出して提案。

### 3.3 残弾トラッカーHUD計算 (`src/lib/deckTracker.ts`)
全24枚のカード残弾・開示ステータスを一括算出するHUD計算モジュール。

- **`calculateDeckTrackerState`**:
  ```typescript
  export interface TrackedCard {
    color: CardColor;
    number: number;
    isConfirmed: boolean;
    isHighlighted: boolean;
  }
  export interface DeckTrackerSummary {
    totalRemaining: number;
    blackRemaining: number;
    whiteRemaining: number;
    totalConfirmed: number;
    blackConfirmed: number;
    whiteConfirmed: number;
  }
  export interface DeckTrackerState {
    blackCards: TrackedCard[];
    whiteCards: TrackedCard[];
    summary: DeckTrackerSummary;
  }
  export function calculateDeckTrackerState(options: DeckTrackerOptions): DeckTrackerState
  ```
  - Information Hiding 原則を厳守し、相手の裏向きカードや山札の伏せ数字は一切参照せず、人間の手札・全オープンカード・自ドローカードのみから確定状況を導出。

### 3.4 音響 ＆ 触覚モジュール (`src/lib/soundManager.ts`, `src/lib/haptics.ts`)
- **`SoundManager` (`soundManager.ts`)**:
  - Web Audio API を活用したプログラマティック効果音シンセサイザー。
  - 外部オーディオアセット不要で完全オフライン・ゼロレイテンシ動作。
  - 主な発音メソッド: `playDraw()`, `playAttackHit()`, `playAttackMiss()`, `playLethal()`, `playVictory()`, `playDefeat()`, `playCardSelect()`, `playTimeWarning()`。
  - サウンド有効/無効の永続化（LocalStorage: `algo_sound_enabled`）。
- **触覚フィードバック (`haptics.ts`)**:
  - Web Vibration API（`navigator.vibrate`）をラップしたモバイル向け触覚演出。
  - `vibrateLight()` (15ms タップ/ドロー), `vibrateSuccess()` ([20, 50, 40]ms 的中/勝利), `vibratePenalty()` ([80, 50, 80]ms ハズレ/警告)。非対応環境では安全に無効化。

### 3.5 通算戦績 ＆ 実績マネージャー (`src/lib/statsManager.ts`, `src/lib/achievementManager.ts`)
- **`statsManager.ts`**:
  - クライアント側（LocalStorage: `algo_player_stats_v1`）での通算戦績永続化。
  - データ項目: 試合数（`totalMatches`）、勝利数（`wins`）、勝率（`winRate`）、連勝数（`winStreak`）、最大連勝（`maxWinStreak`）、総アタック回数（`totalAttacks`）、的中回数（`successfulAttacks`）、的中率（`accuracy`）、難易度別勝敗。
  - 関数: `loadStats()`, `saveStats()`, `updateStatsAfterMatch(winner, human, playerCount, diff, logs)`, `resetStats()`。
- **`achievementManager.ts`**:
  - 全10大実績トロフィーシステム（LocalStorage: `algo_achievements_v1`）。
  - 実績リスト:
    1. `first_win`: 初勝利
    2. `perfect_win`: 完全試合（自手札1枚も開示されずに勝利）
    3. `win_streak_3`: 3連勝達成
    4. `fast_solver`: 電光石火（持ち時間15秒ルールで勝利）
    5. `hard_conqueror`: 上級制覇（難易度「上級」CPUに勝利）
    6. `guess_master`: 神速の推理（1試合で的中率75%以上・3回以上アタック）
    7. `four_player_win`: バトロワ覇者（4人対戦で優勝）
    8. `comeback_king`: 起死回生（手札残り1枚からの逆転勝利）
    9. `speed_demon`: 秒撃（5秒以内の即断アタック成功）
    10. `persistent_player`: 百戦錬磨（通算10試合プレイ）
  - 関数: `loadAchievements()`, `checkAchievements(stats, matchContext)`, `resetAchievements()`。

### 3.6 アプリケーションバージョン管理 (`src/lib/version.ts`)
- **`getAppVersion()`**:
  - 優先度順にバージョン文字列を返却：
    1. 環境変数 `NEXT_PUBLIC_APP_VERSION`（CI/CDビルド時にGitタグ/コミットハッシュから動的注入）
    2. `package.json` の `version`（プレフィックス `v` 付与）
    3. デフォルトフォールバック（`v0.1.0`）

---

## 4. オンライン対戦用 WebSocket API仕様 (ADR-0002 準拠)

### 4.1 接続確立と認証
- **エンドポイント**: `wss://ws.algo.example.com`
- **クエリパラメータ**: `?userId=usr_xxx&nickname=xxx&roomCode=xxxx`

### 4.2 WebSocket 双方向リアルタイムプロトコル

#### クライアント送信イベント (Client -> Server)
1. **ルーム作成 (`room:create`)**: 4桁ルームコード発行とホスト登録。
2. **ルーム参加 (`room:join`)**: ルームコード指定でのロビー参加。
3. **ゲーム開始 (`game:start`)**: ホストによる対戦開始指示。
4. **ドロー要求 (`game:draw`)**: 手番プレイヤーのカード引き要求。
5. **アタック宣言 (`game:attack`)**:
   ```json
   {
     "action": "game:attack",
     "targetPlayerId": "usr_xyz789",
     "targetCardIndex": 2,
     "guessedNumber": 7
   }
   ```
6. **ステイ宣言 (`game:stay`)**: 的中後の手番終了指示。

#### サーバー配信イベント (Server -> Broadcast / Unicast)
1. **初期ステート配信 (`game:state_sync`)**: 各プレイヤー向けに不可逆マスキングされた個別ステート。
2. **個別ドロー通知 (`game:draw_private`)**: 引いた本人にのみカード数字を開示。他プレイヤーへは色のみ通知。
3. **アタック結果通知 (`game:attack_result`)**: 的中/ハズレ判定、開示カード情報、次フェーズ指示。
4. **決着通知 (`game:game_over`)**: 勝者情報、最終戦績。

### 4.3 不可逆ステートマスキングによるチート防止
- クライアント通信から相手の伏せカードの `number` 属性を完全に削除（`number: null`）。
- ブラウザ側DevToolsやパケット傍受による透視チートを数学的・物理的に不可能にするゼロトラスト権威サーバーモデルを強制。
