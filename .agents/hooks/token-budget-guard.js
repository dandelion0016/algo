#!/usr/bin/env node

/**
 * Token Budget Guard Hook (PreToolUse)
 *
 * Antigravity Lifecycle Hook
 * Prevents context exhaustion and token bloat by intercepting tool calls:
 * 1. `view_file`: Automatically slices huge files (>300 lines or lockfiles/huge data)
 *    to safe ranges (e.g. 1-250 lines) via `overwrite` when range is unspecified or excessive.
 * 2. `run_command`: Enforces pagination and output bounds on commands that tend to dump
 *    thousands of lines (e.g., `git log -n 20`, `npm list --depth=0`, `Get-ChildItem -Depth 3`).
 */

const fs = require('fs');
const path = require('path');

// Files that should never be read in full due to massive token bloat
const LOCKFILE_PATTERNS = [
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /poetry\.lock$/i,
  /Cargo\.lock$/i,
  /composer\.lock$/i,
  /Gemfile\.lock$/i
];

const HUGE_DATA_EXTENSIONS = new Set([
  '.log', '.csv', '.tsv', '.map', '.min.js', '.min.css'
]);

// Thresholds
const MAX_UNSLICED_LINES = 300;     // Files exceeding this will be sliced to DEFAULT_SLICE_LINES
const DEFAULT_SLICE_LINES = 250;    // Default lines to view if unspecified
const MAX_ALLOWED_SPAN = 400;       // Max span (EndLine - StartLine) allowed in a single view
const LOCKFILE_SLICE_LINES = 150;   // Stricter slice for lockfiles
const HUGE_FILE_SIZE_BYTES = 50 * 1024; // 50 KB

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

  // 1. Inspect view_file
  if (toolName === 'view_file') {
    const result = handleViewFile(args);
    if (result) {
      output(result);
      return;
    }
  }

  // 2. Inspect run_command
  if (toolName === 'run_command') {
    const result = handleRunCommand(args);
    if (result) {
      output(result);
      return;
    }
  }

  // Default allow
  output({ decision: 'allow' });
}

/**
 * Inspect and potentially overwrite view_file arguments.
 */
function handleViewFile(args) {
  const filePath = args.AbsolutePath;
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  let stat;
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
  } catch (err) {
    return null;
  }

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const hasStartLine = typeof args.StartLine === 'number' && args.StartLine > 0;
  const hasEndLine = typeof args.EndLine === 'number' && args.EndLine > 0;

  // Case A: Lockfiles (Massive JSON/YAML trees)
  const isLockfile = LOCKFILE_PATTERNS.some(p => p.test(fileName));
  if (isLockfile) {
    if (!hasStartLine && !hasEndLine) {
      return {
        decision: 'allow',
        reason: `【Token Saver】ロックファイル (${fileName}) は行数が極めて多くトークンを大量消費するため、閲覧範囲を先頭${LOCKFILE_SLICE_LINES}行に自動制限しました。特定パッケージを調査する場合は検索コマンド (grep / Select-String) や StartLine / EndLine を指定してください。`,
        overwrite: {
          StartLine: 1,
          EndLine: LOCKFILE_SLICE_LINES
        }
      };
    }
    if (hasStartLine && hasEndLine && (args.EndLine - args.StartLine > LOCKFILE_SLICE_LINES)) {
      const adjustedEnd = args.StartLine + LOCKFILE_SLICE_LINES;
      return {
        decision: 'allow',
        reason: `【Token Saver】ロックファイルの閲覧範囲（${args.EndLine - args.StartLine}行）が広すぎるため、トークン節約のため最大${LOCKFILE_SLICE_LINES}行（${args.StartLine}〜${adjustedEnd}）に補正しました。`,
        overwrite: {
          EndLine: adjustedEnd
        }
      };
    }
    return null;
  }

  // Case B: Huge data or log files
  const isHugeData = HUGE_DATA_EXTENSIONS.has(ext) || (stat.size > HUGE_FILE_SIZE_BYTES && ext === '.json');
  if (isHugeData) {
    if (!hasStartLine && !hasEndLine) {
      return {
        decision: 'allow',
        reason: `【Token Saver】大容量データ/ログファイル (${fileName}, ${(stat.size / 1024).toFixed(1)}KB) のため、トークン保護として先頭${DEFAULT_SLICE_LINES}行に自動制限しました。`,
        overwrite: {
          StartLine: 1,
          EndLine: DEFAULT_SLICE_LINES
        }
      };
    }
    if (hasStartLine && hasEndLine && (args.EndLine - args.StartLine > MAX_ALLOWED_SPAN)) {
      const adjustedEnd = args.StartLine + MAX_ALLOWED_SPAN;
      return {
        decision: 'allow',
        reason: `【Token Saver】データファイルの閲覧行数（${args.EndLine - args.StartLine}行）が上限（${MAX_ALLOWED_SPAN}行）を超えているため、トークン節約のため補正しました。`,
        overwrite: {
          EndLine: adjustedEnd
        }
      };
    }
  }

  // Case C: Standard source files - count lines if size is notable (>15KB)
  if (stat.size > 2 * 1024) {
    const lineCount = countLines(filePath);
    if (lineCount > MAX_UNSLICED_LINES) {
      if (!hasStartLine && !hasEndLine) {
        return {
          decision: 'allow',
          reason: `【Token Saver】ファイル (${fileName}, 計${lineCount}行) の全量読み込みによるToken Bloatを防ぐため、先頭${DEFAULT_SLICE_LINES}行に自動スライスしました。特定箇所を閲覧する場合は StartLine / EndLine を指定してください。`,
          overwrite: {
            StartLine: 1,
            EndLine: DEFAULT_SLICE_LINES
          }
        };
      }
      if (hasStartLine && hasEndLine && (args.EndLine - args.StartLine > MAX_ALLOWED_SPAN)) {
        const adjustedEnd = args.StartLine + MAX_ALLOWED_SPAN;
        return {
          decision: 'allow',
          reason: `【Token Saver】指定された行範囲（${args.EndLine - args.StartLine}行）が広すぎるため、トークン節約のため最大${MAX_ALLOWED_SPAN}行（${args.StartLine}〜${adjustedEnd}）に補正しました。`,
          overwrite: {
            EndLine: adjustedEnd
          }
        };
      }
    }
  }

  return null;
}

/**
 * Inspect and potentially overwrite run_command arguments.
 */
function handleRunCommand(args) {
  const cmd = (args.CommandLine || '').trim();
  if (!cmd) return null;

  const normalized = cmd.replace(/\s+/g, ' ');

  // 1. git log without count limiter (-n, -<num>, --max-count)
  // Match "git log" as a command or after pipes/semicolons
  if (/(^|[;&|]\s*)git\s+log\b/i.test(normalized)) {
    const hasLimit = /\s+(-n\b|--max-count\b|-[0-9]+)\b/i.test(normalized);
    if (!hasLimit) {
      // Inject -n 20 right after "git log"
      const modified = cmd.replace(/(\bgit\s+log\b)/i, '$1 -n 20');
      return {
        decision: 'allow',
        reason: '【Token Saver】git log に件数制限がない場合、大量のコミット履歴によりトークンが急速に枯渇するため、安全な件数 (-n 20) を自動付加しました。',
        overwrite: {
          CommandLine: modified
        }
      };
    }
  }

  // 2. npm / pnpm / yarn list without depth control
  if (/(^|[;&|]\s*)(npm|pnpm)\s+(list|ls)\b/i.test(normalized)) {
    const hasDepth = /--depth\b/i.test(normalized);
    if (!hasDepth) {
      const modified = cmd.replace(/(\b(npm|pnpm)\s+(list|ls)\b)/i, '$1 --depth=0');
      return {
        decision: 'allow',
        reason: '【Token Saver】npm/pnpm list の全依存ツリー展開による数万行の出力を防ぐため、自動的に "--depth=0" を付加しました。',
        overwrite: {
          CommandLine: modified
        }
      };
    }
  }

  // 3. PowerShell Get-ChildItem -Recurse without -Depth
  if (/(^|[;&|]\s*)(Get-ChildItem|gci|ls|dir)\b.*-Recurse\b/i.test(normalized)) {
    const hasDepth = /-Depth\b/i.test(normalized);
    if (!hasDepth) {
      const modified = cmd.replace(/(-Recurse\b)/i, '$1 -Depth 3');
      return {
        decision: 'allow',
        reason: '【Token Saver】再帰ファイル探索 (Get-ChildItem -Recurse) に階層制限がない場合、巨大なツリー出力でトークンを圧迫するため、"-Depth 3" を自動付加しました。',
        overwrite: {
          CommandLine: modified
        }
      };
    }
  }

  // 4. Unix find without -maxdepth
  if (/(^|[;&|]\s*)find\s+[\.\/~][^\n|;&]*$/i.test(normalized)) {
    const hasMaxDepth = /-maxdepth\b/i.test(normalized);
    if (!hasMaxDepth && !/-(name|type|mtime|size)/i.test(normalized)) {
      const modified = cmd.replace(/(\bfind\s+[\.\/~][^\s]*)/i, '$1 -maxdepth 3');
      return {
        decision: 'allow',
        reason: '【Token Saver】find コマンドに階層制限がないため、トークン保護として "-maxdepth 3" を自動付加しました。',
        overwrite: {
          CommandLine: modified
        }
      };
    }
  }

  // 5. Huge dump commands on lockfiles (e.g. cat package-lock.json, type package-lock.json)
  const isDumpingLockfile = /(^|[;&|]\s*)(cat|type|Get-Content|gc)\s+.*(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock)/i.test(normalized);
  if (isDumpingLockfile) {
    return {
      decision: 'deny',
      reason: '【Token Saver 拒否】ロックファイル（package-lock.json 等）をターミナルで丸ごと出力すると数万トークンを一気に消費します。必要な情報は view_file (先頭スライス付き) や jq、または検索コマンド (grep / Select-String) で特定箇所のみ参照してください。'
    };
  }

  return null;
}

/**
 * Fast line counter using buffered chunk reading.
 */
function countLines(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(32768);
    let count = 0;
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 10) count++; // \n
      }
    }
    fs.closeSync(fd);
    return count + 1;
  } catch (err) {
    return 0;
  }
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  handleViewFile,
  handleRunCommand,
  countLines
};
