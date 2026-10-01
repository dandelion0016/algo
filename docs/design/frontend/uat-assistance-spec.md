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

Phase 1 の各トピックブランチPull Request作成時、CI実行結果（Step Summary / PRコメント）、および `PROJECT_STATUS.md` に以下の形式で視覚的エビデンス（インライン画像）を自動添付・提示します。

GitHub上での視覚的確認を最大化するため、単なるパス文字列ではなく、`https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/<file>.png` を用いた HTML `<img>` タグによるインラインレンダリング、PC/モバイル横並びレスポンシブ比較テーブル、および折りたたみギャラリー（`<details>`）を標準フォーマットとして定義します。

### 4.1 レポートフォーマット標準テンプレート

```markdown
### 📱 実機UAT自動化アシスト・事前検証サマリ（アルゴWeb対戦）

#### 📸 レスポンシブ視覚的エビデンス（PC vs モバイル比較）

| デスクトップ (PC: 1280px) | モバイル (スマホ: 375px) |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/14-responsive-pc.png" width="480" alt="PC対戦盤面" /> | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/16-responsive-mobile.png" width="230" alt="モバイル対戦盤面" /> |
| **PC表示**: 相手手札・山札・自手札がワイドに整列 | **スマホ表示**: 375px幅でカード欠けなく最適化 |

#### 📋 シナリオ検証ステータス一覧

| No | 検証シナリオ | 実行種別 | 結果 | 視覚的エビデンス (プレビュー) | 人間確認推奨ポイント |
| :---: | :--- | :---: | :---: | :--- | :--- |
| 1 | 初期セットアップ ＆ 2/3/4人開始 | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/01-setup-screen.png" width="160" alt="セットアップ" /><br>`01-setup-screen.png` | 人数変更時の手札枚数（4/3/2枚）の並び |
| 2 | 対戦盤面初期化 | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/02-game-board-init.png" width="160" alt="盤面初期化" /><br>`02-game-board-init.png` | カード並び順（昇順・同数黒左）の初期配置 |
| 3 | ルール解説モーダル開閉 | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/03-rule-guide-modal.png" width="160" alt="ルールモーダル" /><br>`03-rule-guide-modal.png` | 4つのルールの可読性と閉じる動作 |
| 4 | ドロー ➔ アタック推理モーダル | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/05-attack-modal-opened.png" width="160" alt="アタック推理" /><br>`05-attack-modal-opened.png` | 確認済み数字のグレーアウト表示感 |
| 5 | アタック判定・結果フィードバック | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/06-attack-result.png" width="160" alt="アタック結果" /><br>`06-attack-result.png` | 的中/ハズレ演出とログ記録 |
| 6 | HITL操作ガード（再戦・設定戻り） | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/13-hitl-confirm-modal.png" width="160" alt="HITLガード" /><br>`13-hitl-confirm-modal.png` | モーダル表示中のタイマー停止動作 |
| 7 | モバイル初期設定画面フィット | Playwright | ✅ PASS | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/17-mobile-setup-fit.png" width="160" alt="モバイル設定" /><br>`17-mobile-setup-fit.png` | スマホ画面での設定ボタン押しやすさ |

<details>
<summary><b>🔍 全スナップショット・インラインギャラリー（クリックで展開）</b></summary>

| ファイル名 | プレビュー画像 | 説明 |
| :--- | :--- | :--- |
| `01-setup-screen.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/01-setup-screen.png" width="300" /> | ゲーム初期設定画面 |
| `02-game-board-init.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/02-game-board-init.png" width="300" /> | 対戦開始直後の盤面（プレイヤー手番） |
| `03-rule-guide-modal.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/03-rule-guide-modal.png" width="300" /> | 公式ルール解説モーダル |
| `04-player-drawn-card.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/04-player-drawn-card.png" width="300" /> | プレイヤードローカード表示 |
| `05-attack-modal-opened.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/05-attack-modal-opened.png" width="300" /> | アタック数字推理モーダル（0〜11選択） |
| `06-attack-result.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/06-attack-result.png" width="300" /> | アタック判定結果とログ反映 |
| `13-hitl-confirm-modal.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/13-hitl-confirm-modal.png" width="300" /> | 途中離脱防止HITL確認モーダル |
| `14-responsive-pc.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/14-responsive-pc.png" width="300" /> | PCデスクトップ全体レイアウト |
| `16-responsive-mobile.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/16-responsive-mobile.png" width="200" /> | モバイル（375px）全体レイアウト |
| `17-mobile-setup-fit.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/17-mobile-setup-fit.png" width="200" /> | モバイル設定画面フィット |

</details>

> **💡 人間ゲートキーパー向け実機確認ガイド**:
> 全シナリオの自動E2E検証を 100% クリアしています。人間による実機検証では、インライン画像をご確認いただいた上で、特に気になるピンポイントの操作感（モーダル開閉、カード選択、タイマー等）のみ実機でご確認ください。
```

---

## 5. 担当ロールと実行責任

- **フロントエンド担当エージェント (`role:frontend/dev`, `role:frontend/rev`)**:
  - Playwright テストシナリオの策定、データ属性（`data-testid`）の付与、画面スナップショットの採取・保守。
- **システム運用・SRE担当 (`role:ops`)**:
  - CIパイプライン（GitHub Actions）内でのPlaywrightヘッドレス自動実行およびArtifacts保存。
- **管理者・アーキテクト (`role:manager`, `role:architect`)**:
  - 人間へのUATサマリ提示、Gate 1（継続的受入）判定のリード。
