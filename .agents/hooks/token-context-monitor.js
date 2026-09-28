#!/usr/bin/env node

/**
 * Token & Context Monitor Hook (PreInvocation)
 *
 * Antigravity Lifecycle Hook
 * Runs before each model invocation to monitor conversation context scale
 * (cumulative steps and transcript size).
 * Injects guidance / alerts via ephemeralMessage when Token Bloat thresholds are reached,
 * enforcing Subagent Offloading and 1-Issue-1-Session hygiene.
 *
 * Features rate-limiting to avoid wasteful duplicate system messages.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Step thresholds
const STEP_NOTICE_THRESHOLD = 20;    // Notice: consider subagent offloading
const STEP_ALERT_THRESHOLD = 35;     // Alert: heavy context, save state and /clear
const MIN_STEP_INTERVAL = 10;        // Min steps between consecutive notices

// Transcript size thresholds
const TRANSCRIPT_WARN_BYTES = 250 * 1024;  // 250 KB
const TRANSCRIPT_ALERT_BYTES = 500 * 1024; // 500 KB

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    output({ injectSteps: [] });
    return;
  }

  if (!rawInput || !rawInput.trim()) {
    output({ injectSteps: [] });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    output({ injectSteps: [] });
    return;
  }

  const steps = typeof payload.initialNumSteps === 'number' ? payload.initialNumSteps : 0;
  const conversationId = payload.conversationId || 'default-session';
  const transcriptPath = payload.transcriptPath || '';

  // Check transcript file size if present
  let transcriptBytes = 0;
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      transcriptBytes = fs.statSync(transcriptPath).size;
    } catch (e) {
      transcriptBytes = 0;
    }
  }

  // Determine current bloat level
  let currentLevel = 'normal';
  if (steps >= STEP_ALERT_THRESHOLD || transcriptBytes >= TRANSCRIPT_ALERT_BYTES) {
    currentLevel = 'alert';
  } else if (steps >= STEP_NOTICE_THRESHOLD || transcriptBytes >= TRANSCRIPT_WARN_BYTES) {
    currentLevel = 'warning';
  }

  if (currentLevel === 'normal') {
    output({ injectSteps: [] });
    return;
  }

  // Rate limiting check using temp state file
  const stateFilePath = path.join(os.tmpdir(), `antigravity-token-monitor-${sanitize(conversationId)}.json`);
  let state = { lastNotifiedStep: 0, lastNotifiedLevel: 'normal' };
  try {
    if (fs.existsSync(stateFilePath)) {
      state = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
    }
  } catch (e) {
    // ignore state read errors
  }

  const stepsSinceLast = steps - (state.lastNotifiedStep || 0);
  const isLevelUpgrade = (state.lastNotifiedLevel === 'warning' && currentLevel === 'alert');

  // Only notify if level upgraded or enough steps elapsed
  if (!isLevelUpgrade && stepsSinceLast < MIN_STEP_INTERVAL) {
    output({ injectSteps: [] });
    return;
  }

  // Save new notification state
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify({
      lastNotifiedStep: steps,
      lastNotifiedLevel: currentLevel,
      updatedAt: new Date().toISOString()
    }), 'utf-8');
  } catch (e) {
    // ignore state write errors
  }

  // Compose guidance message
  let message = '';
  const transcriptSizeStr = transcriptBytes > 0 ? ` (トランスクリプト ${(transcriptBytes / 1024).toFixed(0)}KB)` : '';

  if (currentLevel === 'alert') {
    message = `⚠️ 【Token Bloat Alert / コンテキスト肥大化警告】
現在のセッションは累積 ${steps} ステップ${transcriptSizeStr}に達しており、コンテキストウィンドウが大幅に消費されています。
推論の精度劣化やトークン浪費を防ぐため、以下の運用ルールを徹底してください：
1. 現在の進捗や決定事項を 'PROJECT_STATUS.md' や Issue、設計書に直ちに書き出して永続化してください。
2. 以降の作業は会話を継続せず、セッションをリフレッシュ（新規チャットまたは '/clear'）して状態ゼロから再開してください。
3. コード探索やビルド・テストの実行は必ず専門サブエージェント（invoke_subagent）へ委任してください。`;
  } else {
    message = `ℹ️ 【Token Governance / コンテキスト管理ガイダンス】
セッションが ${steps} ステップ${transcriptSizeStr}に達しました。Token Bloat防止のため以下を推奨します：
- 探索やテスト実行はサブエージェント（.agents/subagents/）に委任し、メインコンテキストを軽量に保ってください。
- 現在のタスク完了後は、状態を外部ファイル（PROJECT_STATUS.md）に保存し、セッションをリフレッシュ（1 Issue 1 Session）してください。`;
  }

  output({
    injectSteps: [
      {
        ephemeralMessage: message
      }
    ]
  });
}

function sanitize(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  STEP_NOTICE_THRESHOLD,
  STEP_ALERT_THRESHOLD,
  MIN_STEP_INTERVAL
};
