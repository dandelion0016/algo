# ADR-0007: Google AdSense パブリッシャー ID (ca-pub-3337160908225388) の本番反映および ads.txt 更新

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-25
- **承認日**: 2026-10-25
- **提案者**: フロントエンド＆マネタイズ担当サブエージェント (`role:frontend/adsense`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」の本番ドメイン（`https://coda.puzzlecabin.jp`）における Google AdSense 広告配信およびサイト審査承認プロセスに伴い、正式なサイト運営者・パブリッシャー ID（`pub-3337160908225388` / `ca-pub-3337160908225388`）が確定した（Issue #154）。
- Google AdSense 審査通過および正規広告配信には以下の2点が必須となる：
  1. **`ads.txt` のパブリッシャー ID 整合**:
     - サイトルート直下の `https://coda.puzzlecabin.jp/ads.txt` にて、認定デジタル販売者（Authorized Digital Sellers）レコードとして `google.com, pub-3337160908225388, DIRECT, f08c47fec0942fa0` を公開すること。
  2. **審査・広告配信スクリプトの確実なレンダリング**:
     - 静的エクスポート（`npm run build`）された全HTMLの `<head>` に、正式なパブリッシャー ID を含む AdSense スクリプトタグ（`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3337160908225388" crossOrigin="anonymous" />`）が出力されること。
- GitHub Actions CI/CD パイプラインにおいて、リポジトリ変数（`vars.NEXT_PUBLIC_ADSENSE_CLIENT_ID`）が未設定またはブランクである場合でも、ビルド時にフォールバックとして確実に正式 ID が適用され、デプロイ後の審査・配信が滞らない安全な仕組みが必要である。

---

## 2. 検討した選択肢 (Considered Options)

1. **選択肢 1: `DEFAULT_ADSENSE_CLIENT_ID` 定義によるフォールバック機構 ＆ `public/ads.txt` 本番更新 ＆ CI/CD ワークフロー連動** (採用案)
   - 概要:
     - `src/lib/adsense.ts` に `DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-3337160908225388'` を定義。
     - `getAdSenseConfig()` において、環境変数や引数が未設定・空文字の場合に `DEFAULT_ADSENSE_CLIENT_ID` を安全にフォールバック採用。
     - `public/ads.txt` をダミーID（`pub-0000000000000000`）から正式 ID（`pub-3337160908225388`）へ更新。
     - `.github/workflows/deploy.yml` の `NEXT_PUBLIC_ADSENSE_CLIENT_ID` のフォールバック値に `'ca-pub-3337160908225388'` を設定。
   - メリット:
     - リポジトリ変数の設定状況に関わらず、静的エクスポートビルド時に確実に AdSense 審査用タグが出力される。
     - `public/ads.txt` と `src/lib/adsense.ts` のパブリッシャー ID が完全に一致し、AdSense クローラーの認証エラー（収益損失警告）を未然に防止。
     - 将来的に別IDへ差し替える場合も環境変数による上書きが引き続き可能。
   - デメリット・リスク:
     - 特になし。

2. **選択肢 2: GitHub Repository Variables のみで管理し、コード側は空のまま維持** (不採用案)
   - 概要:
     - コード側のフォールバックは実装せず、GitHub リポジトリ設定のみに依存する。
   - 不採用の理由:
     - リポジトリ変数の未設定・ブランチ設定の不備時に AdSense タグが欠落したままデプロイされ、Google 側の審査保留やクローラー再巡回待ちによる大幅な遅延リスクが生じるため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `public/ads.txt` を正式レコードに更新：
    ```text
    # Google AdSense Authorized Digital Sellers
    google.com, pub-3337160908225388, DIRECT, f08c47fec0942fa0
    ```
  - `src/lib/adsense.ts` に `DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-3337160908225388'` を定義し、`getAdSenseConfig()` でのフォールバック処理を実装。
  - `.github/workflows/deploy.yml` に `NEXT_PUBLIC_ADSENSE_CLIENT_ID: ${{ vars.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-3337160908225388' }}` を反映。
  - 設計書（`docs/design/backend/api-spec.md` および `docs/design/frontend/screen-specs.md`）に最新仕様を同期追記。
- **採択理由**:
  - 本番ドメイン審査の確実な通過、ads.txt の正規認証、および多層防御（CI/CD変数＋コード側定数フォールバック）による堅牢性を両立するため。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - `https://coda.puzzlecabin.jp/ads.txt` で Google AdSense の正式な運営者 ID が公開され、クローラーによる所有権・販売者確認が自動成立する。
  - Next.js の静的エクスポート時に `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3337160908225388" crossOrigin="anonymous" />` が全ページに出力され、審査通過および広告配信が即時可能となる。
- **ネガティブな影響・注意点**:
  - ローカル開発時やテスト時も `DEFAULT_ADSENSE_CLIENT_ID` が有効になるため、無効状態のテストを行う際は明示的に `clientId: 'invalid'` などの無効値を渡す必要がある（テスト整備済み）。

---

## 5. 関連する設計書・ファイル
- `docs/adr/0007-google-adsense-publisher-integration.md` (本書)
- `docs/adr/README.md`
- `docs/design/backend/api-spec.md`
- `docs/design/frontend/screen-specs.md`
- `public/ads.txt`
- `src/lib/adsense.ts`
- `src/lib/__tests__/adsense.test.ts`
- `.github/workflows/deploy.yml`
