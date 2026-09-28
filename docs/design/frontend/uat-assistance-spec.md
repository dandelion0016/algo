# 実機UAT自動化アシスト仕様書 (UAT Assistance Spec): アルゴ（algo）Web対戦システム

本ドキュメントは、**Phase 1（自律実装 ＆ 継続的受入・仕上げ）** において、人間ゲートキーパーの検証負荷（思考戦の動作確認や手動操作の手間）を極小化するため、エージェントチームが自律的に実行・提供する**UAT自動化アシストプロトコル（Playwright E2E ＆ 視覚的エビデンス生成）**を定義します。

---

## 1. 目的と提供価値

1. **人間の目視受入の迅速化**:
   - 人間が一から手作業ですべてのターンをプレイ確認するのではなく、エージェントが**E2Eテストシナリオ、画面キャプチャ（スナップショット）、実行結果レポート**を事前生成してPRに提示。
   - 人間は「エビデンス画像・テスト結果を眺めて受入判断」し、「気になったピンポイントの部分（タップ感やアニメーション等）のみ実機操作」に専念できる。
2. **アルゴの厳格なゲームルール整合性の機械的保証**:
   - カード並び順（昇順・同数黒左）、初期手札枚数、的中/ハズレ判定、時間切れペナルティ、CPU思考の自律完走をPlaywrightで全自動検証し、リグレッションをゼロにする。

---

## 2. Playwright E2E テストシナリオ定義 (`tests/e2e/algo-game.spec.ts`)

### 2.1 テストシナリオマトリクス

| シナリオID | シナリオ名 | 主な検証内容 | 視覚的エビデンス (キャプチャ) | 合否判定基準 |
| :--- | :--- | :--- | :--- | :--- |
| `E2E-001` | 初期セットアップ ＆ 対戦開始 | 人数（2/3/4人）、難易度、持ち時間を選択し盤面へ遷移 | `01-setup-screen.png`<br>`02-game-board-init.png` | 選択通りの初期手札枚数（2人=4枚, 3人=3枚, 4人=2枚）が昇順整列されて表示されること |
| `E2E-002` | ルール解説モーダル開閉 | セットアップおよび盤面から「ルール」ボタン押下 | `03-rule-guide-modal.png` | 4つの公式ルール（並び順、枚数、手番、勝利条件）が正常にオーバーレイ表示され、閉じること |
| `E2E-003` | プレイヤードロー ＆ アタックモーダル | 中央の山札をクリックしてドロー、相手の伏せカード選択 | `04-player-drawn-card.png`<br>`05-attack-modal-opened.png` | 引いたカードが表示され、相手伏せカード選択で0〜11数字選択モーダルが開くこと |
| `E2E-004` | アタック的中 ＆ ステイ分岐 | 正解の数字を選択してアタック実行 | `06-attack-hit-banner.png`<br>`07-player-stayed.png` | 相手カードがOPENとなり、「続けてアタック」と「ステイ」の選択肢が出現。ステイで伏せて手札追加されること |
| `E2E-005` | アタックハズレ ＆ オープンペナルティ | 不正解の数字を選択してアタック実行 | `08-attack-miss-penalty.png` | 引いたカードが表向き（OPEN）で自分の手札に加わり、対戦ログに記録され手番がCPUへ移ること |
| `E2E-006` | 持ち時間タイマー ＆ 時間切れ強制オープン | 15秒/30秒タイマーの減算とタイムアウト | `09-timer-warning-pulse.png`<br>`10-timeout-forced-open.png` | 残り5秒で赤色警告パルス。0秒到達で引いたカードが強制オープンされ手番終了となること |
| `E2E-007` | CPU自律思考 ＆ 手番進行 | プレイヤー手番終了後のCPU自律思考とアタック | `11-cpu-thinking-status.png`<br>`12-cpu-attack-result.png` | CPUが自律的にドロー・思考・アタックを実行し、対戦ログへ結果がリアルタイム反映されること |
| `E2E-008` | HITL操作ガード（再戦/設定戻り） | 進行中盤面での「再戦」「設定」ボタン押下 | `13-hitl-confirm-modal.png` | 確認モーダルが表示され、タイマーが一時停止し、キャンセルで再開、承認でリセットされること |
| `E2E-009` | マルチデバイス・レスポンシブ検証 | PC (1280px), タブレット (768px), モバイル (375px) | `14-responsive-pc.png`<br>`15-responsive-tablet.png`<br>`16-responsive-mobile.png` | カード文字の欠けがなく、横スクロール破綻せず、主要ボタンがタップ可能であること |

---

## 3. 視覚的エビデンス（画面キャプチャ・録画）仕様

### 3.1 ディレクトリ構成
```text
tests/
└── e2e/
    ├── algo-game.spec.ts          # Playwright テストスクリプト
    ├── uat-reporter.ts            # Markdownレポート生成プラグイン
    └── screenshots/               # 自動保存先
        ├── 01-setup-screen.png
        ├── 02-game-board-init.png
        ├── 04-player-drawn-card.png
        ├── 05-attack-modal-opened.png
        ├── 06-attack-hit-banner.png
        ├── 08-attack-miss-penalty.png
        ├── 09-timer-warning-pulse.png
        ├── 13-hitl-confirm-modal.png
        ├── 14-responsive-pc.png
        ├── 15-responsive-tablet.png
        └── 16-responsive-mobile.png
```

### 3.2 キャプチャ生成コードスニペット例
```typescript
// Playwright でのフルページおよび要素スナップショット
test('プレイヤードローとアタックモーダルの検証', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("対戦を開始する！")');
  await page.waitForSelector('text=あなたのターン');

  // 山札をクリックしてドロー
  await page.click('text=山札');
  await page.waitForSelector('text=引いたカード');
  await page.screenshot({ path: 'tests/e2e/screenshots/04-player-drawn-card.png' });

  // 相手の最初の伏せカードをクリック
  await page.click('[data-testid="opponent-card-0"]');
  await page.waitForSelector('text=アタック（数字の推理）');
  await page.screenshot({ path: 'tests/e2e/screenshots/05-attack-modal-opened.png' });
});
```

---

## 4. 人間ゲートキーパー向け UAT受入サマリレポート形式

Phase 1 の各トピックブランチPull Request作成時、および `PROJECT_STATUS.md` に以下の形式でエビデンスを自動添付します。

```markdown
### 📱 実機UAT自動化アシスト・事前検証サマリ（アルゴWeb対戦）

| No | 検証シナリオ | 実行種別 | 結果 | 視覚的エビデンス | 人間確認推奨ポイント |
| :---: | :--- | :---: | :---: | :--- | :--- |
| 1 | 初期セットアップ ＆ 2/3/4人開始 | Playwright | ✅ PASS | `screenshots/02-game-board-init.png` | 人数変更時の手札枚数（4/3/2枚）の並び |
| 2 | ルール解説モーダル開閉 | Playwright | ✅ PASS | `screenshots/03-rule-guide-modal.png` | 4つのルールの可読性と閉じる動作 |
| 3 | ドロー ➔ アタック推理モーダル | Playwright | ✅ PASS | `screenshots/05-attack-modal-opened.png` | 確認済み数字のグレーアウト表示感 |
| 4 | アタック的中 ＆ ステイ分岐 | Playwright | ✅ PASS | `screenshots/06-attack-hit-banner.png` | 的中バナー演出と継続/ステイの選択 |
| 5 | アタックハズレ ＆ オープンペナルティ | Playwright | ✅ PASS | `screenshots/08-attack-miss-penalty.png` | ドローカードがOPENで手札に入るアニメ |
| 6 | 持ち時間タイマー ＆ 時間切れ強制 | Playwright | ✅ PASS | `screenshots/10-timeout-forced-open.png` | 5秒前の赤パルス演出と時間切れ自動交代 |
| 7 | HITL操作ガード（再戦・設定戻り） | Playwright | ✅ PASS | `screenshots/13-hitl-confirm-modal.png` | モーダル表示中のタイマー停止動作 |
| 8 | マルチデバイス・レスポンシブ | Playwright | ✅ PASS | `screenshots/16-responsive-mobile.png` | スマホ幅（375px）でのカード視認性 |

> **💡 人間ゲートキーパー向け実機確認ガイド**:
> 全8シナリオの自動E2E検証を 100% クリアしています。人間による実機検証では、特に **「No.3 の数字推理モーダルの操作感」** および **「No.6 の持ち時間タイマーのカウントダウン演出」** を重点的にご確認ください。
```

---

## 5. 担当ロールと実行責任

- **フロントエンド担当エージェント (`role:frontend/dev`, `role:frontend/rev`)**:
  - Playwright テストシナリオの策定、データ属性（`data-testid`）の付与、画面スナップショットの採取・保守。
- **システム運用・SRE担当 (`role:ops`)**:
  - CIパイプライン（GitHub Actions）内でのPlaywrightヘッドレス自動実行およびArtifacts保存。
- **管理者・アーキテクト (`role:manager`, `role:architect`)**:
  - 人間へのUATサマリ提示、Gate 1（継続的受入）判定のリード。
