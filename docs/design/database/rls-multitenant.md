# 行レベルセキュリティ (RLS) ＆ 対戦相手間データ分離・機密保護設計書

本ドキュメントは、「アルゴ（algo）Web対戦システム」におけるマルチユーザー間のデータ分離、および **相手の伏せカードの数字漏洩・チートを機械的に防止するデータ保護設計** を定義します。

---

## 1. アルゴにおけるデータ機密保護の最重要課題

アルゴは「相手の裏向きカードの数字を論理的に推理する」頭脳対戦ゲームです。
もし相手の裏向きカードの数字（`number`）が、APIレスポンスやWebSocketメッセージに1ミリでも含まれてクライアント（ブラウザ）へ届いてしまうと、**ブラウザのDevToolsやパケット解析により100%カンニング（チート行為）が可能** となり、ゲーム性が完全に崩壊します。

```mermaid
flowchart TD
    subgraph NG ["【禁止アンチパターン】フロントエンド隠蔽"]
        D1[DB: 相手の伏せカード 7] --> S1[Server: そのまま送信]
        S1 -->|JSON { number: 7, isOpen: false }| C1[Browser Client]
        C1 -->|CSS / React で '?' 表示| UI1[画面表示: '?']
        DevTools[悪意あるユーザー: DevTools / ネットワークタブ] -.->|メモリ・パケットを盗見| Hack[数字 '7' が丸見え (即チート成立)]
    end

    subgraph OK ["【本システムの設計】サーバーサイド・データレイヤー完全マスク"]
        D2[DB: 相手の伏せカード 7] --> S2[Server / Lambda / RLS: マスキングエンジン]
        S2 -->|owner_id != me && !isOpen| Mask[number を null に置換]
        Mask -->|JSON { color: 'BLACK', isOpen: false, number: null }| C2[Browser Client]
        C2 --> UI2[画面表示: '?']
        DevTools2[悪意あるユーザー: DevTools / ネットワークタブ] -.->|メモリ・パケットを検証| Safe[数字データ自体が存在しない (100%安全)]
    end
```

### 1.1 多層防御の設計原則
1. **プロンプトやUI表示だけに依存しない**: 画面の `display: none` やReactのコンポーネント内分岐で隠すのではなく、**サーバーレスAPI・DBプロジェクション層で完全にデータを破棄・マスク** してレスポンスする。
2. **送信ペイロードの最小化（Need-to-Knowの原則）**: プレイヤーには、そのプレイヤーがルール上知り得る情報（自分の手札全情報、相手のオープン済みカード、相手の伏せカードの色と位置のみ）しか渡さない。
3. **インフラ層での認可強制**: DynamoDB IAM ポリシーおよび PostgreSQL RLS により、他人のプライベートデータへの直接アクセスを遮断する。

---

## 2. 非公開カード情報の漏洩防止設計（サーバーサイド・マスキング）

### 2.1 カード属性の公開区分

| カード属性 | 自分の手札 | 相手の手札（表向き / Open） | 相手の手札（裏向き / Closed） | 山札（未ドロー） |
| :--- | :---: | :---: | :---: | :---: |
| `cardId` | 公開 | 公開 | 公開 (識別用) | 秘匿 (ハッシュまたは非送信) |
| `color` (黒/白) | **公開** | **公開** | **公開** (ルール上必須) | 秘匿 (次に引くカードの色は直前まで伏せる) |
| `position` (並び順) | **公開** | **公開** | **公開** (ソートルール準拠) | - |
| `isOpen` (表/裏) | **公開** | **公開** | **公開** | - |
| **`number` (数字 0〜11)** | **公開** | **公開** | ❌ **絶対に送信しない (`null`)** | ❌ **絶対に送信しない (`null`)** |

### 2.2 マスキング変換ロジック（TypeScript / Lambda 仕様）

```typescript
export interface Card {
  id: string;
  color: 'BLACK' | 'WHITE';
  number: number;
  isOpen: boolean;
  position: number;
}

export interface MaskedCard {
  id: string;
  color: 'BLACK' | 'WHITE';
  number: number | null; // 伏せカードの場合は null
  isOpen: boolean;
  position: number;
}

/**
 * 要求ユーザーIDに基づき手札データを安全にマスキングするプロジェクション関数
 */
export function projectHandForViewer(
  ownerUserId: string,
  requestingUserId: string,
  hand: Card[]
): MaskedCard[] {
  const isOwner = ownerUserId === requestingUserId;

  return hand.map((card) => {
    // 自身のカード、またはすでに表向きのカードのみ数字を開示
    if (isOwner || card.isOpen) {
      return {
        id: card.id,
        color: card.color,
        number: card.number,
        isOpen: card.isOpen,
        position: card.position,
      };
    }

    // 対戦相手の裏向きカードは数字を剥奪（null）して返却
    return {
      id: card.id,
      color: card.color,
      number: null,
      isOpen: false,
      position: card.position,
    };
  });
}
```

---

## 3. Amazon DynamoDB ＆ Amazon Cognito による行レベル制御 (FGAC)

### 3.1 アクセスアーキテクチャの分離
- **個人ユーザー領域 (Direct Access)**:
  - ユーザー自身のプロファイル取得・更新は、Cognito IDプールで発行された一時認証情報を用い、DynamoDBへ直接安全にアクセス可能。
  - IAMの `dynamodb:LeadingKeys` 条件キーにより、自身の `USER#<Cognito_Sub>` 行以外へのアクセスをAWSインフラ層で物理的に拒絶。
- **ゲーム対戦領域 (Service Role Proxy Access)**:
  - ルーム作成、対戦進行、手札取得、アタック推理判定は、**クライアントからDynamoDBへ直接アクセスすることを一切禁止**。
  - 必ず WebSocket API (API Gateway) / AWS Lambda (`AlgoGameExecutionRole`) を経由させ、サーバーサイドで上記のマスキング変換およびルール検証を強制実行。

```mermaid
flowchart LR
    Client["Client (Web Browser)"]

    subgraph UserProfileFlow ["ユーザープロファイル操作 (Direct / FGAC)"]
        Client -->|Cognito JWT (sub)| DDB_Direct["DynamoDB Table"]
        note1["IAM Policy (LeadingKeys == sub)\n他人のデータは読み書き不能"] -.-> DDB_Direct
    end

    subgraph BattleFlow ["リアルタイム対戦操作 (Proxy with Masking)"]
        Client -->|WebSocket / HTTPS| APIGW["API Gateway / Lambda"]
        APIGW -->|ルール検証 & マスキング| BackendLogic["Game Service Engine"]
        BackendLogic -->|AlgoGameExecutionRole| DDB_Battle["DynamoDB (Raw Data)"]
        BackendLogic -->|マスク済みデータのみ配信| Client
    end
```

### 3.2 DynamoDB IAM 行レベルアクセスポリシー定義（ユーザープロファイル用）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUserOwnProfileAccessOnly",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:*:table/AlgoBattleTable",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": [
            "USER#${cognito-identity.amazonaws.com:sub}"
          ]
        },
        "ForAnyValue:StringEquals": {
          "dynamodb:Attributes": [
            "username",
            "email",
            "updatedAt",
            "preferences"
          ]
        }
      }
    }
  ]
}
```

---

## 4. PostgreSQL 環境における Row-Level Security (RLS) 仕様

将来的に PostgreSQL（RDS / Aurora）へ移行する場合、またはローカル開発環境における RLS およびセキュアビューの定義です。

### 4.1 ユーザーマスタの RLS 定義
```sql
-- users テーブルのRLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 自身のアカウント情報のみ更新可能
CREATE POLICY user_update_own_profile ON users
    FOR UPDATE
    USING (cognito_sub = current_setting('app.current_user_sub', true))
    WITH CHECK (cognito_sub = current_setting('app.current_user_sub', true));

-- 全体ランキングや対戦相手の基本名義は閲覧許可
CREATE POLICY user_read_public ON users
    FOR SELECT
    USING (true);
```

### 4.2 セキュアビューによるカードマスキングの強制
PostgreSQLの行レベルセキュリティに加えて、JSONB手札内の裏向きカード数字を動的にマスクするセキュアビューを提供します。

```sql
-- 手札マスキング関数 (SECURITY DEFINER で安全に評価)
CREATE OR REPLACE FUNCTION mask_hand_for_viewer(
    p_owner_user_id UUID,
    p_viewer_user_id UUID,
    p_hand JSONB
) RETURNS JSONB AS $$
DECLARE
    v_masked JSONB;
BEGIN
    -- 閲覧者が持ち主本人の場合は無加工で返却
    IF p_owner_user_id = p_viewer_user_id THEN
        RETURN p_hand;
    END IF;

    -- 対戦相手の場合、isOpen = false の card.number を NULL に置換
    SELECT jsonb_agg(
        CASE
            WHEN (elem->>'isOpen')::boolean = true THEN elem
            ELSE jsonb_set(elem, '{number}', 'null'::jsonb)
        END
    )
    INTO v_masked
    FROM jsonb_array_elements(p_hand) AS elem;

    RETURN COALESCE(v_masked, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- クライアント参照用セキュアビュー
CREATE OR REPLACE VIEW v_room_participants_safe AS
SELECT
    rp.id,
    rp.room_id,
    rp.user_id,
    rp.seat_number,
    rp.status,
    mask_hand_for_viewer(
        rp.user_id,
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        rp.hand
    ) AS hand,
    rp.joined_at
FROM room_participants rp;
```

---

## 5. 監査およびチート検知機能

1. **不正リクエストの即時遮断**:
   - クライアントからアタック推理を行う際、自身の所持カードや、すでに表向きになっているカードを推理宣言した場合、サーバー側バリデーションで `400 Bad Request / INVALID_MOVE` として即時拒否。
2. **MoveLog による完全監査性**:
   - `move_logs` テーブルには手番実行者のID、対象者、宣言数字、的中成否、所要時間をすべて記録。
   - 異常に高い的中率や、不自然に早い推論レスポンス（BOTやチートツール利用の疑い）は後から容易にクエリ分析・検知可能。
