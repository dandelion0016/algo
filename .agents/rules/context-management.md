---
trigger: model_decision
description: Claude風の動的ワークフロー、サブエージェントによるコンテキストオフロード、セッションリフレッシュ運用ルール
---

# 動的コンテキスト管理（Token Bloat防止）ルール

エージェントは会話履歴のコンテキスト溢れ（Context Exhaustion / Token Bloat）を防止するため、以下の原則を徹底して運用すること。

---

## 1. サブエージェントへのコンテキスト・オフロード (Subagent Offloading)
- **大量のファイル探索やテスト実行をメインセッションで行わない**:
  - 詳細なコード読み込み、複数ファイルのリファクタリング、ビルドやテスト実行は、必ず対応する専門サブエージェント（`.agents/subagents/`）に `invoke_subagent` で委任すること。
- **メインコンテキストへは「要約」のみを還元**:
  - サブエージェントは自身のコンテキスト内で探索・実装・テストを完結させ、メインエージェント（管理者）には「変更ファイル一覧」「合否結果」「Diffサマリ」のみを報告すること。

---

## 2. 状態の外部化と「1 Issue = 1 Session」運用 (Externalized State)
- **会話履歴に状態を溜め込まない**:
  - 現在のフェーズやゲート承認状態は `PROJECT_STATUS.md`、仕様は `specs/requirements.md`、詳細設計は `docs/design/`、進捗は GitHub Issue 本文、レビュー基準は `docs/review-checklists/` に必ずファイルとして書き出すこと。
- **作業単位ごとのセッションリフレッシュ（使い捨てセッション）**:
  - 1つのIssueやマイルストーンが完了したら、同じ会話スレッドを延々と続けず、セッションを新規開始（または `/clear`）すること。
  - 新しいセッションではエージェントはまず `PROJECT_STATUS.md` を読み込み、外部化されたファイルから即座に必要な文脈のみを把握し、コンテキスト使用量ゼロ（100%クリーン）で作業を開始できる。

---

## 3. ルール・スキルの遅延ロード (Progressive Disclosure)
- ルールやスキルは常時システムプロンプトに常駐させず、必要な局面（`model_decision`、`glob`、`@メンション`）でのみオンデマンドに注入すること。

---

## 4. ターミナルログのトランケーション
- 巨大なビルドログやテスト出力は、プロンプトに全行貼り付けず、エラー発生箇所のヘッド/テイルのみを要約して扱うこと。

---

## 5. ライフサイクルフックによるトークン消費の機械的抑制・監視 (Token Governance Hooks)
プロンプト指示だけに頼らず、.agents/hooks.json の Antigravity Lifecycle Hook により機械的なトークン抑制とコンテキスト監視を実施する：
- **トークン予算ガード (	oken-budget-guard.js / PreToolUse)**:
  - iew_file: 巨大ファイル（>300行）やロックファイル（package-lock.json等）の全量読み込み要求を検知し、overwrite により安全な行範囲（先頭150〜250行）に自動スライスする。
  - un_command: 件数制限のない git log（自動 -n 20 付加）や、依存展開のない
pm list（自動 --depth=0 付加）、再帰探索 Get-ChildItem -Recurse（自動 -Depth 3 付加）を自動補正。ターミナルへのロックファイル全量ダンプ（cat package-lock.json 等）は機械的に deny（遮断）する。
- **トークン・コンテキストモニター (	oken-context-monitor.js / PreInvocation)**:
  - モデル推論前に累積ステップ数（initialNumSteps）およびトランスクリプトサイズ（	ranscriptPath）を監視。
  - 累積20ステップで注意喚起、35ステップで Token Bloat Alert を ephemeralMessage として動的注入し、サブエージェント委任およびセッションリフレッシュ（/clear）を機械的にガイドする（過剰通知防止レートリミット内蔵）。
