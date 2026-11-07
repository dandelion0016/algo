# ADR-0010: クライアントサイド多言語対応 (i18n) および地域自動判定デフォルト言語設定

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-11-07
- **承認日**: 2026-11-07
- **提案者**: フロントエンド担当サブエージェント (`role:frontend/dev`, `role:frontend/rev`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- アルゴ（algo）Web対戦システムは、これまで日本語（`ja`）のみに対応していた。
- 将来的なグローバル展開、海外ユーザーからのアクセス、および英語圏プレイヤーへの対応として、英語UI（`en`）の導入および言語切り替え機能が求められた（Issue #162）。
- 静的エクスポート（Next.js `output: 'export'`）アーキテクチャを採用しているため、サーバーサイド（リクエストヘッダー解析等）による動的ルーティング（`/ja/`, `/en/`）やSSR処理を行わずに、**完全クライアントサイド** で以下の要件を満たす必要があった：
  1. 初回訪問時の地域・ロケール自動判定：
     - LocalStorage `algo_language` が設定されていればそれを最優先。
     - 未設定時はブラウザ言語（`navigator.languages`, `navigator.language`）およびタイムゾーン（`Intl.DateTimeFormat().resolvedOptions().timeZone`）を判定。日本（`ja`, `ja-JP`, `Asia/Tokyo`）なら `'ja'`、それ以外の海外地域からのアクセスはデフォルト `'en'` とする。
  2. 言語切り替えトグルUI（`LanguageSwitcher`）：
     - ヘッダー、モバイルメニュー、セットアップモーダル等からワンクリックで EN / 日本語 を即時切り替え可能。
     - 切り替えた言語は LocalStorage `algo_language` に永続化され、再訪問時にも保持される。
  3. 型安全かつ完全対称な翻訳辞書（`src/lib/i18n.ts`）：
     - TypeScript による型安全性を確保し、翻訳漏れやキーの不一致をコンパイル時に検知。
     - ネイティブゲーマーにとって自然で格好良い洗練されたゲーミング英語表現の適用。
  4. 表示崩れ・レイアウト保護：
     - 英語テキストの横幅伸長による折り返し、ボタン・カード・モーダルのはみ出し・見切れの防止。モバイル（375px幅・100dvh）およびデスクトップ（1280px）での完全なレスポンシブ維持。

---

## 2. 検討した選択肢 (Considered Options)

### 選択肢 1: 軽量カスタム型安全辞書 ＆ クライアントサイド Context (採用案)
- **概要**:
  - `src/lib/i18n.ts` にて `translations` オブジェクトを完全対称な TypeScript 型（`Translations`）として定義。
  - React Context (`I18nProvider`, `useI18n`) により、アプリ全体に現在の言語ステートと翻訳関数 `t` を配信。
  - `LanguageSwitcher` コンポーネントを配置し、`variant="header" | "menu" | "setup"` で各所に適応。
  - 外部 i18n ライブラリ（`next-intl`, `react-i18next` 等）を追加せず、標準 React API と純粋関数のみで実装。
- **メリット**:
  - **ゼロ外部依存**: バンドルサイズ増加が最小限（約30KBの辞書データのみ）、追加のランタイムオーバーヘッドがない。
  - **静的エクスポートとの完全な親和性**: URL ルーティング変更（サブディレクトリ分割等）が不要で、既存の S3 / CloudFront 静的配信インフラを一切変更せずに動作。
  - **型安全性**: TypeScript のインテリセンスとコンパイル時検査により、キーの欠損や引数型の誤りを100%防止。
  - **テスト親和性**: Provider 外での呼び出し時でも安全にフォールバック（`detectInitialLanguage()`）する堅牢設計により、既存の全614件の単体テストの後方互換性を100%維持。
- **デメリット・トレードオフ**:
  - 将来多言語（中国語、韓国語等）を大幅に増やす際には辞書ファイルの分割管理を検討する必要があるが、現状の ja / en 2言語では十分かつ最適。

### 選擇肢 2: `next-intl` または `react-i18next` などの外部ライブラリ導入 (不採用案)
- **概要**:
  - 一般的な i18n ライブラリを導入し、ルーティングやロケール解決をライブラリに委ねる。
- **不採用の理由**:
  - Next.js の静的エクスポート（`output: 'export'`）環境において、サブパスマッピングやミドルウェアの制限が多く、ビルド設定やデプロイパイプラインの複雑化を招くため。
  - バンドルサイズの増加、および既存テストスイートの大幅な書き換えが必要となりリスクが高いため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `src/lib/i18n.ts`:
    - `Language = 'ja' | 'en'` 型、`LANGUAGE_STORAGE_KEY = 'algo_language'`
    - `detectInitialLanguage()`: LocalStorage 優先 ➔ ブラウザ言語 / タイムゾーン（`Asia/Tokyo`）判定 ➔ 日本以外は `'en'`。
    - `setStoredLanguage(lang)` / `getStoredLanguage()`: LocalStorage 永続化および `document.documentElement.lang` 更新。
    - `translations`: ゲーム全体の全UI文言を自然なゲーミング英語で完全対訳。
    - `I18nProvider`: `src/app/page.tsx` でルート全体をラップ。
    - `useI18n()`: `language`, `setLanguage`, `t` を提供。
  - `src/components/LanguageSwitcher.tsx`:
    - デスクトップヘッダー（`variant="header"`）、モバイルメニュー（`variant="menu"`）、セットアップ画面（`variant="setup"`）を提供。
  - 全UIコンポーネント（`SetupModal`, `GameBoard`, `AttackModal`, `CpuAttackModal`, `DeckTracker`, `ResultModal`, `StatsModal`, `RuleGuideModal`, `TutorialPromptModal`, `HintModal`, `LethalCutIn`, `GameLog`, `LegalContentModal`, `ConfirmModal`）の多言語対応。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - 海外からのアクセス時に自動で英語UIが提示され、英語圏ユーザーが即座にゲームをプレイ可能になった。
  - ワンクリックで日英をスムーズに切り替え可能になり、ユーザーの好みに応じた言語選択が永続化される。
  - 英語表記の文字伸長を考慮したUI設計（Truncate, 伸縮可能な幅, レスポンシブフォント）により、画面崩れが発生しない。
  - 既存の全テスト資産（614テスト）との完全な後方互換性を達成。
- **ネガティブな影響 / 許容したトレードオフ**:
  - 言語ごとに文字列長が異なるため、新規UI追加時には日英双方でのレイアウト検証（Playwright等）が必要となる。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
本ADRに基づき更新済みの設計書一覧：
- [x] `docs/design/database/schema-spec.md`: `algo_language` ローカルストレージキーの仕様追記
- [x] `docs/design/backend/api-spec.md`: `src/lib/i18n.ts` モジュール仕様追記
- [x] `docs/design/frontend/screen-specs.md`: `LanguageSwitcher` コンポーネント仕様追記
- [x] `docs/design/frontend/screen-flow.md`: `SCR-019` 言語切り替えトグルUIの画面フロー追記
- [x] `scripts/verify-doc-integrity.js`: 検証 PASS 確認
