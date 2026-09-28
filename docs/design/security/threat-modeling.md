# セキュリティ 脅威分析 ＆ 対策マトリクス (Threat Modeling)

## 1. 脅威分析アプローチ
本システムでは、マイクロソフト提唱の **STRIDE モデル** および **OWASP Top 10 for LLM Applications (2025/2026)** を組み合わせ、エージェント特有の脆弱性とクラウドシステムの脅威を多角的に特定・対策します。

---

## 2. 脅威分析 ＆ 対策マトリクス

| 脅威ID | 分類 (STRIDE / OWASP) | 脅威シナリオ | 影響度 | 対策・実装メカニズム |
| :--- | :--- | :--- | :---: | :--- |
| `TH-001` | **LLM01: Prompt Injection** | 攻撃者が外部入力経由でプロンプトを上書きし、システム指示を逸脱させる | 高 | ・Amazon Bedrock Guardrailsによる入力検知<br>・ツール呼び出し層での型制約・Zod検証<br>・LLM応答の安全フィルタリング |
| `TH-002` | **Spoofing (なりすまし)** | 他ユーザーや偽のAIエージェントによる不正APIリクエスト | 高 | ・JWT署名検証（RS256）<br>・mTLS通信（サービス間）<br>・IAMロールの一時クレデンシャル（AssumeRole） |
| `TH-003` | **Tampering (改ざん)** | ツール実行時の引数改ざんによる他テナントIDや不正コマンド注入 | 極大 | ・実行コンテキストから `tenant_id` を自動注入<br>・ツール引数のホワイトリスト検証<br>・DB層のRLS強制 |
| `TH-004` | **Information Disclosure (漏洩)** | プロンプト応答やログに顧客の個人情報（PII）やAPIトークンが含まれる | 高 | ・CloudWatch Logs / OpenTelemetryでのログマスキング<br>・GuardrailsによるPII自動伏字化<br>・KMSによる保存時暗号化 |
| `TH-005` | **Denial of Service (DoS)** | 大量リクエストや悪意のある高コストプロンプトによるリソース枯渇 | 中 | ・API Gatewayレート制限（Throttle）<br>・Bedrock APIのトークン数上限設定<br>・CloudWatch Alarmsによる監視 |
| `TH-006` | **Elevation of Privilege (特権昇格)** | 一般ユーザーロールから管理者機能やHITL承認を不正実行 | 極大 | ・RBACポリシーチェック（コントローラー・サービス層）<br>・承認者と起票者の同一性排除（二者承認強制） |

---

## 3. 疑似侵入テスト（Penetration Testing）検証計画

セキュリティ監査担当サブエージェント（`security-auditor`）は、Phase 2の実装およびCI/CDテスト時に以下の疑似攻撃テストを自動実行します：

1. **テナント越境テスト (Cross-Tenant Access Test)**:
   - テナントAのトークンを用い、テナントBの `resource_id` に対する取得・更新・削除リクエストを発行し、確実に `404 Not Found` または `403 Forbidden` となることを検証。
2. **プロンプトインジェクション耐性テスト**:
   - 悪意ある脱獄プロンプト（「以前の指示をすべて無視して...」等）を入力し、Guardrailsおよびシステムプロンプトによって意図した挙動が維持されることを検証。
3. **パラメータ改ざん・未定義キーテスト**:
   - スキーマにない未知のキーや、特殊記号（`; DROP TABLE`, `../`）を含めたリクエストを送信し、ツール層（Pydantic/Zod）で確実に400エラーで拒否されることを検証。
