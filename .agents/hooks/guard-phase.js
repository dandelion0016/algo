#!/usr/bin/env node

/**
 * Phase Transition & Critical Operation Guard Hook
 *
 * Antigravity Lifecycle Hook (PreToolUse)
 * Intercepts tool executions to enforce Human-in-the-loop (HITL) approval
 * even when running in Turbo mode (Auto-Execution / Always-Allow).
 */

const fs = require('fs');

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    // If stdin cannot be read, fail open to avoid completely breaking the agent loop
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

  const toolName = toolCall.name;
  const args = toolCall.args || {};

  // 1. Guard PROJECT_STATUS.md Phase & Gate Changes
  if (toolName === 'replace_file_content' || toolName === 'write_to_file') {
    const targetFile = (args.TargetFile || '').replace(/\\/g, '/');
    if (targetFile.endsWith('PROJECT_STATUS.md')) {
      const content = args.ReplacementContent || args.CodeContent || '';

      // Detection patterns for Phase transitions & Gate approvals in actual content
      const phaseTransitionPatterns = [
        // Changing current phase
        /\|\s*\*\*カレントフェーズ\*\*\s*\|/i,
        // Checking off gate milestones (e.g., - [x] 🛑 Gate ...)
        /-\s*\[x\]\s*🛑.*Gate/i,
        // Marking gate approval state as APPROVED
        /ゲート承認状態.*\|\s*.*(APPROVED|承認完了)/i
      ];

      for (const pattern of phaseTransitionPatterns) {
        if (pattern.test(content)) {
          output({
            decision: 'force_ask',
            reason: '【Phase移行・ゲート承認ガード】PROJECT_STATUS.md におけるフェーズ移行またはゲート承認ステータスの変更が検知されました。Turboモードを中断し、ユーザーの明示的な承認を要求します。'
          });
          return;
        }
      }
    }
  }

  // 2. Guard Critical Git / PR Operations
  if (toolName === 'run_command') {
    const commandLine = args.CommandLine || '';

    // Direct push to main or PR merge
    const criticalCommandPatterns = [
      /git\s+push.*(\borigin\s+main\b|\bmain\b)/i,
      /gh\s+pr\s+merge/i,
      /git\s+merge\s+(feature|main)/i
    ];

    for (const pattern of criticalCommandPatterns) {
      if (pattern.test(commandLine)) {
        output({
          decision: 'force_ask',
          reason: `【クリティカル操作ガード】重要コマンド（${commandLine.trim()}）の実行が検知されました。Turboモードを中断し、ユーザーの承認を要求します。`
        });
        return;
      }
    }
  }

  // Default: Allow standard operations
  output({ decision: 'allow' });
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

main();
