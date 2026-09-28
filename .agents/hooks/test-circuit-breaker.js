#!/usr/bin/env node

/**
 * Test Circuit Breaker Hook
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const HOOK_SCRIPT = path.join(__dirname, 'circuit-breaker.js');
const TEST_CONVERSATION_ID = 'test-session-circuit-breaker-' + Date.now();
const STATE_FILE = path.join(os.tmpdir(), `antigravity-circuit-breaker-${TEST_CONVERSATION_ID}.json`);

function runHook(payload) {
  const input = JSON.stringify(payload);
  const result = execSync(`node "${HOOK_SCRIPT}"`, {
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return JSON.parse(result.trim());
}

try {
  console.log('Testing Circuit Breaker Hook...');

  // Clean up any old state
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

  // Test 1: Single command should allow
  const res1 = runHook({
    conversationId: TEST_CONVERSATION_ID,
    toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } }
  });
  assert.strictEqual(res1.decision, 'allow', 'First command should be allowed');
  console.log('  [PASS] 1st command allowed');

  // Test 2: Repeat up to 4 times (all should allow)
  for (let i = 2; i <= 4; i++) {
    const res = runHook({
      conversationId: TEST_CONVERSATION_ID,
      toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } }
    });
    assert.strictEqual(res.decision, 'allow', `Command ${i} should be allowed`);
  }
  console.log('  [PASS] Commands 2-4 allowed');

  // Test 3: 5th command should trip breaker and force_ask
  const res5 = runHook({
    conversationId: TEST_CONVERSATION_ID,
    toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } }
  });
  assert.strictEqual(res5.decision, 'force_ask', '5th identical command should trip circuit breaker');
  assert.ok(res5.reason.includes('サーキットブレーカー発動'), 'Reason should explain circuit breaker trip');
  console.log('  [PASS] 5th identical command tripped circuit breaker (force_ask)');

  // Clean up
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

  console.log('ALL CIRCUIT BREAKER TESTS PASSED!');
} catch (err) {
  console.error('Test failed:', err);
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  process.exit(1);
}
