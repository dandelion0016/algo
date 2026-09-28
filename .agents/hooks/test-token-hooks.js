/**
 * Test Suite for Token Governance Lifecycle Hooks:
 * 1. token-budget-guard (PreToolUse)
 * 2. token-context-monitor (PreInvocation)
 */

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK_DIR = __dirname;
const hooksConfig = require('../hooks.json');

const guardCommand = hooksConfig['token-budget-guard'].PreToolUse[0].hooks[0].command;
const monitorCommand = hooksConfig['token-context-monitor'].PreInvocation[0].command;

console.log('Testing Guard Command  :', guardCommand);
console.log('Testing Monitor Command:', monitorCommand);

let passedTests = 0;
let failedTests = 0;

function runHookCommand(command, inputPayload) {
  const result = cp.spawnSync(command, {
    input: JSON.stringify(inputPayload),
    encoding: 'utf-8',
    shell: true,
    cwd: path.resolve(HOOK_DIR, '..')
  });

  if (result.error) {
    throw result.error;
  }

  const rawOutput = (result.stdout || '').trim();
  try {
    return JSON.parse(rawOutput);
  } catch (err) {
    console.error('Failed to parse JSON output:', rawOutput, 'stderr:', result.stderr);
    throw err;
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    failedTests++;
  }
}

console.log('\n--- Testing Token Budget Guard (PreToolUse) ---');

// 1. view_file: lockfile slicing
test('view_file: package-lock.json automatically sliced to 1-150', () => {
  const tmpLock = path.join(os.tmpdir(), 'dummy-package-lock.json');
  fs.writeFileSync(tmpLock, '{\n  "name": "dummy",\n  "version": "1.0.0"\n}\n');

  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'view_file',
      args: { AbsolutePath: tmpLock }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.ok(res.overwrite, 'Should include overwrite');
  assert.strictEqual(res.overwrite.StartLine, 1);
  assert.strictEqual(res.overwrite.EndLine, 150);
  assert.ok(res.reason.includes('Token Saver'));
});

// 2. view_file: large file (>300 lines) slicing
test('view_file: large file (>300 lines) sliced to 1-250', () => {
  const tmpLarge = path.join(os.tmpdir(), 'dummy-large-file.ts');
  const lines = Array.from({ length: 450 }, (_, i) => `// Line ${i + 1}`).join('\n');
  fs.writeFileSync(tmpLarge, lines);

  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'view_file',
      args: { AbsolutePath: tmpLarge }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.ok(res.overwrite, 'Should include overwrite');
  assert.strictEqual(res.overwrite.StartLine, 1);
  assert.strictEqual(res.overwrite.EndLine, 250);
  assert.ok(res.reason.includes('Token Saver'));
});

// 3. view_file: small file (<300 lines, small size) not sliced
test('view_file: small file allowed without overwrite', () => {
  const tmpSmall = path.join(os.tmpdir(), 'dummy-small.ts');
  fs.writeFileSync(tmpSmall, 'console.log("hello world");\n');

  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'view_file',
      args: { AbsolutePath: tmpSmall }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.strictEqual(res.overwrite, undefined);
});

// 4. run_command: git log without limit
test('run_command: git log automatically appends -n 20', () => {
  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'git log --oneline' }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.ok(res.overwrite, 'Should include overwrite');
  assert.strictEqual(res.overwrite.CommandLine, 'git log -n 20 --oneline');
  assert.ok(res.reason.includes('Token Saver'));
});

// 5. run_command: git log with -n 5 is untouched
test('run_command: git log -n 5 remains unchanged', () => {
  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'git log -n 5' }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.strictEqual(res.overwrite, undefined);
});

// 6. run_command: npm list automatically appends --depth=0
test('run_command: npm list automatically appends --depth=0', () => {
  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'npm list' }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.ok(res.overwrite, 'Should include overwrite');
  assert.strictEqual(res.overwrite.CommandLine, 'npm list --depth=0');
});

// 7. run_command: Get-ChildItem -Recurse automatically appends -Depth 3
test('run_command: Get-ChildItem -Recurse automatically appends -Depth 3', () => {
  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'Get-ChildItem -Recurse' }
    }
  });

  assert.strictEqual(res.decision, 'allow');
  assert.ok(res.overwrite, 'Should include overwrite');
  assert.strictEqual(res.overwrite.CommandLine, 'Get-ChildItem -Recurse -Depth 3');
});

// 8. run_command: dumping lockfile directly is DENIED
test('run_command: type package-lock.json is DENIED', () => {
  const res = runHookCommand(guardCommand, {
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'type package-lock.json' }
    }
  });

  assert.strictEqual(res.decision, 'deny');
  assert.ok(res.reason.includes('Token Saver 拒否'));
});

console.log('\n--- Testing Token Context Monitor (PreInvocation) ---');

const testConvId = `test-conv-${Date.now()}`;

// 9. PreInvocation: Normal steps (step 5) -> no injection
test('PreInvocation: Step 5 yields no injected steps', () => {
  const res = runHookCommand(monitorCommand, {
    invocationNum: 1,
    initialNumSteps: 5,
    conversationId: testConvId
  });

  assert.ok(Array.isArray(res.injectSteps));
  assert.strictEqual(res.injectSteps.length, 0);
});

// 10. PreInvocation: Warning threshold (step 20) -> injects warning
test('PreInvocation: Step 20 injects guidance message', () => {
  const res = runHookCommand(monitorCommand, {
    invocationNum: 2,
    initialNumSteps: 20,
    conversationId: testConvId
  });

  assert.ok(Array.isArray(res.injectSteps));
  assert.strictEqual(res.injectSteps.length, 1);
  assert.ok(res.injectSteps[0].ephemeralMessage.includes('Token Governance'));
});

// 11. PreInvocation: Rate limiting (step 21) -> no duplicate injection
test('PreInvocation: Step 21 suppressed by rate limiter', () => {
  const res = runHookCommand(monitorCommand, {
    invocationNum: 3,
    initialNumSteps: 21,
    conversationId: testConvId
  });

  assert.ok(Array.isArray(res.injectSteps));
  assert.strictEqual(res.injectSteps.length, 0);
});

// 12. PreInvocation: Alert threshold (step 35) -> level upgrade bypasses rate limit and injects alert
test('PreInvocation: Step 35 upgrades to Alert and injects bloat warning', () => {
  const res = runHookCommand(monitorCommand, {
    invocationNum: 4,
    initialNumSteps: 35,
    conversationId: testConvId
  });

  assert.ok(Array.isArray(res.injectSteps));
  assert.strictEqual(res.injectSteps.length, 1);
  assert.ok(res.injectSteps[0].ephemeralMessage.includes('Token Bloat Alert'));
});

console.log(`\n=== Test Summary: ${passedTests} passed, ${failedTests} failed ===`);
if (failedTests > 0) {
  process.exit(1);
}
