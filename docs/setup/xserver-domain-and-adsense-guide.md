# Xserverドメイン（.jp）連携 ＆ Google AdSense 収益化セットアップ手順書

本手順書では、「アルゴ（algo）Web対戦システム」に **Xserverドメイン（`.jp`）** を連携し、**AWSの月額コスト `$0`（Route 53 不使用）** を維持したまま HTTPS 独自ドメイン公開および **Google AdSense** 広告収益化を行う手順をステップバイステップで解説します。

---

## ステップ 1: Xserverドメインで `.jp` ドメインを取得する

1. [Xserverドメイン](https://www.xdomain.ne.jp/) にアクセスし、希望する `.jp` ドメイン（例: `algo-game.jp`）を検索・取得します。
2. **ネームサーバー設定**:
   - Xserverドメイン管理画面にて「ネームサーバー設定」を確認し、**「Xserverドメイン（標準ネームサーバー）」** のままにします。
   - 💡 **コスト節約ポイント**: AWS Route 53 のホストゾーン（月額 $0.50）は作成せず、Xserverドメイン無料のDNSレコード編集機能を使うことで、**AWS側の月額費用は完全 `$0`** のまま運用できます。

---

## ステップ 2: AWS Certificate Manager (ACM) で無料SSL証明書を発行する

CloudFront で独自ドメイン（HTTPS）を使うため、AWS Certificate Manager (ACM) で無料のパブリックSSL証明書を発行します。

1. AWSマネジメントコンソールにログインし、画面右上のリージョン選択を **必ず「米国東部（バージニア北部）`us-east-1`」** に切り替えます。
   > ⚠️ **重要**: CloudFront にアタッチする ACM 証明書は **`us-east-1`（バージニア北部）** で発行したものしか選択できません（東京リージョン `ap-northeast-1` で発行すると CloudFront で利用できないためご注意ください）。
2. **Certificate Manager (ACM)** コンソールを開き、「証明書をリクエスト」をクリックします。
3. 「パブリック証明書をリクエスト」を選択し、「次へ」をクリックします。
4. **ドメイン名**:
   - `algo-game.jp`（ルートドメイン）
   - 「この証明書に別の名前を追加」をクリックし、`*.algo-game.jp`（または `www.algo-game.jp`）も追加しておくと両方対応できて便利です。
5. **検証方法**: **「DNS検証」** を選択し、「リクエスト」をクリックします。
6. 発行された証明書の詳細画面を開くと、「ドメイン」欄に **`CNAME 名`** と **`CNAME 値`** が表示されます。
7. **XserverドメインのDNSレコードに追加**:
   - Xserverドメインの管理パネル ＞「DNSレコード設定」を開きます。
   - 「DNSレコード追加」タブで以下を入力して追加します：
     - **ホスト名**: ACMの `CNAME 名` から末尾の `.algo-game.jp.` を除いた部分（例: `_abc123456789`）
     - **種別**: `CNAME`
     - **内容（値）**: ACMの `CNAME 値`（末尾のドット `.` はXserverの仕様に合わせて除去またはそのまま入力）
8. 数分〜30分程度で ACM 側のステータスが **「発行済み (Issued)」** に変わります。証明書の **ARN**（`arn:aws:acm:us-east-1:330631893499:certificate/xxxx...`）をコピーして控えておきます。

---

## ステップ 3: CloudFormation スタック更新 ＆ Xserver DNS 紐付け

### 3.1 CloudFormation パラメータの更新
`infrastructure/cloudformation/main.yaml` には `CustomDomainName` と `AcmCertificateArn` パラメータが用意されています。

1. AWSコンソール（**東京リージョン `ap-northeast-1`**）で **CloudFormation** を開き、既存のスタックを選択して「更新（Update）」＞「既存テンプレートを置き換える」または現在のテンプレートを使用します。
2. パラメータに以下を入力してスタックを更新します：
   - **`CustomDomainName`**: 公開するドメイン名（例: `www.algo-game.jp` または `algo-game.jp`）
   - **`AcmCertificateArn`**: ステップ 2 で取得した `us-east-1` の ACM 証明書 ARN
3. スタックの更新完了後、「出力（Outputs）」タブの `CloudFrontDomainName`（例: `d12345abcdef.cloudfront.net`）を確認します。

### 3.2 Xserverドメイン側の DNS レコード設定
- **サブドメイン（`www.algo-game.jp`）で運用する場合（推奨・最も簡単）**:
  1. Xserverドメイン「DNSレコード設定」で以下のレコードを追加します：
     - **ホスト名**: `www`
     - **種別**: `CNAME`
     - **内容**: `d12345abcdef.cloudfront.net`（ご自身のCloudFrontドメイン名）
  2. ルートドメイン（`algo-game.jp`）へのアクセスも `https://www.algo-game.jp` へ誘導したい場合は、Xserverドメイン標準の「転送設定（リダイレクト機能）」で `algo-game.jp` ➔ `https://www.algo-game.jp/` を設定してください。

---

## ステップ 4: GitHub Variables 設定 ＆ Google AdSense 審査・広告有効化

### 4.1 独自ドメインURLの反映
1. GitHub リポジトリの **Settings > Secrets and variables > Actions > Variables** タブを開きます。
2. 「New repository variable」から以下を登録します：
   - **Name**: `NEXT_PUBLIC_SITE_URL`
   - **Value**: `https://www.algo-game.jp`（実際の公開URL）
3. これにより、次回以降のデプロイ時に OGP・Canonical URL・`robots.txt`・`sitemap.xml`・JSON-LD が自動的に独自ドメインURLで生成されます。

### 4.2 Google AdSense 審査申請
1. 本PRで追加された「アルゴ解説・攻略 / プライバシーポリシー / 利用規約」モーダル（`SetupModal` 下部およびページフッターからいつでも閲覧可能）が本番サイトに反映されていることを確認します。
2. [Google AdSense](https://www.google.com/adsense/start/) にアクセスし、独自ドメインURLとサイト運営者情報を登録します。
3. AdSense 管理画面で自分の **パブリッシャーID（`ca-pub-xxxxxxxxxxxxxxxx`）** が発行されたら：
   - リポジトリの `public/ads.txt` 内の `pub-0000000000000000` を実際の `pub-xxxxxxxxxxxxxxxx` に書き換えて `main` にマージします。
   - GitHub リポジトリの **Actions > Variables** に以下を登録します：
     - `NEXT_PUBLIC_ADSENSE_CLIENT_ID`: `ca-pub-xxxxxxxxxxxxxxxx`
     - `NEXT_PUBLIC_ADSENSE_SLOT_SETUP`: AdSense管理画面で作成したディスプレイ広告ユニットの `data-ad-slot` 番号（例: `1234567890`）
4. GitHub Actions の `CD Deploy to AWS` ワークフローを実行（またはコミットをプッシュ）すると、`<head>` への AdSense スクリプト埋め込みとセットアップ画面下部へのレスポンシブ広告枠が自動的に有効化されます。
