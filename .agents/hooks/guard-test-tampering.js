#!/usr/bin/env node

/**
 * Test Tampering & Reward Hacking Guard Hook
 *
 * Antigravity Lifecycle Hook (PreToolUse)
 * Intercepts tool executions to prevent autonomous AI agents from
 * rewriting, weakening, or tampering with existing test assertions
 * (Specification Gaming / Goodhart's Law / Reward Hacking).
 */

const fs = require('fs');

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

  const toolName = toolCall.name;
  const args = toolCall.args || {};

  // Intercept file modifications to test suites
  if (toolName === 'replace_file_content' || toolName === 'write_to_file') {
    const targetFile = (args.TargetFile || '').replace(/\\/g, '/');
    const isTestFile =
      targetFile.includes('/__tests__/') ||
      targetFile.endsWith('.test.ts') ||
      targetFile.endsWith('.test.tsx') ||
      targetFile.endsWith('.spec.ts') ||
      targetFile.endsWith('.spec.tsx');

    if (isTestFile) {
      const fileExists = fs.existsSync(targetFile);

      // If modifying an existing test file, require Human-in-the-loop approval
      if (toolName === 'replace_file_content' || (toolName === 'write_to_file' && fileExists)) {
        output({
          decision: 'force_ask',
          reason: `⚠️【Test Integrity Guard / リワードハッキング防止】既存のテストファイル (${targetFile.split('/').pop()}) の変更が検知されました。GEMINI.md原則15に基づき、AIによるテスト期待値の改ざん・骨抜き（Specification Gaming）を防ぐため、人間ゲートキーパーの明示的承認が必要です。`
        });
        return;
      }
    }
  }

  // Allow all other operations
  output({ decision: 'allow' });
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

main();
