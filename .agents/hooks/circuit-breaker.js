#!/usr/bin/env node

/**
 * Circuit Breaker Hook (PreToolUse)
 *
 * Antigravity Lifecycle Hook
 * Prevents runaway infinite loops, repetitive failed retries, and unbounded API billing/token burn
 * during autonomous agent executions (such as @autonomous-gap-resolver in Phase 1).
 *
 * If the agent repeats the same command (e.g. failing tests/builds) or edits the same file
 * more than the defined threshold within a short window, the breaker trips and forces Human-in-the-loop (force_ask).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration thresholds
const MAX_CONSECUTIVE_IDENTICAL_COMMANDS = 5; // e.g. running 'npm test' 5 times in a row
const MAX_CONSECUTIVE_FILE_EDITS = 6;         // e.g. modifying the exact same file 6 times in a row
const MAX_ACTIONS_WINDOW_COUNT = 30;          // max total tool actions within time window
const TIME_WINDOW_MS = 3 * 60 * 1000;         // 3 minutes rolling window

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    output({ decision: 'allow' });
    return;
  }

  if (!rawInput || !rawInput.trim()) {
    output({ decision: 'allow' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    output({ decision: 'allow' });
    return;
  }

  const toolCall = payload.toolCall;
  if (!toolCall || !toolCall.name) {
    output({ decision: 'allow' });
    return;
  }

  const conversationId = payload.conversationId || 'default-session';
  const toolName = toolCall.name;
  const args = toolCall.args || {};

  const stateFilePath = path.join(os.tmpdir(), `antigravity-circuit-breaker-${sanitize(conversationId)}.json`);

  let state = {
    history: [], // [{ toolName, key, timestamp }]
    tripped: false
  };

  try {
    if (fs.existsSync(stateFilePath)) {
      state = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
      if (!Array.isArray(state.history)) {
        state.history = [];
      }
    }
  } catch (e) {
    state = { history: [], tripped: false };
  }

  const now = Date.now();
  // Filter history to current rolling window
  state.history = state.history.filter(item => (now - item.timestamp) < TIME_WINDOW_MS);

  // Generate action signature key
  let actionKey = '';
  if (toolName === 'run_command') {
    actionKey = (args.CommandLine || '').trim();
  } else if (toolName === 'replace_file_content' || toolName === 'write_to_file') {
    actionKey = path.normalize((args.TargetFile || '').trim());
  } else if (toolName === 'call_mcp_tool') {
    actionKey = `${args.ServerName || ''}:${args.ToolName || ''}`;
  } else {
    actionKey = toolName;
  }

  // 1. Check consecutive identical command executions
  if (toolName === 'run_command' && actionKey) {
    const identicalCount = countConsecutiveMatches(state.history, 'run_command', actionKey);
    if (identicalCount >= (MAX_CONSECUTIVE_IDENTICAL_COMMANDS - 1)) {
      output({
        decision: 'force_ask',
        reason: `【サーキットブレーカー発動 (Circuit Breaker)】同一コマンド（\`${actionKey}\`）が ${identicalCount + 1} 回連続して実行されようとしています。エラーやテスト失敗の無限リトライループ、過剰なAPI課金・トークン消費を防止するため、自律実行を一時停止しました。実装方針やエラー原因を確認し、指示を入力するか承認してください。`
      });
      return;
    }
  }

  // 2. Check consecutive file modifications (Flapping edit loop)
  if ((toolName === 'replace_file_content' || toolName === 'write_to_file') && actionKey) {
    const editCount = countConsecutiveMatches(state.history, ['replace_file_content', 'write_to_file'], actionKey);
    if (editCount >= (MAX_CONSECUTIVE_FILE_EDITS - 1)) {
      output({
        decision: 'force_ask',
        reason: `【サーキットブレーカー発動 (Circuit Breaker)】同一ファイル（\`${path.basename(actionKey)}\`）に対する編集が短時間に ${editCount + 1} 回連続して試行されています。試行錯誤によるコンテキスト汚染や無限編集ループを防ぐため一時停止しました。方針を確認してください。`
      });
      return;
    }
  }

  // 3. Check rapid action spree
  if (state.history.length >= MAX_ACTIONS_WINDOW_COUNT) {
    output({
      decision: 'force_ask',
      reason: `【サーキットブレーカー発動 (Circuit Breaker)】直近3分間でツール呼び出し回数が ${state.history.length + 1} 回に達しました。急激なトークン消費とコスト高騰を防止するため、一旦実行を停止して人間の承認を求めます。`
    });
    return;
  }

  // Record this action and save state
  state.history.push({
    toolName,
    key: actionKey,
    timestamp: now
  });

  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    // ignore state write errors
  }

  output({ decision: 'allow' });
}

function countConsecutiveMatches(history, toolNameOrArray, matchKey) {
  let count = 0;
  const isMatchTool = (name) => {
    if (Array.isArray(toolNameOrArray)) {
      return toolNameOrArray.includes(name);
    }
    return name === toolNameOrArray;
  };

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (isMatchTool(item.toolName) && item.key === matchKey) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

main();
