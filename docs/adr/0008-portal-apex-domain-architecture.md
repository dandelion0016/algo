# ADR-0008: 親ドメイン（puzzlecabin.jp）向けポータル案内LP ＆ ホスティング基盤の IaC 統合アーキテクチャ

## ステータス
- **状態**: `ACCEPTED`
- **起票日**: 2026-10-26
- **承認日**: 2026-10-26
- **提案者**: フルスタック＆インフラ担当サブエージェント (`role:fullstack/infra`)
- **承認者**: 人間ゲートキーパー

---

## 1. コンテキストと課題 (Context & Problem Statement)
- 「アルゴ（algo）Web対戦システム」は独自ドメイン `puzzlecabin.jp` のサブドメイン **`coda.puzzlecabin.jp`** でホスティングされている（ADR-0004, ADR-0005）。
- 一方、親ドメイン（Zone Apex）である **`puzzlecabin.jp`** はブランド総合ポータル「PuzzleCabin（パズルキャビン）」としての役割を持つが、従来はホスティング基盤・ランディングページ（LP）が存在せず、親ドメイン直接アクセス時の体験が未整備であった。
- 加えて、Google AdSense の審査基準においては以下の要件が厳格に求められる：
  1. 親ドメイン（Apex）における独立した価値あるコンテンツおよびゲーム・ポータル案内。
  2. Google Site Verification メタタグによるサイト所有権確認。
  3. ルート配下における `ads.txt` の配信（`https://puzzlecabin.jp/ads.txt`）。
  4. プライバシーポリシー（Cookie・AdSense対応）、利用規約、免責事項、運営者情報の明記。
- 今後予定されている複数ゲーム（リバーシ、ナンプレ、暗号解読等）へのハブ展開を見据え、親ドメインを各サブドメインゲームへのポータルとして機能させる必要があった。

---

## 2. 検討した選択肢 (Considered Options)

### 選択肢 1: 親ドメイン専用の S3 バケット ＆ CloudFront ディストリビューションを IaC に統合し、静的ポータルLP（`portal/`）を独立配信する方式 (採用案)
- **概要**:
  - `infrastructure/cloudformation/main.yaml` に Apex ドメイン用の静的ホスティングリソース（`PortalHostingBucket`, `PortalCloudFrontDistribution`, `Route53ApexRecordA`, `Route53ApexRecordAAAA`）を追加。
  - リポジトリルートに `portal/index.html`（Tailwind CSS CDN・レスポンシブ）および `portal/ads.txt` を配置。
  - GitHub Actions CI/CD（`.github/workflows/deploy.yml`）で `portal/` ディレクトリを S3 バケットへ自動同期し、CloudFront キャッシュを無効化する。
- **メリット**:
  - Next.js アプリケーション（`coda.puzzlecabin.jp`）とポータルLPが完全に疎結合となり、ゲーム側のビルド成否や依存関係に影響されず安全に運用・デプロイできる。
  - 親ドメイン直下の静的配信（S3 + CloudFront）により、表示速度・TTFBが極めて高速で Google 審査や SEO に有利。
  - CloudFormation で Route 53 Apex エイリアスレコード（A/AAAA Alias）および IAM DeployRole が一元管理され、インフラの完全再現性が維持される。
  - CloudFront Always Free 枠内（1TB/月、1000万リクエスト）および S3 無料枠内で動作し、追加インフラ費用 $0 を維持。
- **デメリット・トレードオフ**:
  - CloudFormation のリソース数（バケット、Distribution、DNSレコード）が増加する。ただし、同一スタック内で管理されるため保守上のオーバーヘッドは軽微。

### 選択肢 2: 単一の Next.js アプリケーション内でホストヘッダーによる動的ルーティング・リダイレクトを行う方式 (不採用案)
- **概要**:
  - 単一の CloudFront と Next.js 静的エクスポート成果物内で、Middleware または JavaScript によるドメイン判定を行い、`puzzlecabin.jp` アクセス時にポータルページを描画する。
- **不採用の理由**:
  - Static Export（SSG）環境では Next.js のサーバーサイド Middleware が動作せず、エッジでの動的ルーティングには CloudFront Functions / Lambda@Edge が必要となり構成が複雑化・課金リスクが生じる。
  - ゲームアプリ本体の改修や不具合が親ドメインポータルに波及するリスクがあり、疎結合アーキテクチャの観点からも推奨されないため。

---

## 3. 決定事項 (Decision Outcome)
- **採択された方針**:
  - **選択肢 1** を採択する。
  - ポータル LP 成果物として `portal/index.html` および `portal/ads.txt` を新規作成。
  - CloudFormation（`infrastructure/cloudformation/main.yaml`）を更新：
    - `PortalHostingBucket`: S3 バケット（暗号化、パブリックブロック、バージョニング）
    - `PortalHostingBucketPolicy`: CloudFront OAC 経由の GetObject 許可
    - `PortalCloudFrontDistribution`: Aliases に `puzzlecabin.jp`、ACM 証明書、OAC、セキュリティヘッダー連携
    - `Route53ApexRecordA` / `Route53ApexRecordAAAA`: Apex ドメイン `puzzlecabin.jp` の CloudFront Alias レコード
    - `DeployRole`: Portal 用 S3 バケット同期および CloudFront 無効化権限の付与
    - `Outputs`: `PortalHostingBucketName`, `PortalCloudFrontDistributionId`, `PortalCloudFrontDomainName`, `PortalUrl`
  - CI/CD（`.github/workflows/deploy.yml`）に `portal/` アセットの自動同期ステップおよびキャッシュ無効化ステップを追加。
  - インフラ設計書（`docs/design/infrastructure/architecture.md`, `docs/design/infrastructure/iac-spec.md`）に Apex ホスティング基盤仕様を反映。

---

## 4. 結果・影響とトレードオフ (Consequences)
- **ポジティブな影響**:
  - `https://puzzlecabin.jp` にアクセスしたユーザーが美麗なポータル画面から「アルゴ」をはじめとする各ゲームへスムーズに遷移可能となった。
  - Google AdSense 審査に必要な全要件（サイト所有権確認タグ、審査スクリプト、ads.txt、各種規約・運営者情報）が完璧に整った。
  - ゲーム本体とポータルが物理的に分離されたため、互いのデプロイや保守が独立して行える。
- **留意事項**:
  - GitHub Actions での自動デプロイを有効化するには、リポジトリの Secrets/Variables に `PORTAL_S3_BUCKET_NAME` および `PORTAL_CLOUDFRONT_DISTRIBUTION_ID` を設定する（未設定時も安全にスキップされる設計）。
