# ADR-0003: メタデータ・OGP・JSON-LD構造化データ・クローラー制御によるSEO対策の実装

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-21
- **承認日**: 2026-10-21
- **提案者**: フロントエンド＆SEO担当サブエージェント (`role:frontend/seo`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」において、検索エンジン（Google / Bing 等）での検索流入最大化、および SNS（X / LINE / Discord 等）でのシェア時のリッチカード表示を実現するため、包括的な SEO 対策が求められている（Issue #144）。
- 従来の `src/app/layout.tsx` には最小限の `title` と `description` のみが定義されており、OGP（Open Graph Protocol）、Twitter Card、Canonical URL、Schema.org 構造化データ（JSON-LD）、およびクローラー向けの `robots.txt`・`sitemap.xml`・Web App Manifest（`manifest.webmanifest`）が未整備であった。
- また、本システムは Next.js の静的エクスポート（`output: 'export'`）を採用しているため、ビルド時に静的ファイルとして確実に生成されるアーキテクチャとする必要がある。

---

## 2. 検討した選択肢 (Considered Options)
1. **選択肢 1: Next.js Metadata API ＆ `src/lib/seo.ts` 純粋関数モジュールによる一元管理** (採用案)
   - 概要:
     - SEO メタデータ生成ロジック（`getSiteUrl`, `buildMetadata`, `buildJsonLd`）を `src/lib/seo.ts` に純粋関数として切り出し、`src/app/layout.tsx`、`src/app/robots.ts`、`src/app/sitemap.ts`、`src/app/manifest.ts` から参照する。
     - 静的エクスポート（`output: 'export'`）に対応するため、各メタデータルートに `export const dynamic = 'force-static'` を指定する。
   - メリット:
     - 追加の外部ライブラリ不要（Next.js 標準機能のみで完結）で YAGNI 原則に合致。
     - 純粋関数として分離することで Vitest による単体テストが容易かつ高速。
     - 環境変数 `NEXT_PUBLIC_SITE_URL` によるデプロイ環境別のベース URL 切り替えと安全なフォールバックが可能。
   - デメリット・リスク:
     - 特になし（Next.js App Router のベストプラクティスに完全準拠）。

2. **選択肢 2: `next-seo` 等の外部サードパーティライブラリの導入** (不採用案)
   - 概要:
     - 外部パッケージをインストールしてメタデータタグを出力する。
   - 不採用の理由:
     - Next.js 14+ の App Router 標準 Metadata API で同等以上の機能が型安全に提供されており、外部依存を増やす必要がないため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1（Next.js Metadata API ＆ `src/lib/seo.ts` 純粋関数モジュールによる一元管理）** を採択する。
  - `src/lib/seo.ts` に URL 正規化関数 `getSiteUrl()`、Metadata 構築関数 `buildMetadata()`、および Schema.org（`WebApplication` + `VideoGame`）準拠の構造化データ生成関数 `buildJsonLd()` を実装する。
  - `src/app/layout.tsx` で `buildMetadata()` と `buildJsonLd()` を呼び出し、`<script type="application/ld+json">` を出力する。
  - `src/app/robots.ts`、`src/app/sitemap.ts`、`src/app/manifest.ts` を `dynamic = 'force-static'` 付きで作成し、静的ビルド時に `out/robots.txt`、`out/sitemap.xml`、`out/manifest.webmanifest` を自動生成する。
- **採択理由**:
  - ゼロ外部依存でバンドルサイズへの影響がなく、静的エクスポート（S3 + CloudFront 配信）と完全に親和し、単体テストによる品質保証が容易であるため。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - 検索エンジンに対するリッチリザルト対応（`WebApplication` / `VideoGame` の無料提供・2〜4人プレイ等の構造化情報）およびクローラビリティ（`robots.txt` / `sitemap.xml`）が向上する。
  - SNS 共有時に `/hero-banner.jpg` を用いた大型カード（`summary_large_image`）が表示され、クリック率・認知度が向上する。
  - モバイル端末でのホーム画面追加時に `manifest.webmanifest` と `/app-icon.jpg` が適用される。
- **ネガティブな影響 / 許容したトレードオフ**:
  - 本番ドメイン確定時には環境変数 `NEXT_PUBLIC_SITE_URL` の注入が必要（未設定時は安全に `https://algo-web.example.com` へフォールバック）。
- **セキュリティ・運用への影響**:
  - `getSiteUrl()` において `http:` / `https:` プロトコル検証を行い、不正なスキーム注入を防止する。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
人間ゲートキーパーの承認後、本ADRに基づき更新する設計書一覧：
- [x] `docs/design/backend/api-spec.md`: `3.9 SEO・構造化データ・メタデータ管理 (src/lib/seo.ts)` の仕様追記
- [x] `docs/design/frontend/screen-specs.md`: `5. SEO・OGP・JSON-LD構造化データ・クローラー制御仕様` の追記
- [x] 実装コード / 設定ファイル: `src/lib/seo.ts`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`, `src/lib/__tests__/seo.test.ts`
