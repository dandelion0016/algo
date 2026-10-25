# ADR-0006: Google Site Verification メタタグ設定および GA4 測定タグ注入基盤の実装

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-25
- **承認日**: 2026-10-25
- **提案者**: フロントエンド＆SEO担当サブエージェント (`role:frontend/seo`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」の本番ドメイン（`https://coda.puzzlecabin.jp`）運用および SEO・アクセス解析強化に伴い、以下2点の要件が発生した（Issue #152）：
  1. **Google Search Console 所有権確認**:
     - Google Search Console におけるドメイン/URLプレフィックス所有権確認のため、Google 提供の認証トークン（`google-site-verification` メタタグ）をHTMLヘッダーに配置する必要がある。
  2. **Google Analytics 4 (GA4) 測定タグ連携**:
     - 本番環境でのユーザー動向・対戦参加傾向・ページビューをプライバシーに配慮しつつ安全に計測するため、GA4 測定タグ（`gtag.js`）を注入する基盤を整備する必要がある。
- 本システムは Next.js App Router による静的エクスポート（`output: 'export'`）を採用しており、外部計測タグや検証トークンの注入において、以下のガバナンス・セキュリティ要件を満たす必要がある：
  - 未設定のローカル開発環境や CI テスト環境で不要なトラッキングリクエストが発生しないこと。
  - GA 測定ID（`NEXT_PUBLIC_GA_MEASUREMENT_ID`）の形式（`G-[A-Za-z0-9]+`）を安全に検証し、XSS等の不正なスクリプトインジェクションを防止すること。

---

## 2. 検討した選択肢 (Considered Options)
1. **選択肢 1: Next.js Metadata API の `verification` オプション ＆ 環境変数制御によるインライン `gtag.js` 注入** (採用案)
   - 概要:
     - Google Site Verification トークン（`LcDNa7KHW33-g7dMwMDkIBI5L3YQsrNxP-w-M8Qr8qw`）を `src/lib/seo.ts` 内の `buildMetadata` に `verification.google` として追加。
     - GA4 測定タグは `src/app/layout.tsx` において環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` を参照し、正規表現 `^G-[A-Za-z0-9]+$` に合致する場合のみ `gtag.js` スクリプトおよび初期化スニペットを条件付きレンダリングする。
     - GitHub Actions CD ワークフロー (`.github/workflows/deploy.yml`) で GitHub リポジトリ変数 `vars.NEXT_PUBLIC_GA_MEASUREMENT_ID` をビルド時に注入。
   - メリット:
     - Next.js 標準の Metadata API と完全準拠しており、追加パッケージ不要でバンドルサイズ増加ゼロ。
     - IDが設定されていない開発・テスト環境では完全にタグが出力されず、副作用やトラッキング汚染が発生しない。
     - 正規表現による厳格なバリデーションで不正入力・スクリプトインジェクションを防止。
   - デメリット・リスク:
     - 特になし。

2. **選択肢 2: `@next/third-parties/google` パッケージの導入** (不採用案)
   - 概要:
     - `@next/third-parties` ライブラリの `GoogleAnalytics` コンポーネントを使用する。
   - 不採用の理由:
     - 単一の GA4 計測スクリプトのために追加の外部依存ライブラリを導入することは YAGNI 原則に反し、依存関係の脆弱性リスクやパッケージ競合のリスクを増大させるため。標準の Next.js スクリプト出力で安全かつシンプルに実現可能。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `src/lib/seo.ts` の `buildMetadata()` に `verification: { google: 'LcDNa7KHW33-g7dMwMDkIBI5L3YQsrNxP-w-M8Qr8qw' }` を設定する。
  - `src/app/layout.tsx` で `NEXT_PUBLIC_GA_MEASUREMENT_ID` を取得・検証（`^G-[A-Za-z0-9]+$`）し、有効な場合のみ `gtag.js` を出力する。
  - `.github/workflows/deploy.yml` のビルド環境変数に `NEXT_PUBLIC_GA_MEASUREMENT_ID: ${{ vars.NEXT_PUBLIC_GA_MEASUREMENT_ID || '' }}` を追記する。
- **採択理由**:
  - 外部依存ゼロ、Next.js 静的エクスポートとの完全な親和性、開発・CI環境での安全性が担保されるため。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - Google Search Console でのサイト所有権確認が自動化され、検索パフォーマンスのモニタリングとインデックス登録リクエストが可能になる。
  - 本番環境で GitHub Actions の Repository Variables に `NEXT_PUBLIC_GA_MEASUREMENT_ID`（例: `G-XXXXXXXXXX`）を設定するだけで、ビルド時に自動で GA4 計測が有効化される。
  - ローカル開発環境や CI パイプラインではタグが注入されず、開発中のテストアクセスが本番アナリティクスに混入しない。
- **ネガティブな影響 / 許容したトレードオフ**:
  - 特になし（測定ID未設定時はDOMに一切スクリプトが出力されないためオーバーヘッドなし）。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
人間ゲートキーパーの承認後、本ADRに基づき更新する設計書一覧：
- [x] `docs/design/backend/api-spec.md`: `3.9 SEO・構造化データ・メタデータ管理` に Verification メタタグおよび GA4 測定タグ注入環境変数仕様を追記
- [x] `docs/design/frontend/screen-specs.md`: `5. SEO・OGP・JSON-LD構造化データ・クローラー制御仕様` に Google Site Verification メタタグ設定および GA4 測定タグ注入仕様を追記
- [x] 実装コード / 設定ファイル: `src/lib/seo.ts`, `src/app/layout.tsx`, `.github/workflows/deploy.yml`, `src/lib/__tests__/seo.test.ts`
