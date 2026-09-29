# バックエンド ＆ ゲームロジック 業務シーケンス設計書: アルゴ（algo）Web対戦システム

本設計書は、「アルゴ（algo）Web対戦システム」におけるコアゲームフロー、プレイヤー操作、CPU推論処理、時間切れペナルティ、および勝敗決着のシーケンスをMermaid図を用いて定義します。

---

## 1. 全体アーキテクチャ境界

- **UI / Client Component**: ユーザー入力の受付、カード描画、モーダル表示、タイマー監視。
- **Game Controller (`GameBoard.tsx`)**: React State（`GameState`）のライフサイクル管理とフェーズ遷移のオーケストレーション。
- **Core Engine (`algoEngine.ts`)**: カードデッキ生成、ソート、アタック判定、生存判定等の純粋関数ロジック。
- **CPU AI (`cpuAI.ts`)**: 不完全情報ゲームにおける推論、候補絞り込み、難易度別意思決定。

---

## 2. シーケンス a: ゲーム開始〜初期手札配布シーケンス

プレイヤーが人数（2〜4人）、難易度（Easy/Normal/Hard）、持ち時間（無制限/15秒/30秒）を選択してゲームを開始するフローです。

```mermaid
sequenceDiagram
    autonumber
    actor User as プレイヤー (人間)
    participant Setup as SetupModal (UI)
    participant Board as GameBoard (Controller)
    participant Engine as algoEngine (Core)

    User->>Setup: 設定選択 (人数: 2〜4人, 難易度, 持ち時間)
    User->>Setup: 「ゲームを開始する」クリック
    Setup->>Board: initializeGame(playerCount, difficulty, timeLimit)

    Board->>Engine: createDeck()
    Engine-->>Board: 全24枚カード配列返却 (黒12枚・白12枚)

    Board->>Engine: setupGamePlayers(rawDeck, playerCount)
    activate Engine
    Engine->>Engine: shuffleDeck() [Fisher-Yates]
    Engine->>Engine: getInitialCardCount(playerCount) [2人:4枚, 3人:3枚, 4人:3枚]
    Engine->>Engine: プレイヤー手札配布 ＆ sortCards()
    Engine->>Engine: CPU手札配布 ＆ sortCards()
    Engine-->>Board: { players, remainingDeck } 返却
    deactivate Engine

    Board->>Board: GameState 初期化<br/>(phase: 'PLAYER_TURN_START', activePlayerIndex: 0)
    Board-->>Setup: セットアップモーダル閉じる
    Board-->>User: 盤面描画 (人間手札オープン/CPU手札伏せ/山札表示)
```

---

## 3. シーケンス b: プレイヤー手番（ドロー〜アタック〜判定〜コンティニュー/ステイ）

プレイヤーの標準手番サイクルです。ドローからアタック、的中・ハズレによる分岐、および継続またはステイの選択フローを網羅します。

```mermaid
sequenceDiagram
    autonumber
    actor User as プレイヤー (人間)
    participant Board as GameBoard (Controller)
    participant Modal as AttackModal (UI)
    participant Engine as algoEngine (Core)
    participant Timer as ターンタイマー

    Note over Board,Timer: 手番開始 (phase: 'PLAYER_TURN_START')
    Board->>Timer: カウントダウン開始 (15s / 30s)

    User->>Board: 山札クリック (ドロー要求)
    Board->>Board: deck[0] を drawnCard として取得 (phase: 'PLAYER_SELECT_TARGET')
    Board-->>User: 引いたカードを手元に表示 (自分のみ数字閲覧可)

    User->>Board: 相手の伏せカードを選択
    Board->>Board: selectedTarget 設定 (phase: 'PLAYER_GUESS_NUMBER')
    Board-->>Modal: AttackModal 表示 (数字 0〜11 入力キーパッド)

    User->>Modal: 予想数字選択 (例: 「7」) ＆ 「アタック確定」
    Modal->>Board: handleConfirmGuess(guessedNumber: 7)
    Modal-->>User: モーダル閉じる

    Board->>Engine: checkAttack(targetCard, 7)

    alt 【的中 (isHit === true)】
        Engine-->>Board: true 返却
        Board->>Board: 対象カードを isOpen: true に更新
        Board->>Board: ログ追加 (AttackLog)
        Board->>Engine: evaluateGameState(updatedPlayers)

        alt 相手の全カードがオープン (脱落)
            Board->>Board: isEliminated = true
            alt 生存者が1名のみ (完全勝利)
                Board->>Board: phase = 'GAME_OVER', winner 確定
                Board-->>User: 勝利リザルト画面表示
            end
        else ゲーム継続
            Board->>Board: phase = 'PLAYER_DECIDE_NEXT'
            Board-->>User: 「続けてアタック」or「ステイ」ダイアログ表示

            alt ユーザーが「続けてアタック」を選択
                User->>Board: 「続けてアタック」クリック
                Board->>Board: phase = 'PLAYER_SELECT_TARGET' (山札は引かず次の対象選択へ)
            else ユーザーが「ステイ」を選択
                User->>Board: 「ステイ」クリック
                Board->>Engine: insertCardInOrder(playerCards, { ...drawnCard, isOpen: false })
                Board->>Engine: getNextActivePlayerIndex(currentIndex, players)
                Board->>Board: activePlayerIndex 移行, phase = 'CPU_ACTING'
            end
        end

    else 【ハズレ (isHit === false)】
        Engine-->>Board: false 返却
        Board->>Board: ログ追加 (ハズレログ)
        Board->>Engine: insertCardInOrder(playerCards, { ...drawnCard, isOpen: true })
        Note over Board: ペナルティ: 引いたカードを表向きで手札の正しい位置に公開挿入
        Board->>Engine: getNextActivePlayerIndex(0, players)
        Engine-->>Board: nextActiveIdx 返却
        Board->>Board: activePlayerIndex = nextActiveIdx, phase = 'CPU_ACTING'
        Board-->>User: ハズレ演出 ＆ オープンカード挿入アニメーション
    end
```

---

## 4. シーケンス c: ターンタイマー切れ（時間切れペナルティ）シーケンス

制限時間（15秒/30秒）内にプレイヤーがアクションを完了しなかった場合の強制ペナルティフローです。

```mermaid
sequenceDiagram
    autonumber
    participant Timer as ターンタイマー (useEffect)
    participant Board as GameBoard (Controller)
    participant Engine as algoEngine (Core)
    actor User as プレイヤー (人間)

    Note over Timer: 毎秒カウントダウン (remainingTime <= 1)
    Timer->>Board: タイムアウト検知 (handleTimeout)

    rect rgb(255, 240, 240)
        Note over Board: 時間切れペナルティ処理
        alt まだドローしていない場合
            Board->>Board: 山札トップから1枚取得
        end
        Board->>Engine: insertCardInOrder(playerCards, { ...penaltyCard, isOpen: true })
        Note over Board: ドローカードを強制オープン（表向き）で自手札に整列挿入

        Board->>Board: タイムアウト失策ログ記録 (AttackLog)
        Board->>Engine: getNextActivePlayerIndex(0, players)
        Engine-->>Board: nextActiveIdx (次のCPU)
        Board->>Board: activePlayerIndex = nextActiveIdx, phase = 'CPU_ACTING'
    end

    Board-->>User: 「時間切れ！カードが強制公開され手番交代」トースト・演出表示
```

---

## 5. シーケンス d: CPU手番（思考・カード選択・推論・結果反映）シーケンス

CPUが盤面情報と難易度（Easy/Normal/Hard）に基づき、論理的消去法を実行して自律行動するフローです。

```mermaid
sequenceDiagram
    autonumber
    participant Board as GameBoard (Controller)
    participant AI as cpuAI (Reasoning)
    participant Engine as algoEngine (Core)
    actor User as プレイヤー (人間)

    Note over Board: phase === 'CPU_ACTING' 検知
    Board->>Board: 山札から1枚ドロー (cpuDrawnCard)
    Board-->>User: 「CPUが山札からドロー中...」ステータス表示

    Note over Board: 思考ディレイ (UX演出用 1000ms〜1500ms)
    Board->>AI: decideMultiCpuAttack(currentCpu, cpuDrawn, players, difficulty, logs)

    activate AI
    AI->>AI: getAvailableUnknownCardsMulti()<br/>(自手札・ドロー・全オープンカード除外)

    loop 全生存対戦相手の全伏せカード
        AI->>AI: getPossibleNumbersForTarget()<br/>(左右オープンカードの境界・大小制約判定)
        opt Hard難易度
            AI->>AI: 過去の失策ログ除外 (消去法)
        end
    end

    alt 難易度: Easy
        AI->>AI: ランダムな相手カード ＆ 候補からランダム数字選択
    else 難易度: Hard (確定マスあり)
        AI->>AI: 候補数 === 1 のカード・数字を最優先選択
    else 難易度: Normal / Hard (確定マスなし)
        AI->>AI: 最も候補数が少ないカードを選択 ＆ (Hard: 中央値 / Normal: ランダム)
    end
    AI-->>Board: MultiCpuAttackDecision { targetPlayerId, targetCardIndex, guessedNumber }
    deactivate AI

    Board->>Engine: checkAttack(targetCard, guessedNumber)

    alt 【CPUアタック的中】
        Engine-->>Board: true 返却
        Board->>Board: 対象カードを isOpen: true に更新
        Board->>Board: ログ記録 (CPU的中ログ)
        Board->>Engine: evaluateGameState(players)

        alt 相手脱落 ＆ 生存者1名
            Board->>Board: phase = 'GAME_OVER', winner = CPU
            Board-->>User: ゲームオーバー（敗北）画面表示
        else ゲーム継続
            Board->>AI: decideMultiCpuContinue(currentCpu, cpuDrawn, players, difficulty)
            alt CPU継続を選択 (Hardかつ有力候補あり)
                AI-->>Board: true (継続)
                Note over Board: 再度 decideMultiCpuAttack へループ
            else CPUステイを選択 (安全策)
                AI-->>Board: false (ステイ)
                Board->>Engine: insertCardInOrder(cpuCards, { ...cpuDrawn, isOpen: false })
                Board->>Engine: getNextActivePlayerIndex(cpuIdx, players)
                Board->>Board: 次のプレイヤーへ手番交代
            end
        end

    else 【CPUアタックハズレ】
        Engine-->>Board: false 返却
        Board->>Board: ログ記録 (CPUハズレログ)
        Board->>Engine: insertCardInOrder(cpuCards, { ...cpuDrawn, isOpen: true })
        Note over Board: CPUの手札に引いたカードが表向きで公開挿入
        Board->>Engine: getNextActivePlayerIndex(cpuIdx, players)
        Board->>Board: 次のプレイヤーへ手番交代
    end

    Board-->>User: 最新盤面描画 ＆ CPU行動結果メッセージ表示
```

---

## 6. シーケンス e: 勝敗決着（サバイバル判定）シーケンス

プレイヤーの手札がすべて表向きになった際の脱落判定と、最後の1人が残った際のサバイバル勝利決定フローです。

```mermaid
sequenceDiagram
    autonumber
    participant Board as GameBoard (Controller)
    participant Engine as algoEngine (Core)
    actor Winner as 勝者プレイヤー
    actor Loser as 敗北・脱落プレイヤー

    Note over Board: アタック的中時 (checkAttack === true)
    Board->>Board: 被弾カードを isOpen: true に更新
    Board->>Engine: isAllOpen(targetPlayer.cards)

    alt 被弾プレイヤーの伏せカードが 0 枚になった場合
        Engine-->>Board: true 返却
        Board->>Board: targetPlayer.isEliminated = true
        Board-->>Loser: 脱落アニメーション演出 (カード全開示・脱落表示)

        Board->>Board: 生存プレイヤー数をカウント<br/>activePlayers = players.filter(!p.isEliminated)

        alt 生存者数 === 1 (完全決着)
            Board->>Board: phase = 'GAME_OVER'
            Board->>Board: winner = activePlayers[0]
            Board-->>Winner: 完全勝利セレブレーション演出 (紙吹雪/Trophy表示)
            Board-->>Board: タイマー停止 ＆ リプレイ・再戦ボタン活性化
        else 生存者数 >= 2 (3〜4人対戦の継続)
            Note over Board: 残りの生存プレイヤー間で対戦継続
            Board->>Board: 手番継続または次の生存プレイヤーへ移行
        end
    end
```
