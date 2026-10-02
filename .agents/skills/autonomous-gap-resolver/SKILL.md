---
name: autonomous-gap-resolver
description: Phase 0-Bの設計書群に従い、Walking Skeletonのたたき台コードから未実装ギャップを自律特定・Issue起票・トピックブランチ実装・PR作成まで完走してシステムを仕上げるスキル
---

# 自律型設計書ギャップ解消 ＆ システム完成スキル (autonomous-gap-resolver)

本スキルは、**Phase 1（自律実装 ＆ システム完成フェーズ）** において、Phase 0-Bで策定された6領域の詳細設計書群（`docs/design/`）に基づき、Phase 0-Aで構築した初期基盤（Walking Skeleton）を完全なプロダクトへと自律的に仕上げるためのエンドツーエンド実行プロトコルです。

エージェント側で自律的に問題提起（設計書とのギャップ抽出）を行い、Issueを切り出し、トピックブランチで専門チームが自律実装とテストを行い、**人間はPRの承認（マージ）を行うだけ**でシステムが完成する状態を実現します。

---

## 1. ワークフロー概要

```text
【ステップ1: 課題発見・問題提起】
  `spec-gap-auditor` サブエージェントが docs/design/ と実装コードを照合
  未実装機能、未反映DBスキーマ、認可漏れ、運用機構の不足を自律抽出
      │
      ▼
【ステップ2: Issue自動起票】
  構造化Issueを自律作成（gh issue create または MCP）
  ラベル（domain, priority）、設計書リンク、DoDを明記
      │
      ▼
【ステップ3: トピックブランチ新設 ＆ 専門サブエージェント委任】
  git checkout -b feature/issue-<num>-<slug>
  担当サブエージェント（backend, frontend, db, security, sre-ops）を起動
  サブエージェントがブランチ上で実装 ＆ 単体テスト ＆ Maker-Checker
      │
      ▼
【ステップ4: 自動テスト ＆ 品質検査】
  自動テスト、リント、セキュリティスキャンを実行
  各領域のテスト結果（件数・合否）を収集
      │
      ▼
【ステップ5: テストサマリ付きPR作成 ＆ 人間ゲートキーパー通知】
  git push origin feature/issue-<num>-<slug>
  gh pr create（Closes #<num>、各チームテスト結果構造化テーブル明記）
      │
      ▼
【ステップ6: 人間によるPR確認・実機受入 ＆ mainマージ】
  人間はPR本文のテスト結果・画面キャプチャ・実機を確認してマージ承認
  未実装ギャップ・フィードバックが全て解消されるまで継続 ─> 最終検収（Gate 1）
```

---

## 2. 詳細実行プロトコル

### ステップ1: 設計書ギャップの自律監査（問題提起・Dual-Track）
1. `PROJECT_STATUS.md` を確認し、Phase 0-B（設計書FIX）およびPhase 0-C（環境整備・疎通確認）が完了していることを確認する。
2. `invoke_subagent` で `spec-gap-auditor` を呼び出し、以下の **Dual-Track（2系統）ギャップ監査** を実施する：
   - **Track A (機能ギャップ)**: `docs/design/` 配下の6領域設計書 vs `src/` 配下の現在の実装コード（未実装API、未反映DBカラム/RLS、未作成UI画面、未設定の認証認可・監査ログ等）。
   - **Track B (テスト妥当性ギャップ)**: `docs/design/` の仕様期待値 vs `__tests__/` 配下のテストコード期待値（設計書と不一致なステータスコードをテスト側で追認していないか、仕様書にある条件のテストが欠落していないか、恒等写像で通る骨抜きテストがないか）。
3. 依存関係（DB → バックエンド → フロントエンド → セキュリティ/SRE）に基づき、次に着手すべき最優先の課題を特定する。

### ステップ2: GitHub Issueの自動起票
最優先課題について、以下の構造化フォーマットでGitHub Issueを自動起票する：

```bash
gh issue create \
  --title "[<領域名>] <簡潔な課題タイトル>" \
  --body "## 1. 課題概要・背景
Phase 0-B設計書と実装コード（およびテスト妥当性）のギャップ監査により検出。

## 2. 対象設計書
- [設計書リンク](file:///docs/design/<domain>/<file>.md)

## 3. 実装要件 ＆ 変更方針
- 設計書に定義された仕様に準拠するよう実装を更新する。

## 4. 完了条件 (Definition of Done)
- [ ] 設計書の全仕様を満たすコード実装
- [ ] ユニットテスト / 結合テストの追加・PASS（テスト期待値の改ざん禁止、ミューテーション耐性担保）
- [ ] UIコンポーネントテストのJSDOM実機操作（Testing Library）検証
- [ ] リント・フォーマット検証のPASS

## 5. 担当チーム
- \`role:<domain>\` (サブエージェント: \`<domain>-agent\`)" \
  --label "<domain>,phase1-gap"
```

### ステップ3: トピックブランチ新設 ＆ 専門サブエージェント委任（自律実装）
1. 最新の `main` からトピックブランチを作成する（※ `main` への直接コミットは禁止）：
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b feature/issue-<番号>-<概要スラッグ>
   ```
2. 担当サブエージェント（`db-agent`, `backend-agent`, `frontend-agent`, `infra-agent`, `security-auditor`, `sre-ops-agent`）を `invoke_subagent` で呼び出し、実装とテストを委任する。
3. 実装担当以外のサブエージェント（`test-integrity-auditor` / セキュリティ監査担当）によるMaker-Checker自律レビューを実施。

### ステップ4: 自動テスト ＆ テスト完全性（Test Integrity）検査
Antigravity側で全テストを実行し、品質およびアサーションの厳密さを検証する：
```powershell
npm test
npm run lint
```
> [!CAUTION]
> **テスト完全性（Test Integrity）の鉄則**:
> 1. **テスト期待値の書き換え厳禁**: テスト失敗時に、実装の返り値に合わせてテスト側の期待値を書き換えてパスさせること（偽装追認）は厳禁とする。必ず実装側を設計書通りに修正すること。
> 2. **自作自演テストの禁止**: テストコード内にダミーハンドラを自作してテストすることや、テストコード内で変数算数を行って合格とみなす行為を厳禁とする。
> 3. **UIテスト基準**: UIコンポーネントテストは JSDOM + `@testing-library/react` を用い、実際のDOMイベント（クリック・キー入力）と状態遷移を検証すること。
> 4. **ミューテーション耐性**: 何もしない恒等写像（例: `return [...deck]`）で通る甘いアサーションを排除し、境界値・異常値を確実に検証すること。

### ステップ5: Pull Requestの作成 ＆ 人間ゲートキーパー通知
すべてのテストが成功後、リモートブランチへプッシュし、PRを作成する：

```bash
git push -u origin feature/issue-<番号>-<概要スラッグ>
```

PR本文には以下の**「各専門チーム自動テスト結果 ＆ テスト完全性サマリ」**を必ず含めること：

```markdown
## 概要
Closes #<Issue番号>
Phase 0-B設計書（docs/design/<domain>/...）に基づき、たたき台コードから未実装ギャップを自律解消しました。

## 変更内容サマリ
- ...

## 専門チーム自動テスト検証結果サマリ
| 専門領域 | テスト種別 | 実行件数 | 合否ステータス | テスト完全性（検証観点・アサーション深度） |
| :--- | :--- | :--- | :--- | :--- |
| **データベース** | RLS・マイグレーション | X件 | ✅ ALL PASS | テナント境界分離、外部キー整合性、SQLインジェクション耐性 |
| **バックエンド** | API単体・結合テスト | Y件 | ✅ ALL PASS | RFC 7807設計準拠、恒等写像排除、境界値・異常値検証 |
| **フロントエンド** | JSDOM / Testing Library | Z件 | ✅ ALL PASS | ユーザー操作（クリック/キー入力）による状態遷移、DOM非漏洩 |
| **セキュリティ** | 権限認可・疑似攻撃検査 | W件 | ✅ ALL PASS | 不正テナントID遮断、監査ログ出力確認、PII/IPv6マスキング |
| **SRE・運用** | ヘルスチェック・メトリクス | V件 | ✅ ALL PASS | メトリクス計測、500系エラー集約確認、自己修復冪等性 |

## 📸 受入確認スナップショット（Visual Evidence）
E2Eテストで採取された画面スナップショットをインラインレンダリングで提示します（Raw GitHub URL使用）。

### 📱 レスポンシブ比較 (PC vs スマホ)
| デスクトップ (PC: 1280px) | モバイル (スマホ: 375px) |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/14-responsive-pc.png" width="450" alt="PC対戦盤面" /> | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/16-responsive-mobile.png" width="220" alt="モバイル対戦盤面" /> |
| **PC表示**: 相手手札・山札・自手札がワイドに整列 | **スマホ表示**: 375px幅でカード欠けなく最適化 |

<details>
<summary><b>🔍 全スナップショット・インラインギャラリー（クリックで展開）</b></summary>

| スナップショット | プレビュー画像 | 検証シナリオ |
| :--- | :---: | :--- |
| `01-setup-screen.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/01-setup-screen.png" width="260" alt="設定画面" /> | ゲーム初期設定画面 |
| `02-game-board-init.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/02-game-board-init.png" width="260" alt="盤面初期化" /> | 対戦開始直後の盤面配置 |
| `03-rule-guide-modal.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/03-rule-guide-modal.png" width="260" alt="ルールモーダル" /> | 公式ルール解説モーダル |
| `04-player-drawn-card.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/04-player-drawn-card.png" width="260" alt="ドローカード" /> | ドローカード表示 |
| `05-attack-modal-opened.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/05-attack-modal-opened.png" width="260" alt="アタックモーダル" /> | アタック数字推理モーダル |
| `06-attack-result.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/06-attack-result.png" width="260" alt="アタック結果" /> | アタック判定結果・ログ |
| `13-hitl-confirm-modal.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/13-hitl-confirm-modal.png" width="260" alt="HITLモーダル" /> | HITL確認モーダル |
| `17-mobile-setup-fit.png` | <img src="https://raw.githubusercontent.com/<owner>/<repo>/<branch>/e2e/screenshots/17-mobile-setup-fit.png" width="200" alt="モバイル設定" /> | モバイル設定画面フィット |

</details>

## 人間ゲートキーパーへのお願い
上記テスト結果および変更差分をご確認の上、Approve ＆ マージをお願いいたします。
マージ完了後、次の設計書ギャップ解消タスクへ自律移行します。
```

### ステップ6: 人間によるPR確認・実機受入 ＆ 次のサイクルへ
1. 人間がPR本文のテスト結果・画面キャプチャを確認し、必要に応じて実機を操作してマージまたはフィードバックを提示する。
2. 設計乖離や新方針が発生した場合は、`docs/adr/` に ADR を起票して承認・設計書追従を行う。
3. マージ完了後、[GitHub Projects ボード](https://github.com/users/dandelion0016/projects/1) のステータスを自律同期する（**人間ゲートキーパーへの承認伺いは不要**）。
4. 設計書ギャップがすべて解消され、人間の実機受入が完了するまで、ステップ1に戻り自律サイクルを継続する。
5. 全ての設計書項目および実機フィードバックが解消されたら、人間へ**「全要件充足・システム完成報告」**を行い、**本番リリース・プロジェクト完了承認（Gate 1）** を要請する。
