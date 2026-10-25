# ADR-0005: Route 53 パブリックホストゾーン（puzzlecabin.jp）およびサブドメイン（coda.puzzlecabin.jp）の IaC 一元統合アーキテクチャ

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-25
- **承認日**: 2026-10-25
- **提案者**: インフラ・DevOps担当サブエージェント (`role:infra/dev`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」の独自ドメイン展開において、ユーザーが Apex ドメイン **`puzzlecabin.jp`** を取得し、本カードゲームアプリをサブドメイン **`coda.puzzlecabin.jp`** で運用する要件が策定された（Issue #150）。
- 将来的に複数の頭脳系パズルやボードゲーム、ポータルアプリ（例: `portal.puzzlecabin.jp`, `sudoku.puzzlecabin.jp` 等）を同一ドメイン配下のサブドメインとして順次水平展開していく構想がある。
- ADR-0004 では月額 $0 運用のために外部レジストラ（Xserver）標準ネームサーバーでの CNAME 管理を採択していたが、以下の課題が顕在化していた：
  1. 複数アプリ・サブドメインを展開する際に、DNS レコード管理が外部コンソール（Xserver）の手動作業に依存し、インフラの再現性・自動化（IaC）が損なわれる。
  2. CloudFront エッジ配信において、Route 53 エイリアスレコード（A/AAAA Alias）を利用した Route 53 ネイティブな DNS 名前解決（高速化、IPv6 デュアルスタック対応、Route 53 クエリ無料化）の恩恵を受けられない。
  3. AWS Certificate Manager (ACM) の DNS 検証において、Route 53 ホストゾーンがあれば「Route 53 でレコードを作成」のワンクリックで自動検証・自動更新が可能になるが、外部DNSでは手動CNAME登録の手間が発生する。

---

## 2. 検討した選択肢 (Considered Options)

### 選択肢 1: Route 53 パブリックホストゾーン（`puzzlecabin.jp`）作成 ＆ サブドメイン（`coda.puzzlecabin.jp`）CloudFront Alias レコードの IaC 一元統合 (採用案)
- **概要**:
  - `infrastructure/cloudformation/main.yaml` に Route 53 パブリックホストゾーン (`AWS::Route53::HostedZone`) を統合管理するリソース・パラメータを追加。
  - レジストラ（Xserverドメイン）側のネームサーバー設定に、Route 53 が払い出す 4 本の NS レコードを登録し、ドメインの権威 DNS を AWS に委任する。
  - サブドメイン `coda.puzzlecabin.jp` 宛の IPv4 (A) および IPv6 (AAAA) レコードを CloudFront ディストリビューション向けのエクスチェンジャブルな Alias レコードとして IaC で自動プロビジョニングする。
  - ACM パブリック証明書は CloudFront の仕様に準拠し `us-east-1` (バージニア北部) でワイルドカード `*.puzzlecabin.jp` および `puzzlecabin.jp` をカバーする形で発行する。
- **メリット**:
  - CloudFormation スタックデプロイ時にホストゾーンおよび CloudFront エイリアスレコードが完全自動で構築される。
  - 将来別サブドメインで新ゲーム・ポータルを追加する際も、同一ホストゾーン内で容易に IaC 管理・拡張が可能。
  - Route 53 の CloudFront エイリアスレコードは DNS クエリ課金が無料（AWS エイリアス仕様）となり、レイテンシ低減と IPv6 完全対応を実現。
  - ACM の DNS 検証がワンクリック（Route 53 自動レコード追加）で即座に完了する。
- **デメリット・トレードオフ**:
  - Route 53 パブリックホストゾーン維持費（$0.50/月）が発生する。ただし、ユーザーが独自ドメイン `puzzlecabin.jp` をポータル基盤として取得・運用する意思決定に伴い、正当なプラットフォーム投資として許容される。

### 選択肢 2: Xserver標準DNSネームサーバーでの CNAME 運用継続 (不採用案)
- **概要**:
  - ADR-0004 の通り、Xserver側の管理パネルでサブドメイン `coda` の CNAME レコードを手動作成し、CloudFormation 側には Route 53 を含めない。
- **不採用の理由**:
  - 複数サブドメインの IaC 管理ができず、レジストラコンソールへの手作業が恒久的に発生する。
  - IPv6 (AAAA) レコードや Zone Apex 連携の柔軟性が低下し、今後のマルチアプリ展開に適さないため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - `infrastructure/cloudformation/main.yaml` を拡張し、以下のリソースとパラメータを統合：
    - パラメータ: `ManageRoute53Zone`, `RootDomainName` (デフォルト: `puzzlecabin.jp`), `AppSubdomain` (デフォルト: `coda`), `CustomDomainName`, `AcmCertificateArn`
    - 条件: `ShouldCreateHostedZone`, `HasAcmCertificate`, `HasCustomDomain`, `ShouldCreateDnsRecords`
    - リソース: `Route53HostedZone`, `CloudFrontDnsRecordA`, `CloudFrontDnsRecordAAAA`
    - 出力: `HostedZoneId`, `HostedZoneNameServers` (Xserver登録用の4本ネームサーバー), `AppUrl`
  - フロントエンド SEO モジュール (`src/lib/seo.ts`) のデフォルトサイト URL を `https://coda.puzzlecabin.jp` に更新。
  - セットアップ手順書 `docs/setup/route53-puzzlecabin-setup-guide.md` を作成し、Xserver ネームサーバー設定から ACM 発行、伝播確認までの手順を整備。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - `https://coda.puzzlecabin.jp` へのアクセスが Route 53 エイリアスおよび CloudFront エッジを通じて世界中から超低レイテンシで配信される。
  - 将来 `puzzlecabin.jp` ドメイン配下に新規ゲームやブログ、ポータルを追加する際の下地基盤が整った。
  - デフォルト SEO メタデータ、OGP、JSON-LD、`robots.txt`、`sitemap.xml` が正式な本番 URL `https://coda.puzzlecabin.jp` に統一された。
- **ネガティブな影響 / 許容したトレードオフ**:
  - Route 53 ホストゾーン課金（$0.50/月）が発生するため、AWS Budgets の `$0.01` ゼロコストアラート設定値や通知の取り扱いについて手順書および設計書に明記する。

---

## 5. 設計書への追従反映計画 (Documentation Sync Plan)
人間ゲートキーパーの承認後、本ADRに基づき更新する設計書一覧：
- [x] `docs/design/infrastructure/architecture.md`: Route 53 パブリックホストゾーン、サブドメイン構成、CloudFront エイリアスおよび ACM の構成追記
- [x] `docs/design/infrastructure/iac-spec.md`: CloudFormation 管理リソース (`Route53HostedZone`, `CloudFrontDnsRecordA`, `CloudFrontDnsRecordAAAA`)、パラメータ、出力定義の更新
- [x] `docs/setup/route53-puzzlecabin-setup-guide.md`: Xserver ネームサーバー変更・ACM発行・Route 53 連携手順書の新規作成
- [x] 実装コード / 設定ファイル: `infrastructure/cloudformation/main.yaml`, `src/lib/seo.ts`, `src/lib/__tests__/seo.test.ts`, `.github/workflows/deploy.yml`
