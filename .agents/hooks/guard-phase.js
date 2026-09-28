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
    const targetFile = args.TargetFile || '';
    if (targetFile.includes('PROJECT_STATUS.md')) {
      const content = args.ReplacementContent || args.CodeContent || '';
      const instruction = args.Instruction || '';
      const description = args.Description || '';
      const combinedText = `${content}\n${instruction}\n${description}`;

      // Detection patterns for Phase transitions & Gate approvals
      const phaseTransitionPatterns = [
        // Changing current phase
        /カレントフェーズ.*Phase\s*(0-[ABC]|1|2)/i,
        // Changing gate approval state
        /ゲート承認状態.*(APPROVED|WAITING_USER_APPROVAL|BLOCKED)/i,
        // Checking off gate milestones (e.g., - [x] 🛑 Gate ...)
        /-\s*\[x\]\s*🛑\s*\*\*Gate/i,
        // Status transitions on Phase headers
        /Phase\s*(0-[ABC]|1|2)[^:\n]*:\s*.*\[(IN_PROGRESS|COMPLETED|WAITING_USER_APPROVAL)\]/i,
        // Keywords in instructions
        /(フェーズ|Phase).*(移行|完了|次フェーズ|進める|進める|approve)/i
      ];

      for (const pattern of phaseTransitionPatterns) {
        if (pattern.test(combinedText)) {
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
