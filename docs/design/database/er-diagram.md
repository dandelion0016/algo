# データベース ER図 ＆ データモデリング設計書 (アルゴ Web対戦システム)

## 1. モデリング方針

本ドキュメントは、「アルゴ（algo）Web対戦システム」におけるオンライン対戦・戦績記録・ルーム管理・手番ログのデータモデルおよびリレーションシップを定義します。

### 1.1 基本設計原則
1. **アルゴのゲームルールへの忠実性**:
   - カード総数24枚（黒: 0〜11, 白: 0〜11）、裏向き（Closed）/表向き（Open）状態の管理。
   - 2人〜4人対戦のプレイヤー席順（Seat 1〜4）およびライフサイクル（待機、対戦中、脱落、勝利）。
2. **高速なリアルタイム対戦と監査・再現性の両立**:
   - 手番単位の推理ログ（MoveLogs）を時系列で完全に記録し、試合の棋譜再生や不正検知を可能にする。
3. **ハイブリッド永続化アーキテクチャ**:
   - プライマリDB（AWS本番環境）: **Amazon DynamoDB**（Single Table Designによる超高速・AWS常時無料枠最適化）。
   - リレーショナル論理モデル（および開発・移行用）: **PostgreSQL 16+**（第3正規形準拠＋戦績集計の戦略的非正規化）。

---

## 2. ERダイアグラム (Entity-Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ MATCH_ROOMS : "hosts"
    USERS ||--o{ ROOM_PARTICIPANTS : "joins"
    MATCH_ROOMS ||--|{ ROOM_PARTICIPANTS : "contains (2..4)"
    MATCH_ROOMS ||--o| MATCH_HISTORIES : "results in"
    USERS ||--o{ MATCH_HISTORIES : "wins"
    MATCH_HISTORIES ||--|{ MOVE_LOGS : "records"
    USERS ||--o{ MOVE_LOGS : "acts as (actor/target)"

    USERS {
        uuid id PK "ユーザー固有ID (Cognito sub連携)"
        varchar username "表示名 / プレイヤー名"
        varchar email "メールアドレス (ゲスト時はNULL)"
        varchar user_type "REGISTERED / GUEST"
        integer rating "レーティング値 (初期値: 1500)"
        integer matches_played "総対戦数"
        integer wins "勝利数"
        timestamptz created_at "登録日時"
        timestamptz updated_at "更新日時"
    }

    MATCH_ROOMS {
        uuid id PK "ルーム固有ID (短縮ID/UUID)"
        uuid host_user_id FK "部屋主ユーザーID"
        varchar room_code "合流用短縮コード (例: ALGO-8492)"
        varchar room_status "WAITING / IN_PROGRESS / FINISHED / ABORTED"
        integer max_players "最大参加人数 (2..4)"
        integer turn_time_limit "持ち時間秒 (15 / 30 / 0=無制限)"
        varchar visibility "PUBLIC / PRIVATE"
        timestamptz created_at "作成日時"
        timestamptz started_at "対戦開始日時"
        timestamptz finished_at "対戦終了日時"
        integer ttl "DynamoDB自動失効エポック秒"
    }

    ROOM_PARTICIPANTS {
        uuid id PK "参加レコードID"
        uuid room_id FK "参加先ルームID"
        uuid user_id FK "参加ユーザーID"
        integer seat_number "席順 (1..4)"
        varchar status "WAITING / READY / PLAYING / ELIMINATED / DISCONNECTED"
        jsonb initial_hand "初期手札 (暗号化またはマスク管理)"
        jsonb current_hand "現在手札状態 (公開/非公開カード配列)"
        timestamptz joined_at "参加日時"
    }

    MATCH_HISTORIES {
        uuid id PK "対戦結果ID (match_id)"
        uuid room_id FK "元ルームID"
        uuid winner_user_id FK "勝者ユーザーID"
        integer player_count "対戦人数 (2..4)"
        integer total_turns "総ターン数"
        varchar end_reason "NORMAL_WIN / RESIGN / TIMEOUT / DISCONNECT"
        jsonb final_standings "最終順位・スコア一覧 [{user_id, rank, cards_open}]"
        timestamptz started_at "対戦開始日時"
        timestamptz finished_at "対戦終了日時"
    }

    MOVE_LOGS {
        uuid id PK "手番ログID"
        uuid match_id FK "対象対戦結果ID"
        integer turn_number "ターン番号 (1, 2, 3...)"
        uuid actor_user_id FK "手番実行プレイヤー"
        varchar action_type "DRAW / ATTACK / STAY / TIMEOUT_FORCED"
        uuid target_user_id FK "アタック対象プレイヤー (NULL可)"
        integer target_card_index "対象プレイヤーの手札位置インデックス"
        integer guessed_number "宣言した数字 (0..11)"
        boolean is_success "アタック的中成否"
        jsonb revealed_card "公開されたカード情報 {color, number}"
        timestamptz recorded_at "ログ記録日時"
    }
```

---

## 3. カーディナリティとリレーションシップ詳細

| 親エンティティ | 子エンティティ | 関連 (Cardinality) | 削除ポリシー (ON DELETE) | 整合性制約 ＆ 業務ルール |
| :--- | :--- | :---: | :--- | :--- |
| `USERS` | `MATCH_ROOMS` | 1 : N | `SET NULL` | 部屋主が退会・切断しても、進行中のルームは終了または代理ホスト移行する |
| `MATCH_ROOMS` | `ROOM_PARTICIPANTS` | 1 : 2..4 | `CASCADE` | ルーム破棄時は参加セッション情報も連動削除（待機中ルームのみ） |
| `USERS` | `ROOM_PARTICIPANTS` | 1 : N | `CASCADE` | 1ユーザーは同時に1つのアクティブなルームにのみ参加可能（ユニーク制約） |
| `MATCH_ROOMS` | `MATCH_HISTORIES` | 1 : 0..1 | `RESTRICT` | 試合が成立した場合のみ1件の結果履歴が生成される |
| `USERS` | `MATCH_HISTORIES` | 1 : N | `RESTRICT` | 過去の戦績記録はプレイヤーアカウント削除時も監査・ランキング整合性のため保持 |
| `MATCH_HISTORIES` | `MOVE_LOGS` | 1 : N | `CASCADE` | 1試合あたり平均20〜60手の手番ログが記録される |

---

## 4. 正規化および非正規化方針

### 4.1 第3正規形（3NF）の適用
- ユーザー属性、ルームメタデータ、対戦履歴、手番ログを分離し、更新時異常・重複挿入を防止。
- 手番ごとの推論操作（アタック・判定・公開）を独立したイミュータブル（変更不能）なイベントレコードとして記録。

### 4.2 戦略的非正規化（パフォーマンス・リアルタイム性最適化）
1. **戦績集計カラムの保持 (`USERS` テーブル)**:
   - `matches_played`, `wins`, `rating` を `USERS` テーブルに直接保持。
   - 対戦終了時に `MATCH_HISTORIES` の挿入と同時にアトミック（トランザクション）にインクリメントし、一覧表示時の `COUNT(*)` 集計負荷を排除。
2. **手札スナップショットのJSONB保持 (`ROOM_PARTICIPANTS` テーブル)**:
   - カード24枚の物理テーブルを細分化（カード単位の個別行）せず、プレイヤーごとの手札配列（`current_hand`）をJSONB/Map形式で集約保持。
   - アルゴの手札は最大でも4枚〜6枚程度と極小であるため、行分割によるJOINのオーバーヘッドを避け、1回のI/Oで手札全体の整列・開示状態を取得可能にする。
