#!/usr/bin/env node

/**
 * Source File Auto-Format & Linter Hook
 *
 * Antigravity Lifecycle Hook (PostToolUse) & Git Hook (pre-commit)
 * Automatically runs formatting (Prettier, Biome, built-in whitespace/newline/JSON normalizer)
 * and linting/syntax checks (ESLint, Ruff, Python py_compile, Node vm syntax validator)
 * whenever source files are created or modified via `write_to_file` or `replace_file_content`.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vm = require('vm');

// Target source file extensions to format and lint
const SOURCE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx',
  '.json', '.jsonc',
  '.yaml', '.yml',
  '.py',
  '.go',
  '.rs',
  '.html', '.htm',
  '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.ps1',
  '.md', '.markdown',
  '.sql'
]);

// Ignored directories and patterns
const IGNORED_PATTERNS = [
  /[\\/]\.git[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/](dist|build|out|\.next|\.nuxt|\.output)[\\/]/,
  /[\\/]coverage[\\/]/,
  /[\\/]\.gemini[\\/]/,
  /[\\/]package-lock\.json$/,
  /[\\/]pnpm-lock\.yaml$/,
  /[\\/]yarn\.lock$/,
  /\.min\.(js|css)$/
];

function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    // If stdin cannot be read, continue cleanly
    rawInput = '';
  }

  let payload = {};
  if (rawInput && rawInput.trim()) {
    try {
      payload = JSON.parse(rawInput);
    } catch (err) {
      payload = {};
    }
  }

  // 1. Resolve Target Files from stdin payload, CLI arguments, or recent git changes
  const targetFiles = resolveTargetFiles(payload);

  if (targetFiles.length === 0) {
    output({});
    return;
  }

  let formattedCount = 0;
  let errorCount = 0;

  for (const filePath of targetFiles) {
    if (!shouldProcessFile(filePath)) {
      continue;
    }

    try {
      const result = processFile(filePath);
      if (result.formatted) formattedCount++;
      if (result.errors && result.errors.length > 0) {
        errorCount += result.errors.length;
        for (const err of result.errors) {
          console.error(`⚠️  [Auto-Format/Lint Error] ${path.basename(filePath)}: ${err}`);
        }
      } else if (result.formatted) {
        console.error(`✨ [Auto-Format/Lint] Formatted: ${path.relative(process.cwd(), filePath) || path.basename(filePath)} (${result.details.join(', ')})`);
      }
    } catch (err) {
      console.error(`⚠️  [Auto-Format/Lint Failed] ${filePath}: ${err.message}`);
    }
  }

  // PostToolUse always returns {}
  output({});
}

/**
 * Resolves list of file paths to inspect and format.
 */
function resolveTargetFiles(payload) {
  const files = new Set();

  // A. From CLI arguments (e.g. pre-commit hook or manual run)
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg && !arg.startsWith('-') && fs.existsSync(arg)) {
      files.add(path.resolve(arg));
    }
  }

  // B. From ToolCall payload (write_to_file / replace_file_content)
  const toolCall = payload.toolCall || {};
  const args = toolCall.args || payload.toolArgs || payload.args || {};

  if (args.TargetFile) {
    files.add(path.resolve(args.TargetFile));
  }

  // C. Fallback: Check transcriptPath if available
  if (files.size === 0 && payload.transcriptPath && fs.existsSync(payload.transcriptPath)) {
    try {
      const lines = fs.readFileSync(payload.transcriptPath, 'utf-8').trim().split('\n');
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
        const line = lines[i].trim();
        if (!line) continue;
        const entry = JSON.parse(line);
        if (entry.tool_calls && Array.isArray(entry.tool_calls)) {
          for (const tc of entry.tool_calls) {
            if (tc.args && tc.args.TargetFile) {
              files.add(path.resolve(tc.args.TargetFile));
            }
          }
        }
        if (files.size > 0) break;
      }
    } catch (e) {
      // Transcript read fallback ignore
    }
  }

  // D. Fallback: If still empty, check git status for newly created or modified files in working directory
  if (files.size === 0) {
    try {
      const gitStatus = cp.execSync('git status --porcelain -uall', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = gitStatus.split('\n');
      for (const line of lines) {
        const status = line.substring(0, 2);
        const relPath = line.substring(3).trim();
        if (relPath && (status.includes('M') || status.includes('A') || status.includes('?'))) {
          const absPath = path.resolve(process.cwd(), relPath);
          if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
            files.add(absPath);
          }
        }
      }
    } catch (e) {
      // Git command fallback ignore
    }
  }

  return Array.from(files);
}

/**
 * Checks if a file is an eligible source file for formatting/linting.
 */
function shouldProcessFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Processes a single file: formats and runs linter/syntax checks.
 */
function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const details = [];
  const errors = [];

  // ==========================================
  // 1. Built-in Normalization (Zero-dependency)
  // ==========================================

  // 1-A. JSON Formatting & Validation
  if (ext === '.json' || ext === '.jsonc') {
    try {
      const parsed = JSON.parse(content);
      const formattedJson = JSON.stringify(parsed, null, 2) + '\n';
      if (formattedJson !== content) {
        content = formattedJson;
        details.push('JSON formatted');
      }
    } catch (err) {
      errors.push(`JSON SyntaxError: ${err.message}`);
    }
  } else {
    // 1-B. General Whitespace & Trailing Newline Normalization
    let lines = content.split(/\r?\n/);
    let modifiedLines = false;

    // Trim trailing whitespace (except intentional 2 spaces in Markdown)
    const isMarkdown = ext === '.md' || ext === '.markdown';
    lines = lines.map(line => {
      if (isMarkdown && line.endsWith('  ') && !line.endsWith('   ')) {
        // preserve 2 spaces for markdown line break
        return line;
      }
      const trimmed = line.replace(/[ \t]+$/, '');
      if (trimmed !== line) modifiedLines = true;
      return trimmed;
    });

    let newContent = lines.join('\n');

    // Ensure single newline at end of file
    newContent = newContent.replace(/\n+$/, '') + '\n';
    if (newContent !== content) {
      content = newContent;
      details.push('Normalized whitespace & trailing newline');
    }
  }

  // Save changes if modified by built-in normalizer
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  // ==========================================
  // 2. Syntax & Lint Checks (Zero-dependency)
  // ==========================================

  // 2-A. JavaScript Syntax Validation via Node vm
  if (['.js', '.mjs', '.cjs'].includes(ext)) {
    try {
      new vm.Script(content, { filename: filePath });
    } catch (err) {
      errors.push(`JS SyntaxError: ${err.message}`);
    }
  }

  // 2-B. Python Syntax Validation (if python is available)
  if (ext === '.py') {
    try {
      cp.execSync(`python -m py_compile "${filePath}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      const msg = err.stderr ? err.stderr.toString().trim() : err.message;
      if (msg && !msg.includes('python: not found') && !msg.includes('is not recognized')) {
        errors.push(`Python SyntaxError: ${msg.split('\n')[0]}`);
      }
    }
  }

  // ==========================================
  // 3. External Tool Auto-Formatter & Linter
  // ==========================================
  const externalResult = runExternalTools(filePath, ext);
  if (externalResult.formatted) {
    details.push(...externalResult.details);
  }
  if (externalResult.errors && externalResult.errors.length > 0) {
    errors.push(...externalResult.errors);
  }

  const finalContent = fs.readFileSync(filePath, 'utf-8');
  return {
    formatted: finalContent !== originalContent || details.length > 0,
    details: Array.from(new Set(details)),
    errors
  };
}

/**
 * Runs project-specific external formatters/linters if present.
 */
function runExternalTools(filePath, ext) {
  const details = [];
  const errors = [];
  let formatted = false;

  const cwd = process.cwd();

  // A. Prettier (if prettier is available in node_modules or global)
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.yaml', '.yml', '.css', '.scss', '.html', '.md'].includes(ext)) {
    try {
      const hasLocalPrettier = fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'prettier')) ||
                               fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'prettier.cmd'));
      if (hasLocalPrettier) {
        cp.execSync(`npx --no-install prettier --write "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'], cwd });
        formatted = true;
        details.push('Prettier');
      }
    } catch (e) {
      // Prettier execution failed or not installed locally, continue
    }
  }

  // B. ESLint (if eslint is configured locally)
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    try {
      const hasLocalEslint = fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'eslint')) ||
                             fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'eslint.cmd'));
      if (hasLocalEslint) {
        cp.execSync(`npx --no-install eslint --fix "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'], cwd });
        formatted = true;
        details.push('ESLint --fix');
      }
    } catch (e) {
      // Ignore eslint failure or unconfigured rules
    }
  }

  // C. Biome (if biome.json exists)
  if (fs.existsSync(path.join(cwd, 'biome.json')) || fs.existsSync(path.join(cwd, 'biome.jsonc'))) {
    try {
      cp.execSync(`npx --no-install @biomejs/biome format --write "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'], cwd });
      formatted = true;
      details.push('Biome format');
    } catch (e) {}
  }

  // D. Ruff for Python (if ruff is installed)
  if (ext === '.py') {
    try {
      cp.execSync(`ruff format "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      cp.execSync(`ruff check --fix "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      formatted = true;
      details.push('Ruff');
    } catch (e) {}
  }

  // E. gofmt for Go (if go is installed)
  if (ext === '.go') {
    try {
      cp.execSync(`gofmt -w "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      formatted = true;
      details.push('gofmt');
    } catch (e) {}
  }

  // F. rustfmt for Rust (if rustfmt is installed)
  if (ext === '.rs') {
    try {
      cp.execSync(`rustfmt "${filePath}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      formatted = true;
      details.push('rustfmt');
    } catch (e) {}
  }

  return { formatted, details, errors };
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

main();
