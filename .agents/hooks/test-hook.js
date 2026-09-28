const cp = require('child_process');
const path = require('path');

const hookConfig = require('../hooks.json');
const command = hookConfig['phase-transition-guard'].PreToolUse[0].hooks[0].command;

console.log('Testing configured command:', command);

// Test from .agents cwd
const payload = JSON.stringify({
  toolCall: {
    name: 'replace_file_content',
    args: {
      TargetFile: 'f:\\path\\PROJECT_STATUS.md',
      ReplacementContent: '| **カレントフェーズ** | **Phase 0-B** |'
    }
  }
});

const resFromAgents = cp.spawnSync(command, {
  cwd: path.resolve(__dirname, '..'),
  input: payload,
  shell: true,
  encoding: 'utf-8'
});

console.log('Result from .agents cwd:');
console.log('  Exit code:', resFromAgents.status);
console.log('  Output   :', resFromAgents.stdout.trim());
if (resFromAgents.stderr) console.log('  Error    :', resFromAgents.stderr.trim());

// Test from repo root cwd
const resFromRoot = cp.spawnSync(command, {
  cwd: path.resolve(__dirname, '../..'),
  input: payload,
  shell: true,
  encoding: 'utf-8'
});

console.log('Result from repo root cwd:');
console.log('  Exit code:', resFromRoot.status);
console.log('  Output   :', resFromRoot.stdout.trim());
if (resFromRoot.stderr) console.log('  Error    :', resFromRoot.stderr.trim());
