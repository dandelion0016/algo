# バックエンド ＆ ゲームロジック 業務シーケンス設計書: アルゴ（algo）Web対戦システム

本設計書は、「アルゴ（algo）Web対戦システム」におけるコアゲームフロー、プレイヤー操作、CPU推論処理、アタック結果確認演出、観戦モード自動進行、AIヒント助言、タイマー制御、および勝敗決着のシーケンスをMermaid図を用いて定義します。

---

## 1. 全体アーキテクチャ境界

- **UI / Client Component**: ユーザー入力の受付、カード描画、モーダル表示（`AttackResultModal`, `CpuAttackModal`, `HintModal`, `ResultModal` 等）、タイマー監視。
- **Game Controller (`GameBoard.tsx`)**: React State（`GameState`）のライフサイクル管理とフェーズ遷移のオーケストレーション。
- **Core Engine (`algoEngine.ts`)**: カードデッキ生成、ソート、アタック判定、生存判定等の純粋関数ロジック。
- **CPU AI (`cpuAI.ts`)**: 不完全情報ゲームにおける推論、候補絞り込み、難易度別意思決定。
- **Support Modules**: `hintAdvisor.ts`（ヒント算出）、`soundManager.ts`（SE発音）、`statsManager.ts`（戦績永続化）。

---

## 2. シーケンス a: ゲーム開始〜初期手札配布シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as プレイヤー (人間)
    participant Setup as SetupModal (UI)
    participant Board as GameBoard (Controller)
    participant Engine as algoEngine (Core)

    User->>Setup: ニックネーム設定, 人数(2〜4人), 難易度, 持ち時間選択
    User->>Setup: 「対戦を開始する！」クリック
    Setup->>Board: initializeGame(playerCount, difficulty, timeLimit)

    Board->>Engine: createDeck()
    Engine-->>Board: 全24枚カード配列 (黒12枚・白12枚)

    Board->>Engine: setupGamePlayers(playerCount, humanPlayerId)
    activate Engine
    Engine->>Engine: shuffleDeck() [Fisher-Yates]
    Engine->>Engine: プレイヤー手札配布 ＆ sortCards()
    Engine-->>Board: { players, deck } 返却
    deactivate Engine

    Board->>Board: GameState 初期化 (phase: 'PLAYER_TURN_START')
    Board-->>Setup: セットアップモーダル閉じる
    Board-->>User: 盤面描画 (人間手札オープン/CPU手札伏せ/山札表示)
```

---

## 3. シーケンス b: プレイヤー手番（ドロー〜アタック〜結果確認〜継続/ステイ）

```mermaid
sequenceDiagram
    autonumber
    actor User as プレイヤー (人間)
    participant Board as GameBoard (Controller)
    participant Modal as AttackModal (UI)
    participant ResultModal as AttackResultModal (UI)
    participant Engine as algoEngine (Core)
    participant Sound as SoundManager

    Note over Board: 手番開始 (phase: 'PLAYER_TURN_START')
    User->>Board: 山札クリック (ドロー)
    Board->>Board: drawnCard 取得 (phase: 'PLAYER_SELECT_TARGET')
    Sound->>Sound: playDraw()

    User->>Board: 相手の伏せカードを選択
    Board-->>Modal: AttackModal 表示 (候補アシスト・残弾連動)

    User->>Modal: 予想数字選択 ＆ アタック確定
    Modal->>Board: handleConfirmGuess(guessedNumber)
    Modal-->>User: モーダル閉じる

    Board->>Engine: checkAttack(targetCard, guessedNumber)

    alt 【的中 (isHit === true)】
        Engine-->>Board: true 返却
        Sound->>Sound: playAttackHit()
        Board->>Board: 対象カード isOpen: true
        Board-->>ResultModal: AttackResultModal 表示 (「的中！」案内)
        User->>ResultModal: Space/Enter または確認クリック
        ResultModal-->>Board: onConfirm()

        alt 相手脱落 ＆ 生存者1名 (リーサルK.O.)
            Board-->>User: LethalCutIn 演出 ➔ ResultModal (決着)
        else ゲーム継続
            Board->>Board: phase = 'PLAYER_DECIDE_NEXT'
            Board-->>User: 「続けてアタック」or「ステイ」選択パネル表示
        end

    else 【ハズレ (isHit === false)】
        Engine-->>Board: false 返却
        Sound->>Sound: playAttackMiss()
        Board->>Engine: insertCardInOrder(myCards, { ...drawnCard, isOpen: true })
        Board-->>ResultModal: AttackResultModal 表示 (「ハズレ」案内)
        User->>ResultModal: 確認クリック
        ResultModal-->>Board: onConfirm()
        Board->>Board: phase = 'CPU_ACTING' (手番交代)
    end
```

---

## 4. シーケンス c: 持ち時間切れ（タイムアウト強制ペナルティ）シーケンス

```mermaid
sequenceDiagram
    autonumber
    participant Timer as タイマー監視
    participant Board as GameBoard (Controller)
    participant Engine as algoEngine (Core)
    participant Sound as SoundManager
    actor User as プレイヤー (人間)

    Timer->>Board: remainingTime === 0 (タイムアップ検知)
    Sound->>Sound: playTimeWarning()
    Board->>Board: 操作ロック (AttackModal 等を強制クローズ)

    alt 山札がある場合 (未ドロー)
        Board->>Board: 山札から1枚強制ドロー
        Board->>Engine: insertCardInOrder(myCards, { ...drawn, isOpen: true })
    else 山札枯渇 (山札0枚)
        Board->>Board: 手札内の既存伏せカードを1枚強制オープン
    end

    Board->>Board: ログ追加 (タイムアウトペナルティ)
    Board->>Board: phase = 'CPU_ACTING' (次プレイヤーへ交代)
    Board-->>User: 「時間切れ！カードが強制公開されました」通知
```

---

## 5. シーケンス d: CPU手番 ＆ 演出モーダルシーケンス

```mermaid
sequenceDiagram
    autonumber
    participant Board as GameBoard (Controller)
    participant AI as cpuAI (Reasoning)
    participant CpuModal as CpuAttackModal (UI)
    participant Engine as algoEngine (Core)
    actor User as プレイヤー (人間)

    Note over Board: phase === 'CPU_ACTING'
    Board->>Board: 山札からドロー (山札0枚時はスキップ)
    Board->>AI: decideMultiCpuAttack(...)
    AI-->>Board: { targetPlayerId, targetCardIndex, guessedNumber }

    Board->>Engine: checkAttack(targetCard, guessedNumber)
    Board-->>CpuModal: CpuAttackModal 表示 (CPUの推理内容と結果演出)

    alt プレイヤー生存中
        User->>CpuModal: 結果確認クリック
    else プレイヤー脱落（観戦モード）
        Note over CpuModal: isAutoAdvance === true の場合 1500ms 後に自動進行<br/>(または「決着までスキップ」で一括完了)
    end

    CpuModal-->>Board: onConfirm()
    Board->>Board: 盤面状態更新 ＆ 次の手番へ遷移
```

---

## 6. シーケンス e: AIヒント取得シーケンス (`HintModal`)

```mermaid
sequenceDiagram
    autonumber
    actor User as プレイヤー (人間)
    participant Board as GameBoard (Controller)
    participant Advisor as hintAdvisor
    participant HintModal as HintModal (UI)

    User->>Board: 「AIヒント」ボタン押下
    Board->>Board: remainingHints > 0 かつ プレイヤー手番であることを検証
    Board->>Advisor: getBestHint(players, humanId, drawnCard, logs)
    activate Advisor
    Advisor->>Advisor: 全相手伏せカードの論理候補算出
    Advisor->>Advisor: 確定マス(候補1)優先抽出、なければ最善候補選定
    Advisor-->>Board: HintResult { targetPlayerId, targetCardIndex, possibleNumbers, isDefinite }
    deactivate Advisor

    Board->>Board: remainingHints を 1 減算
    Board-->>HintModal: HintModal 表示 (アドバイス文, 的中率, 持ち時間進行警告)

    opt ユーザーが「このカードを狙う」を選択
        User->>HintModal: 対象選択クリック
        HintModal->>Board: onSelectTarget(targetPlayerId, targetCardIndex)
    end

    User->>HintModal: モーダルを閉じる
    HintModal-->>Board: onClose()
```

---

## 7. シーケンス f: 勝敗決着 ＆ リザルト答え合わせシーケンス

```mermaid
sequenceDiagram
    autonumber
    participant Board as GameBoard (Controller)
    participant CutIn as LethalCutIn (UI)
    participant Result as ResultModal (UI)
    participant Stats as statsManager
    actor User as プレイヤー (人間)

    Note over Board: 生存プレイヤーが1名になった瞬間
    Board-->>CutIn: LethalCutIn 表示 (「💥 FINISH!!」全画面バースト)
    Note over CutIn: 1.2秒経過またはクリック/キー入力で完了
    CutIn-->>Board: onComplete()

    Board->>Stats: updateStatsAfterMatch(winner, human, playerCount, diff, logs)
    Board->>Board: phase = 'GAME_OVER'
    Board-->>Result: ResultModal 表示 (勝敗判定, 紙吹雪, 戦闘スタッツ)

    Note over Result: 【Review Hands セクション】<br/>全対戦相手の伏せカードが完全オープン表示され、答え合わせが可能
    User->>Result: 「もう一度対戦する」クリック
    Result->>Board: onPlayAgain() ➔ initializeGame()
```
