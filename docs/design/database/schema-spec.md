# データベース スキーマ定義書 (Web Storage / Cookie ＆ DynamoDB ADR-0002 併記)

本ドキュメントは、「アルゴ（algo）Web対戦システム」におけるデータストアの物理スキーマを定義します。  
現行のCPU対戦ではブラウザローカル（LocalStorage / Cookie）による完全クライアントサイド永続化を実施し、オンライン対戦（ADR-0002）では **AWS常時無料枠（25GB, 25 WCU / 25 RCU）** を100%享受する **Amazon DynamoDB (Single Table Design: AlgoOnlineGameTable)** を採用します。

---

## 0. クライアントサイド永続化仕様 (Web Storage / Cookie)

クライアント完結型オフライン/CPU対戦、およびオンライン対戦のゲストセッション管理のため、以下のキーストアを利用します。

### 0.1 Cookie 仕様

| Cookie名 | 用途 | 形式・値の例 | 保存期間・属性 |
| :--- | :--- | :--- | :--- |
| `algo_user_id` | ゲストユーザーUUID識別子 | `usr_coda8491` または `usr_3f9a1b2c4d5e6f7a` | `Path=/; Max-Age=31536000 (1年); SameSite=Lax` |
| `algo_nickname` | 表示用ニックネーム (最大15文字) | `あなた`, `アリス` (XSSサニタイズ済み) | `Path=/; Max-Age=31536000 (1年); SameSite=Lax` |

### 0.2 LocalStorage 仕様

| キー名 | 型・スキーマ | 説明 |
| :--- | :--- | :--- |
| `algo_player_stats_v1` | `PlayerStats` (JSON) | 通算戦績オブジェクト。<br>・`totalMatches`: 試合総数<br>・`wins` / `losses`: 勝敗数<br>・`winRate`: 勝率 (0〜100%)<br>・`winStreak` / `maxWinStreak`: 現在/最高連勝数<br>・`totalAttacks` / `successfulAttacks`: アタック総数/的中数<br>・`accuracy`: 的中率 (0〜100%)<br>・`difficultyStats`: 難易度別勝敗マップ |
| `algo_achievements_v1` | `Achievement[]` (JSON) | 全10大実績トロフィー配列。<br>各要素: `{ id, title, description, icon, unlockedAt, progress }` |
| `algo_tutorial_completed` | `string` (`"true"` / ISO日時) | チュートリアル完了フラグ。未設定時は初回チュートリアルプロンプトを表示。 |
| `algo_tutorial_skip_prompt` | `string` (`"true"`) | チュートリアル開始確認プロンプトの「次回から表示しない」設定。 |
| `algo_sound_enabled` | `string` (`"true"` / `"false"`) | Web Audio API サウンド効果音の有効/無効設定（デフォルト `true`）。 |

---

## 1. Amazon DynamoDB 設計 (ADR-0002 準拠 Single Table Architecture)

### 1.1 テーブル基本構成
- **テーブル名**: `AlgoOnlineGameTable`
- **課金・キャパシティモード**: **Provisioned Mode**
  - **Read Capacity Units (RCU)**: `25`（常時無料枠上限）
  - **Write Capacity Units (WCU)**: `25`（常時無料枠上限）
- **Time To Live (TTL)**: `ttl` 属性（UNIXエポック秒）を有効化。ルーム終了後24時間で自動削除し、25GBストレージ枠を永続的に保護。
- **GSI不要のキー構成**:
  - GSI（Global Secondary Index）を追加するとWCU/RCUを倍消費するため、4桁ルームコード逆引き専用アイテム（`ROOMCODE#`）を同一テーブル内に配置し、**GSIゼロ・追加コストゼロ** でO(1)のキーアクセスを実現。

### 1.2 キー構造
| キー名 | 属性名 | 型 | 主な役割 |
| :--- | :--- | :--- | :--- |
| **Partition Key (PK)** | `PK` | String | エンティティ識別（`CONN#`, `ROOM#`, `ROOMCODE#`） |
| **Sort Key (SK)** | `SK` | String | サブ種別（`METADATA`, `STATE`） |

---

## 2. エンティティ別 PK / SK マッピング一覧 (ADR-0002)

| エンティティ種別 | PK 形式 | SK 形式 | 主要属性 | 用途・アクセスパターン |
| :--- | :--- | :--- | :--- | :--- |
| **接続セッション (Connection)** | `CONN#<connectionId>` | `METADATA` | `userId`, `nickname`, `roomId`, `ttl` | 接続時のConnection管理、切断時の逆引き |
| **ルーム情報 (Room)** | `ROOM#<roomId>` | `METADATA` | `roomCode`, `hostId`, `status`, `playerCount`, `maxPlayers`, `players`, `ttl` | ルーム作成・参加・待機ロビー管理 |
| **ルームコード逆引き (Room Code)** | `ROOMCODE#<roomCode>` | `ROOM#<roomId>` | `roomId`, `ttl` | 4桁コードからroomIdをO(1)で直接特定（GSI不要） |
| **ゲーム状態 (GameState)** | `ROOM#<roomId>` | `STATE` | `version`, `turnPlayerId`, `phase`, `deck`, `hands`, `logs`, `updatedAt`, `ttl` | 進行中ゲームの完全なサーバー権威型状態管理 |

---

## 3. 属性詳細およびサンプルデータ

### ① 接続セッション (`PK: CONN#<connectionId>`, `SK: METADATA`)
```json
{
  "PK": "CONN#dGhpcyBpcyBhIGNvbm5lY3Rpb24=",
  "SK": "METADATA",
  "connectionId": "dGhpcyBpcyBhIGNvbm5lY3Rpb24=",
  "userId": "usr_coda8491",
  "nickname": "あなた",
  "roomId": "rm_7721ab",
  "ttl": 1790632800
}
```

### ② ルーム情報 (`PK: ROOM#<roomId>`, `SK: METADATA`)
```json
{
  "PK": "ROOM#rm_7721ab",
  "SK": "METADATA",
  "roomId": "rm_7721ab",
  "roomCode": "A8K2",
  "hostId": "usr_coda8491",
  "status": "WAITING",
  "playerCount": 2,
  "maxPlayers": 2,
  "players": [
    { "userId": "usr_coda8491", "nickname": "あなた", "isReady": true },
    { "userId": "usr_da_vinci99", "nickname": "名探偵", "isReady": false }
  ],
  "ttl": 1790632800
}
```

### ③ ルームコード逆引き (`PK: ROOMCODE#<roomCode>`, `SK: ROOM#<roomId>`)
```json
{
  "PK": "ROOMCODE#A8K2",
  "SK": "ROOM#rm_7721ab",
  "roomCode": "A8K2",
  "roomId": "rm_7721ab",
  "ttl": 1790632800
}
```

### ④ ゲーム状態 (`PK: ROOM#<roomId>`, `SK: STATE`)
```json
{
  "PK": "ROOM#rm_7721ab",
  "SK": "STATE",
  "version": 12,
  "turnPlayerId": "usr_coda8491",
  "phase": "PLAYER_GUESS_NUMBER",
  "deck": [
    { "id": "b-1", "color": "black", "number": 1, "isOpen": false },
    { "id": "w-4", "color": "white", "number": 4, "isOpen": false }
  ],
  "hands": {
    "usr_coda8491": [
      { "id": "b-3", "color": "black", "number": 3, "isOpen": false },
      { "id": "w-3", "color": "white", "number": 3, "isOpen": true },
      { "id": "b-7", "color": "black", "number": 7, "isOpen": false }
    ],
    "usr_da_vinci99": [
      { "id": "b-0", "color": "black", "number": 0, "isOpen": true },
      { "id": "w-6", "color": "white", "number": 6, "isOpen": false }
    ]
  },
  "logs": [
    {
      "id": "log-1",
      "attackerId": "usr_coda8491",
      "attackerName": "あなた",
      "targetPlayerId": "usr_da_vinci99",
      "targetPlayerName": "名探偵",
      "targetCardIndex": 0,
      "targetColor": "black",
      "guessedNumber": 0,
      "isHit": true,
      "actualNumber": 0,
      "timestamp": 1790632810,
      "message": "あなた が 名探偵 の [黒] を [0] と推理して的中！"
    }
  ],
  "updatedAt": 1790632815,
  "ttl": 1790632800
}
```

> [!IMPORTANT] カード属性型定義（`src/types/game.ts` 準拠）
> - 各カードオブジェクトは `{ id: string, color: 'black' | 'white', number: number, isOpen: boolean }` の4属性で構成されます。
> - `position` 属性は持たず、手札配列のインデックス順（0-indexed）により左から小さい順の並びを厳密に表現します。
> - クライアントへ配信するマスク済みステートでは、他プレイヤーの伏せカードおよび山札の `number` は `null` に置換されます。

---

## 4. 排他制御（Optimistic Locking）仕様

- `GameState` 更新時は DynamoDB の条件付き書き込み（Conditional Check）を必須とします：
  ```
  ConditionExpression: "attribute_exists(version) AND version = :expectedVersion"
  ```
- タイムアウト処理とユーザーのアタックリクエストが競合した場合、バージョン不一致で片方が安全にロールバックされ、多重実行を防止します。
