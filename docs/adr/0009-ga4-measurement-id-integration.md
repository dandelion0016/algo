# ADR-0009: GA4 測定ID（G-38N6PN8RE6）の本番反映およびゲームサイト（coda）・ポータル（portal）へのデフォルト適用

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-26
- **承認日**: 2026-10-26
- **提案者**: フロントエンド＆アナリティクス担当サブエージェント (`role:frontend/analytics`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- ADR-0006 において、Google Analytics 4（GA4）の測定タグ注入基盤が整備され、環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` を通じた動的注入アーキテクチャが定義された。
- 続いて親ドメイン（`puzzlecabin.jp`）ポータルLP（`portal/index.html`）が整備された（ADR-0008）。
- 正式な Google Analytics 4 の測定ID `G-38N6PN8RE6` が発行されたため、以下の要件が発生した（Issue #158）：
  1. ゲームサイト（`coda.puzzlecabin.jp`）の `src/app/layout.tsx` において、`NEXT_PUBLIC_GA_MEASUREMENT_ID` が環境変数未指定の場合でもデフォルト値として `G-38N6PN8RE6` が適用されるようにする。
  2. 親ドメイン総合ポータル（`portal/index.html`）の `<head>` 内に Google tag (`gtag.js`) スクリプトを直接配置し、ポータルとゲームサイトの両方で統一的なアクセス解析・利用動向計測を行えるようにする。
  3. CI/CD デプロイパイプライン（`.github/workflows/deploy.yml`）においても、GitHub リポジトリ変数未設定時のフォールバックとして `G-38N6PN8RE6` をデフォルト注入する。

---

## 2. 検討した選択肢 (Considered Options)

### 選択肢 1: デフォルト定数フォールバック ＆ 静的タグ配置 (採用案)
- **概要**:
  - `src/app/layout.tsx` に `DEFAULT_GA_MEASUREMENT_ID = 'G-38N6PN8RE6'` を定義し、環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 未設定時は自動的にデフォルト測定IDを採用。不正な形式のインジェクションを正規表現 `^G-[A-Za-z0-9]+$` で引き続き防止。
  - `portal/index.html` に Google tag (`gtag.js`) スクリプトを配置。
  - `.github/workflows/deploy.yml` のビルド時引数フォールバックを `'G-38N6PN8RE6'` に設定。
- **メリット**:
  - 静的エクスポート成果物としてデフォルトで GA4 タグが出力されるため、環境変数設定漏れによる計測欠落を恒久的に防止。
  - ポータルおよび coda サブドメインの双方で同一の測定ストリームによる横断計測が可能。
  - 外部依存ライブラリの追加がなく、パフォーマンス・バンドルサイズへの影響ゼロ。
- **デメリット・トレードオフ**:
  - 特になし（ローカル検証時等でも GA4 スクリプトが出力されるが、測定ID形式検証により安全性は担保される）。

### 選択肢 2: 環境変数のみに依存しコード上のデフォルト値を持たない方式 (不採用案)
- **概要**:
  - ADR-0006 当初の通り、環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` が空の場合はタグを出力しない方式を維持する。
- **不採用の理由**:
  - 静的ポータル `portal/index.html` は Next.js のビルドプロセス外で配信される静的HTMLであるため環境変数による動的差し替えが行えず、またリポジトリ変数の未指定時に本番ビルドで計測が漏れる運用リスクがあるため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `src/app/layout.tsx`: `const DEFAULT_GA_MEASUREMENT_ID = 'G-38N6PN8RE6'` を定義し、`process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID` を検証・適用する。
  - `portal/index.html`: `<head>` 内のメタタグ直下に `gtag.js` スクリプトおよび初期化スニペットを配置する。
  - `.github/workflows/deploy.yml`: `NEXT_PUBLIC_GA_MEASUREMENT_ID: ${{ vars.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-38N6PN8RE6' }}` に更新する。
- **採択理由**:
  - 本番運用環境における計測の確実性とポータル・ゲームサイト間の統一管理を実現するため。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - `https://puzzlecabin.jp` および `https://coda.puzzlecabin.jp` 双方へのアクセスが GA4 `G-38N6PN8RE6` にて集約・可視化される。
  - ビルド成果物に常に有効なタグが含まれ、デプロイ設定ミスによるトラッキング欠損を防止。
- **ネガティブな影響 / 許容したトレードオフ**:
  - 開発ビルド成果物にもデフォルトでタグが出力されるが、クライアントサイドでの動作確認・検証において仕様通りであるため許容。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
人間ゲートキーパーの承認後、本ADRに基づき更新する設計書一覧：
- [x] `docs/design/backend/api-spec.md`: GA4 測定IDのデフォルト仕様（`G-38N6PN8RE6`）を追記
- [x] `docs/design/frontend/screen-specs.md`: GA4 測定IDのデフォルト仕様（`G-38N6PN8RE6`）を追記
- [x] 実装コード / 設定ファイル: `src/app/layout.tsx`, `portal/index.html`, `.github/workflows/deploy.yml`
