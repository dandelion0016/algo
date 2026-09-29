# セキュリティ 認証・認可設計書 (Auth Spec)

本設計書は、「アルゴ（algo）Web対戦システム」におけるプレイヤーの認証（Authentication）および認可（Authorization）のアーキテクチャを定義します。
手軽に遊べる**「完全匿名のゲストプレイ」**から、戦績保存・レーティング対戦が可能な**「Amazon Cognito によるアカウント認証」**まで、シームレスかつセキュアに両立するモデルを策定します。

---

## 1. 認証アーキテクチャ概要

```mermaid
flowchart TD
    Player["プレイヤー"] --> FirstVisit{"初回アクセス / ゲーム開始"}

    FirstVisit -->|ユーザーID未保持| AutoGen["1. 自動ランダムユーザーID生成<br>・ランダム文字列発行 (例: usr_8f3a1b9c7e2d)<br>・Cookieに保存 (algo_user_id)<br>・即時CPU対戦 / ルーム対戦開始可能"]
    FirstVisit -->|Cookie保持済み| LoadCookie["2. 既存ユーザーID読み出し<br>・Cookieより algo_user_id 取得<br>・対戦設定・戦績を継続管理"]

    AutoGen --> Play["ゲームプレイ (CPU対戦 / ルーム参加)"]
    LoadCookie --> Play

    Play -.->|本格的に遊ぶ (将来拡張)| Cognito["3. 将来拡張: Amazon Cognito<br>・任意のユーザーID (カスタムID/表示名) 登録<br>・メール/パスワード / ソーシャル認証<br>・CookieのランダムIDから任意ユーザーIDへ戦績引き継ぎ"]
    Cognito --> CloudSync["戦績・レーティングのクラウド永続化<br>・DynamoDB連携 / 全国ランキング"]
```

---

## 2. プレイヤーロール ＆ 認可マトリクス (RBAC)

システムにおけるロールを以下の4種類に分類し、操作権限を厳格に制御します：

1. **ゲスト (`guest`)**: アカウント未登録の匿名プレイヤー。UUID（一時ID）で識別。
2. **登録ユーザー (`user`)**: Amazon Cognito で認証済みの正規プレイヤー。戦績・レートをクラウドに永続化。
3. **ルームホスト (`room_host`)**: オンライン対戦ルームを作成したプレイヤー（ゲスト/登録ユーザー問わず当該ルーム内でのみ有効）。
4. **システム管理者 (`admin`)**: 不正ユーザーBANや全体メンテナンスアナウンス権限を持つ管理者。

| 操作 / リソース | ゲスト (`guest`) | 登録ユーザー (`user`) | ルームホスト (`room_host`) | システム管理者 (`admin`) |
| :--- | :---: | :---: | :---: | :---: |
| **CPU対戦プレイ (全難易度)** | ○ | ○ | ○ | ○ |
| **ルール閲覧 / 設定変更** | ○ | ○ | ○ | ○ |
| **オンラインルーム作成 (Phase 2)** | ○ | ○ | ○ | ○ |
| **オンラインルーム参加 (Phase 2)** | ○ | ○ | ○ | ○ |
| **ルーム設定変更 / キック権限** | × | × | ○ (自ルームのみ) | ○ (全ルーム強制) |
| **対戦履歴のクラウド永続化** | × (ブラウザ内のみ) | ○ (DynamoDB保存) | ○ | ○ |
| **全国レーティングランキング参加** | × | ○ | ○ | ○ |
| **アカウント登録への戦績移行** | ○ | - | - | - |
| **不正プレイヤーのBAN / 停止** | × | × | × | ○ |
| **AWS Budgets / SRE監視閲覧** | × | × | × | ○ |

---

## 3. 認証方式 ＆ トークン設計

### 3.1 初回アクセス時の自動ランダムユーザーID発行 ＆ Cookie管理
- **識別子生成**: ゲーム初回アクセス時またはゲーム開始時に、一意なランダム文字列を自動生成（例: `usr_` + 16文字の暗号学的ランダム英数字、またはナノID/UUID v4）。
- **格納先**: ブラウザの **`Cookie`**（クッキー名: `algo_user_id`）。
- **Cookie属性設計**:
  - `Path=/`: アプリケーション全体で有効。
  - `Max-Age=31536000` (1年間有効): 再訪時にも同一ユーザーとして対戦設定・戦績を継続保持。
  - `SameSite=Lax`: クロスサイトリクエスト時の適切なセキュリティを担保。
  - `Secure`: 本番環境（HTTPS）でのみ暗号化通信に乗せて送出（ローカル開発時はHTTP許容）。
  - （将来API拡張時）`HttpOnly` Cookie によるセキュアなサーバーセッション管理へのシームレスな移行が可能。
- **プライバシー配慮**: 氏名・メールアドレス等の個人特定可能情報（PII）は一切取得・保管せず、純粋なゲーム識別子として運用。

### 3.2 将来拡張: Amazon Cognito による任意ユーザーID登録
Phase 2 においてユーザーが任意のアカウントを作成する際、Cognito User Pools を導入します：
- **任意ユーザーIDの指定**: ユーザーは任意のユーザーネーム（例: `algo_master99` や任意の英数字ID）を指定して登録可能。
- **Cognito JWTトークン**:
  1. **ID Token (JWT)**: ユーザープロファイル（任意指定のユーザーネーム `cognito:username`、表示名、アバター）。
  2. **Access Token (JWT)**: 有効期限60分。API Gateway / WebSocket の認可に使用。
  3. **Refresh Token**: 有効期限30日間。長期セッション維持。

---

## 4. CookieランダムユーザーIDからCognito任意ユーザーIDへの昇格（戦績引き継ぎ設計）

初期にCookieで自動発行されたランダムユーザーIDから、将来的にCognitoで登録した「任意のユーザーID」へ戦績やルーム設定をシームレスに引き継ぐシーケンスを規定します：

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant Browser as ブラウザ (Cookie: algo_user_id)
    participant Cognito as Amazon Cognito
    participant API as Lambda API
    participant DB as Amazon DynamoDB

    Player->>Browser: 「アカウント登録（任意のユーザーID登録）」
    Browser->>Cognito: 希望のユーザーID（英数字）・パスワードでサインアップ
    Cognito-->>Browser: 認証成功 (JWT Access Token & ID Token 発行)

    Browser->>API: POST /api/user/link-account<br>Headers: Authorization: Bearer <JWT><br>Cookie: algo_user_id=usr_8f3a1b...
    Note over API: 1. JWT署名検証 (Cognito任意ユーザーID取得)<br>2. CookieのランダムユーザーIDを取得<br>3. 過去の対戦履歴・戦績レコードのPK/GSIを移行・紐付け

    API->>DB: DynamoDB UpdateItem / BatchWriteItem<br>(CookieのランダムIDデータをCognito任意ユーザーIDへマージ)
    DB-->>API: 完了
    API-->>Browser: 200 OK (引き継ぎ完了)<br>Set-Cookie: algo_user_id=<cognito_sub>; Path=/
    Browser->>Browser: 任意ユーザーIDとしてログイン状態へ移行（戦績完全維持）
```
