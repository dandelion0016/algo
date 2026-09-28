# データベース スキーマ定義書 (Amazon DynamoDB ＆ PostgreSQL 併記)

本ドキュメントは、「アルゴ（algo）Web対戦システム」におけるデータストアの物理スキーマを定義します。  
本番環境では **AWS常時無料枠（25GB, 25 WCU / 25 RCU）** を100%享受する **Amazon DynamoDB (Single Table Design)** を採用し、将来のRDBMS移行やローカル開発環境向けに **PostgreSQL 16+ DDL** を併記します。

---

## 1. Amazon DynamoDB 設計 (Single Table Architecture)

### 1.1 テーブル基本構成
- **テーブル名**: `AlgoBattleTable`
- **課金・キャパシティモード**: **Provisioned Mode**
  - **Read Capacity Units (RCU)**: `25`（常時無料枠上限に設定）
  - **Write Capacity Units (WCU)**: `25`（常時無料枠上限に設定）
  - ※注意: On-Demandモードは無料枠対象外となるため、必ずプロビジョンドモードで 25/25 を設定し、月額コスト $0 を実現します。
- **Time To Live (TTL)**: `ttl` 属性（UNIXエポック秒）を有効化。対戦終了後のテンポラリデータ（待機部屋、リアルタイム手番ログ等）を自動パージし、25GBストレージ枠を永続的に保護。

### 1.2 キー構造とインデックス
| キー / インデックス名 | パーティションキー (PK) | ソートキー (SK) | プロジェクション | 主な役割 |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Key** | `PK` (String) | `SK` (String) | - | エンティティ全般のプライマリアクセス |
| **GSI-1** | `GSI1PK` (String) | `GSI1SK` (String) | `ALL` | 待機中ルーム検索、ユーザー参加中部屋逆引き |
| **GSI-2** | `GSI2PK` (String) | `GSI2SK` (String) | `KEYS_ONLY` | 全体レーティングランキング検索 |

---

### 1.3 エンティティ別 PK / SK マッピング一覧

| エンティティ種別 | PK 形式 | SK 形式 | GSI1PK | GSI1SK | GSI2PK | GSI2SK | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Profile** | `USER#<userId>` | `PROFILE` | `USER#EMAIL#<email>` | `PROFILE` | `RANKING#GLOBAL` | `RATING#<paddedRating>` | ユーザー基本情報・戦績 |
| **User Match History** | `USER#<userId>` | `MATCH#<timestamp>#<matchId>` | - | - | - | - | ユーザー単位の直近対戦履歴一覧 |
| **Match Room** | `ROOM#<roomId>` | `METADATA` | `ROOMS#STATUS#<status>` | `CREATED_AT#<timestamp>` | - | - | ルーム設定・進行状態 |
| **Room Participant** | `ROOM#<roomId>` | `PARTICIPANT#<userId>` | `USER#<userId>` | `ACTIVE_ROOM` | - | - | ルーム内プレイヤー状態・手札 |
| **Move Log** | `ROOM#<roomId>` | `MOVE#<paddedTurn>` | - | - | - | - | 試合中の手番・推理ログ |
| **Match Summary** | `MATCH#<matchId>` | `SUMMARY` | `MATCH#WINNER#<userId>` | `FINISHED_AT#<timestamp>` | - | - | 完了した試合の公式リザルト |

---

### 1.4 属性詳細およびサンプルデータ

#### ① User Profile (`PK: USER#<userId>`, `SK: PROFILE`)
```json
{
  "PK": "USER#usr_coda8491",
  "SK": "PROFILE",
  "GSI1PK": "USER#EMAIL#player1@example.com",
  "GSI1SK": "PROFILE",
  "GSI2PK": "RANKING#GLOBAL",
  "GSI2SK": "RATING#01620",
  "userId": "usr_coda8491",
  "username": "MathMaster",
  "email": "player1@example.com",
  "userType": "REGISTERED",
  "rating": 1620,
  "matchesPlayed": 45,
  "wins": 28,
  "createdAt": "2026-09-01T10:00:00.000Z",
  "updatedAt": "2026-09-28T12:30:00.000Z"
}
```

#### ② Match Room (`PK: ROOM#<roomId>`, `SK: METADATA`)
```json
{
  "PK": "ROOM#rm_7721ab",
  "SK": "METADATA",
  "GSI1PK": "ROOMS#STATUS#WAITING",
  "GSI1SK": "CREATED_AT#2026-09-28T21:00:00.000Z",
  "roomId": "rm_7721ab",
  "roomCode": "ALGO-8492",
  "hostUserId": "usr_coda8491",
  "roomStatus": "WAITING",
  "maxPlayers": 2,
  "turnTimeLimit": 30,
  "visibility": "PUBLIC",
  "currentTurn": 0,
  "activePlayerSeat": 1,
  "createdAt": "2026-09-28T21:00:00.000Z",
  "ttl": 1790632800
}
```

#### ③ Room Participant (`PK: ROOM#<roomId>`, `SK: PARTICIPANT#<userId>`)
```json
{
  "PK": "ROOM#rm_7721ab",
  "SK": "PARTICIPANT#usr_coda8491",
  "GSI1PK": "USER#usr_coda8491",
  "GSI1SK": "ACTIVE_ROOM",
  "roomId": "rm_7721ab",
  "userId": "usr_coda8491",
  "username": "MathMaster",
  "seatNumber": 1,
  "status": "PLAYING",
  "hand": [
    { "id": "card_b03", "color": "BLACK", "number": 3, "isOpen": false, "position": 0 },
    { "id": "card_w03", "color": "WHITE", "number": 3, "isOpen": true,  "position": 1 },
    { "id": "card_b07", "color": "BLACK", "number": 7, "isOpen": false, "position": 2 },
    { "id": "card_w10", "color": "WHITE", "number": 10, "isOpen": false, "position": 3 }
  ],
  "joinedAt": "2026-09-28T21:00:15.000Z",
  "ttl": 1790632800
}
```

#### ④ Move Log (`PK: ROOM#<roomId>`, `SK: MOVE#<paddedTurn>`)
```json
{
  "PK": "ROOM#rm_7721ab",
  "SK": "MOVE#0005",
  "moveId": "mv_901283",
  "turnNumber": 5,
  "actorUserId": "usr_coda8491",
  "actionType": "ATTACK",
  "targetUserId": "usr_da_vinci99",
  "targetCardIndex": 2,
  "guessedNumber": 7,
  "isSuccess": true,
  "revealedCard": {
    "color": "BLACK",
    "number": 7
  },
  "recordedAt": "2026-09-28T21:03:45.000Z",
  "ttl": 1790632800
}
```

#### ⑤ User Match History (`PK: USER#<userId>`, `SK: MATCH#<timestamp>#<matchId>`)
```json
{
  "PK": "USER#usr_coda8491",
  "SK": "MATCH#2026-09-28T21:10:00.000Z#mt_3391",
  "matchId": "mt_3391",
  "roomId": "rm_7721ab",
  "playerCount": 2,
  "isWinner": true,
  "opponentUsernames": ["DaVinciGamer"],
  "ratingChange": 16,
  "finishedAt": "2026-09-28T21:10:00.000Z"
}
```

---

## 2. AWS常時無料枠（25GB, 25 WCU / 25 RCU）を最大活用するアクセスパターン設計

### 2.1 アクセスパターン対応マッピング

| パターンID | 業務アクション | 実行クエリ形式 | 消費キャパシティ見込み | キャッシュ・最適化方針 |
| :--- | :--- | :--- | :--- | :--- |
| **AP-01** | ユーザープロファイル・戦績の取得 | `GetItem(PK="USER#<userId>", SK="PROFILE")` | 0.5 RCU (結果整合性) | ログイン時およびダッシュボード表示時に1回のみ読み出し |
| **AP-02** | 参加可能な待機ルーム一覧取得 | `Query(GSI1PK="ROOMS#STATUS#WAITING", Limit=20, ScanIndexForward=false)` | 1〜2 RCU | 新着順に20件限定。5秒ポーリングまたはWebSocketイベント配信 |
| **AP-03** | ルーム作成・参加 | `TransactWriteItems(Put: ROOM, Put: PARTICIPANT)` | 2 WCU | アトミック書き込みで人数超過を条件付き書き込み（ConditionExpression）で防止 |
| **AP-04** | 手番・アタック実行ログの記録 | `PutItem(PK="ROOM#<roomId>", SK="MOVE#<turn>")` | 1 WCU | アイテムサイズ約400バイト。1 WCU以内に完全収容 |
| **AP-05** | 試合中の手番ログ一覧取得 | `Query(PK="ROOM#<roomId>", SK begins_with "MOVE#")` | 1〜2 RCU | 試合復帰時のみ一括取得。通常対戦中はWebSocketでリアルタイム差分配信 |
| **AP-06** | ユーザーの直近対戦履歴取得 | `Query(PK="USER#<userId>", SK begins_with "MATCH#", Limit=10)` | 1 RCU | プロファイル画面で10件のみ表示（ページネーション対応） |
| **AP-07** | 試合終了処理（勝敗・戦績確定） | `TransactWriteItems(Put: MATCH, Update: USER1, Update: USER2, Update: ROOM)` | 4〜6 WCU | 試合完了時に1回だけアトミックに実行 |

### 2.2 キャパシティ消費シミュレーション
- 1試合あたりの想定操作（2人対戦・30ターン完走）：
  - ルーム作成・参加: 4 WCU / 2 RCU
  - 手番（30回）: 30 WCU / 30 RCU (差分WebSocket通知を併用するためDB読み込みは最小)
  - 試合終了確定: 5 WCU / 2 RCU
  - **1試合トータル消費**: 約 40 WCU / 35 RCU（約10分間の対戦）
  - **許容同時対戦数**: 25 WCU / 25 RCU の秒間バジェットがあれば、常時 **50〜100試合の同時並行プレイ** が完全無料枠内で可能。

---

## 3. PostgreSQL 16+ DDL 仕様 (将来RDS / Aurora Serverless移行用)

```sql
-- ============================================================================
-- アルゴ（algo）Web対戦システム PostgreSQL DDL
-- ============================================================================

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ユーザーマスタ
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(64) UNIQUE,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE,
    user_type VARCHAR(20) NOT NULL DEFAULT 'GUEST' CHECK (user_type IN ('REGISTERED', 'GUEST')),
    rating INTEGER NOT NULL DEFAULT 1500,
    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 対戦ルームテーブル
CREATE TABLE match_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(16) NOT NULL UNIQUE,
    host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_status VARCHAR(20) NOT NULL DEFAULT 'WAITING'
        CHECK (room_status IN ('WAITING', 'IN_PROGRESS', 'FINISHED', 'ABORTED')),
    max_players SMALLINT NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
    turn_time_limit SMALLINT NOT NULL DEFAULT 30 CHECK (turn_time_limit IN (0, 15, 30)),
    visibility VARCHAR(10) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- 3. ルーム参加者テーブル
CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_number SMALLINT NOT NULL CHECK (seat_number BETWEEN 1 AND 4),
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'READY', 'PLAYING', 'ELIMINATED', 'DISCONNECTED')),
    hand JSONB NOT NULL DEFAULT '[]'::jsonb,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_room_seat UNIQUE (room_id, seat_number),
    CONSTRAINT uq_room_user UNIQUE (room_id, user_id)
);

-- 4. 対戦結果サマリテーブル
CREATE TABLE match_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES match_rooms(id) ON DELETE SET NULL,
    winner_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    player_count SMALLINT NOT NULL CHECK (player_count BETWEEN 2 AND 4),
    total_turns INTEGER NOT NULL DEFAULT 0,
    end_reason VARCHAR(30) NOT NULL CHECK (end_reason IN ('NORMAL_WIN', 'RESIGN', 'TIMEOUT', 'DISCONNECT')),
    final_standings JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. 手番ログテーブル
CREATE TABLE move_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES match_histories(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('DRAW', 'ATTACK', 'STAY', 'TIMEOUT_FORCED')),
    target_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    target_card_index SMALLINT,
    guessed_number SMALLINT CHECK (guessed_number BETWEEN 0 AND 11),
    is_success BOOLEAN NOT NULL DEFAULT FALSE,
    revealed_card JSONB,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_match_turn UNIQUE (match_id, turn_number)
);

-- インデックス作成
CREATE INDEX idx_match_rooms_status ON match_rooms (room_status, created_at DESC);
CREATE INDEX idx_room_participants_user ON room_participants (user_id);
CREATE INDEX idx_match_histories_winner ON match_histories (winner_user_id, finished_at DESC);
CREATE INDEX idx_move_logs_match ON move_logs (match_id, turn_number ASC);
CREATE INDEX idx_users_rating ON users (rating DESC);
```
