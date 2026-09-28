const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const hookConfig = require('../hooks.json');
const command = hookConfig['source-format-lint-hook'].PostToolUse[0].hooks[0].command;

console.log('Testing configured command:', command);

const testDir = path.resolve(__dirname, 'test-temp');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name} ->`, err.message);
    failed++;
  }
}

try {
  // Test 1: JSON Formatting & Syntax
  runTest('JSON formatting & indentation', () => {
    const testFile = path.join(testDir, 'sample.json');
    fs.writeFileSync(testFile, '{"name":"antigravity",   "version":  "1.0.0"}', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: testFile }
      }
    });

    const res = cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    const formatted = fs.readFileSync(testFile, 'utf-8');
    const expected = JSON.stringify({ name: 'antigravity', version: '1.0.0' }, null, 2) + '\n';
    if (formatted !== expected) {
      throw new Error(`Formatted JSON does not match expected.\nGot:\n${formatted}\nExpected:\n${expected}`);
    }
  });

  // Test 2: Whitespace trimming and trailing newline in JS
  runTest('JS whitespace trimming and trailing newline normalization', () => {
    const testFile = path.join(testDir, 'sample.js');
    const messyCode = 'const x = 10;   \nfunction test() {   \n  return x * 2;\n}';
    fs.writeFileSync(testFile, messyCode, 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: testFile }
      }
    });

    const res = cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    const formatted = fs.readFileSync(testFile, 'utf-8');
    const expected = 'const x = 10;\nfunction test() {\n  return x * 2;\n}\n';
    if (formatted !== expected) {
      throw new Error(`Formatted JS does not match expected.\nGot:\n${JSON.stringify(formatted)}\nExpected:\n${JSON.stringify(expected)}`);
    }
  });

  // Test 3: Markdown intentional 2-space line break preservation
  runTest('Markdown preserves intentional 2 trailing spaces for line breaks', () => {
    const testFile = path.join(testDir, 'doc.md');
    const markdownContent = '# Heading\nLine one with break  \nLine two with excess spaces    \n';
    fs.writeFileSync(testFile, markdownContent, 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'replace_file_content',
        args: { TargetFile: testFile }
      }
    });

    cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    const formatted = fs.readFileSync(testFile, 'utf-8');
    const expected = '# Heading\nLine one with break  \nLine two with excess spaces\n';
    if (formatted !== expected) {
      throw new Error(`Formatted Markdown does not match expected.\nGot:\n${JSON.stringify(formatted)}\nExpected:\n${JSON.stringify(expected)}`);
    }
  });

  // Test 4: JavaScript Syntax Error Detection
  runTest('JS syntax error detection logs warning without crashing', () => {
    const testFile = path.join(testDir, 'invalid.js');
    fs.writeFileSync(testFile, 'const a = ; // syntax error\n', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: testFile }
      }
    });

    const res = cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    if (!res.stderr.includes('JS SyntaxError') && !res.stderr.includes('SyntaxError')) {
      throw new Error(`Expected stderr to mention SyntaxError, got: ${res.stderr}`);
    }
  });

  // Test 5: JSON Syntax Error Detection
  runTest('JSON syntax error detection logs warning without crashing', () => {
    const testFile = path.join(testDir, 'invalid.json');
    fs.writeFileSync(testFile, '{"broken": true,}\n', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: testFile }
      }
    });

    const res = cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    if (!res.stderr.includes('JSON SyntaxError') && !res.stderr.includes('SyntaxError')) {
      throw new Error(`Expected stderr to mention JSON SyntaxError, got: ${res.stderr}`);
    }
  });

  // Test 6: CLI Argument invocation (for pre-commit git hook)
  runTest('CLI argument invocation processes files directly', () => {
    const testFile = path.join(testDir, 'cli-test.json');
    fs.writeFileSync(testFile, '{"cli":123}', 'utf-8');

    const scriptPath = path.resolve(__dirname, 'auto-format-lint.js');
    const res = cp.spawnSync(process.execPath, [scriptPath, testFile], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    const formatted = fs.readFileSync(testFile, 'utf-8');
    const expected = JSON.stringify({ cli: 123 }, null, 2) + '\n';
    if (formatted !== expected) {
      throw new Error(`CLI formatted JSON does not match expected.\nGot:\n${formatted}`);
    }
  });

  // Test 7: Execution from Project Root CWD (Path resolution test)
  runTest('Command succeeds when executed from repository root directory', () => {
    const testFile = path.join(testDir, 'root-cwd.json');
    fs.writeFileSync(testFile, '{"root":true}', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: testFile }
      }
    });

    const res = cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '../..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    const formatted = fs.readFileSync(testFile, 'utf-8');
    const expected = JSON.stringify({ root: true }, null, 2) + '\n';
    if (formatted !== expected) {
      throw new Error(`Root CWD formatted JSON does not match expected.\nGot:\n${formatted}`);
    }
  });

  // Test 8: CSS / HTML Whitespace and Newline Normalization
  runTest('CSS and HTML whitespace and newline normalization', () => {
    const cssFile = path.join(testDir, 'style.css');
    fs.writeFileSync(cssFile, '.btn {  \n  color: red;  \n}\n\n\n', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: cssFile }
      }
    });

    cp.spawnSync(command, {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      shell: true,
      encoding: 'utf-8'
    });

    const formatted = fs.readFileSync(cssFile, 'utf-8');
    const expected = '.btn {\n  color: red;\n}\n';
    if (formatted !== expected) {
      throw new Error(`Formatted CSS does not match expected.\nGot:\n${JSON.stringify(formatted)}\nExpected:\n${JSON.stringify(expected)}`);
    }
  });

  // Test 9: PowerShell fallback script execution
  runTest('PowerShell fallback script executes successfully', () => {
    const psFile = path.join(testDir, 'ps-test.json');
    fs.writeFileSync(psFile, '{"ps":1}', 'utf-8');

    const payload = JSON.stringify({
      toolCall: {
        name: 'write_to_file',
        args: { TargetFile: psFile }
      }
    });

    const ps1Script = path.resolve(__dirname, 'auto-format-lint.ps1');
    const res = cp.spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Script], {
      cwd: path.resolve(__dirname, '..'),
      input: payload,
      encoding: 'utf-8'
    });

    if (res.stdout.trim() !== '{}') {
      throw new Error(`Expected stdout '{}', got: ${res.stdout}`);
    }

    const formatted = fs.readFileSync(psFile, 'utf-8');
    if (!formatted.includes('"ps": 1') && !formatted.includes('"ps":  1')) {
      throw new Error(`PowerShell formatted JSON unexpected: ${formatted}`);
    }
  });

} finally {
  // Clean up temp directory
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch (e) {}
}

console.log(`\n========================================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
console.log(`========================================`);
if (failed > 0) {
  process.exit(1);
}
