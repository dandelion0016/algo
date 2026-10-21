# ADR-0004: Xserver独自ドメイン（.jp）連携IaC対応およびGoogle AdSense広告枠・審査対策の実装

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-21
- **承認日**: 2026-10-21
- **提案者**: フロントエンド＆SEO・インフラ担当サブエージェント (`role:frontend/seo`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」の一般公開および収益化に向け、Xserverドメインで取得する独自ドメイン（`.jp`）の CloudFront 連携と、Google AdSense によるバナー広告配信・審査通過対策が必要となった（Issue #148）。
- インフラ要件として「AWS 月額利用料 `$0`（ゼロ課金ガード）」を厳守する必要がある一方、Amazon Route 53 ホストゾーンを利用すると月額 `$0.50` の固定費が発生するという課題がある。
- また、Google AdSense の審査を通過し、かつプレイヤーのゲームプレイ体験や既存 E2E テスト（モバイル `375x667` 1画面完結レイアウト）を損なわない広告枠配置と法的表記・独自テキストコンテンツの充実が求められている。

---

## 2. 検討した選択肢 (Considered Options)
1. **選択肢 1: Xserver標準ネームサーバー（無料DNS）＋ ACM (`us-east-1`) ＋ CloudFront 条件付きカスタムドメイン構成、および環境変数駆動型 `AdBanner` ＋ `LegalContentModal` 実装** (採用案)
   - 概要:
     - DNS 名前解決は Xserver ドメイン標準ネームサーバー（追加費用 0円）をそのまま利用し、AWS Certificate Manager (`us-east-1`) で発行した無料 SSL 証明書と CloudFront `Aliases` を `infrastructure/cloudformation/main.yaml` の条件分岐（`HasCustomDomain`）でアタッチする。
     - フロントエンドには `src/lib/adsense.ts`、`src/components/AdBanner.tsx`、`src/components/LegalContentModal.tsx`、`public/ads.txt` を実装する。`NEXT_PUBLIC_ADSENSE_CLIENT_ID` 未設定時は `AdBanner` が `null` を返し、モバイル1画面フィットを維持する。
   - メリット:
     - Route 53 ホストゾーン課金（$0.50/月）を回避し、AWS 側の月額 $0 を完全に維持できる。
     - 独自ドメイン未設定時と設定後の両方に単一の CloudFormation テンプレートで対応可能。
     - AdSense 審査に必要な「有用な独自コンテンツ（アルゴの歴史・ルール・上級戦術・FAQ）」「プライバシーポリシー（Cookie・パーソナライズ広告条項）」「利用規約」をSPA内で完結提供できる。
   - デメリット・リスク:
     - ACM 証明書は `us-east-1` で作成する必要があるため、手順書（`docs/setup/xserver-domain-and-adsense-guide.md`）で明確に案内する。

2. **選択肢 2: Amazon Route 53 ホストゾーンへのネームサーバー委任** (不採用案)
   - 概要:
     - Route 53 にホストゾーンを作成して DNS を管理する。
   - 不採用の理由:
     - ホストゾーン維持費（$0.50/月）が発生し、AWS Budgets の `$0.01` ゼロコストガードに抵触するため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `infrastructure/cloudformation/main.yaml` に `CustomDomainName` および `AcmCertificateArn` パラメータと `HasCustomDomain` 条件を追加する。
  - `.github/workflows/deploy.yml` に `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_SETUP` のビルド時注入を追加する。
  - `src/lib/adsense.ts`, `src/components/AdBanner.tsx`, `src/components/LegalContentModal.tsx`, `public/ads.txt` を実装し、`SetupModal` およびページフッターに組み込む。
- **採択理由**:
  - AWS 月額 `$0` 原則の維持、審査通過率の最大化、およびゲームプレイ中の UX・モバイルレイアウト保護をすべて両立できるため。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - 独自ドメイン（`.jp`）取得後、CloudFormation パラメータと GitHub Variables を設定するだけで即座に本番 HTTPS 独自ドメイン運用および AdSense 広告配信を開始できる。
- **ネガティブな影響 / 許容したトレードオフ**:
  - なし（環境変数未設定時は広告枠を非表示とし、既存レイアウトへの影響ゼロ）。
- **セキュリティ・運用への影響**:
  - `isValidAdSenseClientId()` により `^ca-pub-\d{10,20}$` 形式以外の不正な文字列注入を遮断する。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
人間ゲートキーパーの承認後、本ADRに基づき更新する設計書一覧：
- [x] `docs/design/backend/api-spec.md`: `3.10 Google AdSense 広告設定管理 (src/lib/adsense.ts)` の追記
- [x] `docs/design/frontend/screen-flow.md`: `SCR-018: LegalContentModal` および `AdBanner` の追記
- [x] `docs/design/frontend/screen-specs.md`: `AdBanner` および `LegalContentModal` の詳細仕様追記
- [x] `docs/design/infrastructure/architecture.md` & `docs/design/infrastructure/iac-spec.md`: Xserverドメイン外部DNS連携・ACM条件分岐の反映
- [x] 実装コード / 設定ファイル: `infrastructure/cloudformation/main.yaml`, `.github/workflows/deploy.yml`, `src/lib/adsense.ts`, `src/components/AdBanner.tsx`, `src/components/LegalContentModal.tsx`, `public/ads.txt`, `docs/setup/xserver-domain-and-adsense-guide.md`
