---
trigger: model_decision
description: 要件定義FIX後の水平タスク分解および初期フェーズのタスク肥大化防止ルール
---

# 自律型タスク分解・Issue起票ルール

## 1. 0→1（初期構築時）のタスク肥大化防止ガードレール
- **初期フェーズでの水平分割の禁止**:
  - プロジェクト初期（Phase 0）では、「環境構築Issue」「DB単体Issue」「UI単体Issue」などと細かくIssueを分割してはならない。
  - 初期は **`[Phase 0] 要件定義とWalking Skeleton構築`** という単一の包括的Issue（またはローカルブランチ作業）として扱い、DB・API・フロントの初期設定を一気通貫で自律構築すること。
  - 初期作業の進捗は、Issue本文のチェックリスト（`- [ ]`）で消化すること。

---

## 2. 初期フェーズ完了後の水平タスク分解（Phase 1）
要件定義（Phase 0-A）、設計書FIX（Phase 0-B）、および環境整備・疎通確認（Phase 0-C）が完了した段階で、承認済み設計書群（`docs/design/`）に基づき、初めて以下の基準で水平タスクへ分解・起票する。

### タスク分解の基準
- **1 Issue = 1 PR の粒度**:
  - 独立して実装・テスト・レビューが完結する単位に分割する。
- **専門領域（水平）別の分割**:
  - `role:frontend`: 画面UI実装、HITL承認モーダル、APIクライアント、状態管理
  - `role:backend`: APIエンドポイント実装、バリデーション、業務ロジック
  - `role:db`: スキーマ実装、マイグレーション、RLSポリシー適用
  - `role:infra`: クラウド基盤構築、IaCコード化、ネットワーク・セキュリティグループ、IAMポリシー設定
  - `role:security`: テナント越境テスト、権限昇格テスト、監査ログ検査
  - `role:ops`: 監視アラート実装、CI/CD脆弱性スキャン、Runbook検証
  - `role:agentic`: LLM連携、Guardrails、分散トレース

### 起票フォーマット例
```bash
gh issue create --title "<領域名>: <具体的な作業内容>" \
  --body "## 目的\n<docs/design/<領域>/該当設計書への参照>\n\n## スコープ・作業内容\n- [ ] <タスク1>\n- [ ] <タスク2>\n\n## セキュリティ・ガバナンス要件\n- @agent-security-governance.md の基準に準拠\n\n## 完了条件 (Acceptance Criteria)\n- [ ] 単体・結合テストがPassすること\n- [ ] 同領域レビュアーのLGTM\n\n---\n参照設計書: docs/design/<領域>/... / 要件定義書: specs/requirements.md" \
  --label "<roleラベル>,status:todo"
```

---

## 3. 着手承認ゲート
- すべての水平タスクIssueを起票後、チャットで一覧を報告し、**ユーザーから着手承認を得るまで各担当サブエージェントを起動してはならない**。
