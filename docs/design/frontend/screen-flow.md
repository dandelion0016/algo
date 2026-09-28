# 画面一覧 ＆ 画面遷移設計書: アルゴ（algo）Web対戦システム

## 1. 概要と画面設計方針

- **目的**: アルゴ（algo）Web対戦システムにおける全画面構成、モーダル表示、ゲームステートマシン、および画面間遷移フローを可視化する。
- **画面設計方針**:
  - **Single Page Application (SPA) アーキテクチャ**:
    - Next.js 15+ App Router（`/`）の単一ページ上で、`GameState.phase`（ゲーム状態）に連動してUIコンポーネントおよびモーダルを動的に切り替える。
    - 画面リロードなしで高速かつシームレスに対戦・推理が進行する体験を提供。
  - **直感的な手番ガイダンス**:
    - プレイヤーの手番状況（ドロー待ち、対象選択中、推理中、継続/ステイ選択、CPU思考中）を中央テーブルのインフォメーションエリアおよびアニメーション演出（脈動パルス、バウンス等）で常に明確に指示。
  - **モーダル駆動の論理思考インターフェース**:
    - 数字推理（アタック）、ルール確認、初期セットアップ、HITL（操作ガード）はモーダルとしてオーバーレイ表示し、思考に必要な情報（確認済み数字、対象カード位置）に集中できるレイアウトを採用。

---

## 2. 画面・モーダル一覧マトリクス

| 画面/モーダルID | 画面・モーダル名 | パス / 表示形式 | 主要コンポーネント | 役割・主要機能 |
| :--- | :--- | :--- | :--- | :--- |
| `SCR-001` | ゲームセットアップ画面 | `/` (初期表示 / phase: `SETUP`) | `SetupModal` | 対戦人数（2〜4人）、持ち時間（30秒/15秒/無制限）、CPU難易度（初級/中級/上級）の選択、ルール確認ボタン、対戦開始 |
| `SCR-002` | メイン対戦盤面 | `/` (対戦中全般) | `GameBoard`, `CardComponent` | 対戦相手の手札エリア、中央テーブル（山札・引いたカード・手番ガイド）、プレイヤー自身の手札エリア、上部ヘッダー |
| `SCR-003` | ルール解説モーダル | モーダル表示 (全フェーズ対応) | `RuleGuideModal` | アルゴ公式ルールの解説（並び順規約、初期手札、手番フロー、勝利条件）をいつでもオーバーレイ表示 |
| `SCR-004` | アタック・数字推理モーダル | モーダル表示 (phase: `PLAYER_GUESS_NUMBER`) | `AttackModal` | ターゲットカード情報、0〜11の数字選択グリッド、確認済み数字のグレーアウト＆バッジ表示、アタック確定 |
| `SCR-005` | 継続・ステイ選択パネル | インラインUI (phase: `PLAYER_DECIDE_NEXT`) | `GameBoard` (中央テーブル内) | アタック的中後の選択肢提供（「続けてアタック」または「ステイ（引いたカードを手札に加えて手番終了）」） |
| `SCR-006` | 対戦ログパネル | 画面右側（PC）/ 下部（スマホ）常時表示 | `GameLog` | 各ターンの推理結果（的中/ハズレ、推理数字、オープン情報）のリアルタイム履歴表示 |
| `SCR-007` | 決着リザルト表示 | インラインUI (phase: `GAME_OVER`) | `GameBoard` (中央テーブル内) | 勝者判定・完全勝利/敗北メッセージ、トロフィー演出、もう一度対戦する（再戦）ボタン |
| `SCR-008` | HITL確認モーダル | モーダル表示 (ユーザー操作時) | `ConfirmModal` (HITL Guard) | 進行中の対戦リセット（再戦）、設定画面への復帰、投了（ギブアップ）時の誤操作防止確認 |

---

## 3. 画面遷移図 (Screen Flow)

```mermaid
flowchart TD
    classDef modal fill:#EEF4FD,stroke:#7BA6EF,stroke-width:2px;
    classDef board fill:#FAF9F5,stroke:#1E2A44,stroke-width:2px;
    classDef action fill:#FEFDDB,stroke:#FCF97A,stroke-width:2px;
    classDef alert fill:#FFF1F2,stroke:#F43F5E,stroke-width:2px;

    Start([アプリ起動]) --> SCR001["SCR-001: セットアップ画面<br>(SetupModal)"]:::modal
    SCR001 -->|ルール確認クリック| SCR003["SCR-003: ルール解説モーダル<br>(RuleGuideModal)"]:::modal
    SCR003 -->|閉じる| SCR001

    SCR001 -->|「対戦を開始する！」| SCR002["SCR-002: メイン対戦盤面<br>(GameBoard)"]:::board

    subgraph InGame["メイン対戦ループ"]
        SCR002 -->|山札クリック| Draw["山札からドロー"]:::action
        Draw --> SelectCard["相手の伏せカードを選択"]:::action
        SelectCard --> SCR004["SCR-004: 数字推理モーダル<br>(AttackModal)"]:::modal

        SCR004 -->|キャンセル| SCR002
        SCR004 -->|数字を選択してアタック| CheckResult{"推理結果判定"}

        CheckResult -->|【的中】相手カードOPEN| SCR005["SCR-005: 継続/ステイ選択<br>(PLAYER_DECIDE_NEXT)"]:::action
        CheckResult -->|【ハズレ】引いたカードOPEN| Penalty["ペナルティ反映<br>手札にOPEN追加"]:::action

        SCR005 -->|「続けてアタック」| SelectCard
        SCR005 -->|「ステイ」引いたカードを伏せて追加| CPULoop["相手（CPU）の手番<br>(CPU_ACTING)"]:::action
        Penalty --> CPULoop

        CPULoop -->|CPUドロー ＆ 思考| CPUEval{"CPU推理結果"}
        CPUEval -->|的中 ＆ ステイ| NextCheck{"生存プレイヤー確認"}
        CPUEval -->|ハズレ ＆ オープン| NextCheck

        NextCheck -->|生存者2名以上| SCR002
        NextCheck -->|生存者残り1名| SCR007["SCR-007: 決着リザルト<br>(GAME_OVER)"]:::action
    end

    SCR002 -.->|ヘッダー「ルール」| SCR003
    SCR003 -.->|閉じる| SCR002

    SCR002 -.->|「再戦」/「設定」| SCR008["SCR-008: HITL確認モーダル<br>(破棄確認)"]:::alert
    SCR008 -.->|キャンセル| SCR002
    SCR008 -.->|再戦確定| SCR002
    SCR008 -.->|設定へ戻る確定| SCR001
    SCR007 -->|「もう一度対戦する」| SCR002
```

---

## 4. ゲームステートマシン (Game Phase State Machine)

アルゴの対戦フローは、型定義 `GamePhase` に基づく厳格な有限ステートマシンとして設計・実装されています。

```mermaid
stateDiagram-v2
    [*] --> SETUP: アプリ起動

    SETUP --> PLAYER_TURN_START: initializeGame() [ゲーム開始]

    state PlayerTurnGroup {
        PLAYER_TURN_START --> PLAYER_SELECT_TARGET: handlePlayerDraw() [山札ドローまたは山札0枚]
        PLAYER_SELECT_TARGET --> PLAYER_GUESS_NUMBER: handleSelectTargetCard() [相手伏せカード選択]
        PLAYER_GUESS_NUMBER --> PLAYER_SELECT_TARGET: onCancel() [推理キャンセル]
        PLAYER_GUESS_NUMBER --> PLAYER_DECIDE_NEXT: handleConfirmGuess() [アタック的中！]
        PLAYER_DECIDE_NEXT --> PLAYER_SELECT_TARGET: handlePlayerContinue() [続けてアタック]
    }

    PLAYER_GUESS_NUMBER --> CPU_ACTING: handleConfirmGuess() [ハズレ / 次手番がCPU]
    PLAYER_DECIDE_NEXT --> CPU_ACTING: handlePlayerStay() [ステイ / 次手番がCPU]
    PLAYER_TURN_START --> CPU_ACTING: [持ち時間切れ / 強制オープンペナルティ]
    PLAYER_SELECT_TARGET --> CPU_ACTING: [持ち時間切れ / 強制オープンペナルティ]

    state CpuTurnGroup {
        CPU_ACTING --> CPU_ACTING: CPU思考 ➔ ドロー ➔ アタック実行
    }

    CPU_ACTING --> PLAYER_TURN_START: CPU手番終了 ＆ 次手番がプレイヤー
    CPU_ACTING --> CPU_ACTING: CPU手番終了 ＆ 次手番が別CPU

    PlayerTurnGroup --> GAME_OVER: 残存プレイヤーが1名（勝者確定）
    CpuTurnGroup --> GAME_OVER: 残存プレイヤーが1名（勝者確定）

    GAME_OVER --> PLAYER_TURN_START: initializeGame() [再戦]
    GAME_OVER --> SETUP: setGameState(phase: SETUP) [設定変更]
```

### 4.1 各フェーズ（GamePhase）の詳細定義

| フェーズ名 (`GamePhase`) | トリガー条件 | 許可されるユーザー操作 | 次の遷移先フェーズ |
| :--- | :--- | :--- | :--- |
| `SETUP` | アプリ初期起動時、または対戦終了後の設定ボタン押下時 | 対戦人数選択、持ち時間選択、CPU難易度選択、ルール閲覧、対戦開始 | `PLAYER_TURN_START` |
| `PLAYER_TURN_START` | 人間プレイヤーの手番開始時 | 山札をクリックしてドロー（山札が0枚の場合は自動遷移）、ルール確認、再戦・設定 | `PLAYER_SELECT_TARGET` |
| `PLAYER_SELECT_TARGET` | ドロー完了後、または的中後の「続けてアタック」選択時 | 相手の手札の裏向きカード（`?`）をクリック選択、ルール確認 | `PLAYER_GUESS_NUMBER` |
| `PLAYER_GUESS_NUMBER` | 相手の裏向きカード選択後 | 0〜11の数字ボタン選択、アタック確定ボタン、モーダルキャンセル | `PLAYER_DECIDE_NEXT`（的中）<br>`CPU_ACTING`（ハズレ）<br>`GAME_OVER`（相手全開示で決着） |
| `PLAYER_DECIDE_NEXT` | プレイヤーのアタックが的中した直後 | 「続けてアタック」ボタン（再推理）、または「ステイ」ボタン（引いたカードを伏せて手番終了） | `PLAYER_SELECT_TARGET`（継続）<br>`CPU_ACTING`（ステイ） |
| `CPU_ACTING` | CPUの手番（1体〜複数体順次実行） | 閲覧のみ（盤面操作はロック、思考アニメーション表示中） | `PLAYER_TURN_START`（人間手番）<br>`CPU_ACTING`（別CPU手番）<br>`GAME_OVER`（決着） |
| `GAME_OVER` | いずれかの手番で生存プレイヤーが残り1名になった瞬間 | 「もう一度対戦する（再戦）」ボタン、「設定へ戻る」ボタン | `PLAYER_TURN_START`（再戦）<br>`SETUP`（設定） |

### 4.2 例外・タイムアウト処理規約
- **持ち時間切れ時の強制遷移**:
  - `PLAYER_TURN_START` または `PLAYER_SELECT_TARGET` 状態でタイマーが0秒に達した場合、山札（または引いたカード）が強制的に表向き（`isOpen = true`）で手札に挿入され、即座に手番が次プレイヤー（`CPU_ACTING` 等）へ遷移する。
- **山札0枚時の手番開始**:
  - 山札残数が0枚の場合、`PLAYER_TURN_START` からドロー処理をスキップし、手札ドローなしのまま直ちに `PLAYER_SELECT_TARGET` へ自動移行する。
