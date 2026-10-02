#!/usr/bin/env node

/**
 * Test Integrity & Anti-Tampering Verifier
 *
 * 個人開発の軽快さを損なわずに、PR作成時やCI、コミット前に
 * テストの完全性・骨抜きアサーション・スキップ・改ざんを一括検証するスクリプト。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = process.cwd();

// テストファイルの検索
function findTestFiles(dir, fileList) {
  fileList = fileList || [];
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        findTestFiles(fullPath, fileList);
      }
    } else if (
      file.endsWith('.test.ts') ||
      file.endsWith('.test.tsx') ||
      file.endsWith('.spec.ts') ||
      file.endsWith('.spec.tsx') ||
      file.endsWith('.test.js') ||
      file.endsWith('.spec.js')
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 静的解析ルール
const BANNED_PATTERNS = [
  {
    name: 'Test Skip (スキップ・無効化)',
    regex: /\b(it|test|describe)\.skip\s*\(/g,
    severity: 'ERROR',
    description: 'テストケースがスキップされています。無効化せず適切に修正してください。'
  },
  {
    name: 'Dummy Assertion (形骸化したダミー検証)',
    regex: /expect\s*\(\s*(true|false|1|0|'test'|"test")\s*\)\s*\.\s*toBe\s*\(\s*\1\s*\)/g,
    severity: 'ERROR',
    description: 'expect(true).toBe(true) などの形骸化したアサーションが検出されました。'
  },
  {
    name: 'Commented Out Assertion (コメントアウトされた検証)',
    regex: /\/\/\s*expect\s*\(/g,
    severity: 'WARN',
    description: 'アサーションがコメントアウトされています。不要なら削除するか有効化してください。'
  }
];

function analyzeTestFiles(files) {
  let issues = [];
  let totalTests = 0;
  let totalAssertions = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    // テスト件数・アサーション数の概算カウント
    const testMatches = content.match(/\b(it|test)\s*\(/g);
    if (testMatches) totalTests += testMatches.length;

    const assertionMatches = content.match(/expect\s*\(/g);
    if (assertionMatches) totalAssertions += assertionMatches.length;

    // パターンチェック
    for (const rule of BANNED_PATTERNS) {
      const matches = content.match(rule.regex);
      if (matches) {
        issues.push({
          file: relativePath,
          rule: rule.name,
          severity: rule.severity,
          count: matches.length,
          description: rule.description
        });
      }
    }
  }

  return { issues, totalTests, totalAssertions };
}

// Git Diff によるアサーション数増減チェック
function checkGitDiff() {
  try {
    const diffOutput = execSync('git diff origin/main...HEAD -- "src/**/__tests__/*" "e2e/*" 2>nul || git diff HEAD -- "src/**/__tests__/*" "e2e/*"', { encoding: 'utf-8' });
    if (!diffOutput.trim()) return null;

    let addedAssertions = 0;
    let removedAssertions = 0;

    const lines = diffOutput.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const m = line.match(/expect\s*\(/g);
        if (m) addedAssertions += m.length;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const m = line.match(/expect\s*\(/g);
        if (m) removedAssertions += m.length;
      }
    }

    return { addedAssertions, removedAssertions };
  } catch (e) {
    return null;
  }
}

function main() {
  console.log('🔍 テスト完全性・骨抜き防止（Test Integrity）の検証を開始します...\n');

  const testFiles = findTestFiles(path.join(ROOT_DIR, 'src')).concat(findTestFiles(path.join(ROOT_DIR, 'e2e')));
  console.log(`📁 検出されたテストファイル: ${testFiles.length} 件`);

  const { issues, totalTests, totalAssertions } = analyzeTestFiles(testFiles);
  const diffInfo = checkGitDiff();

  console.log(`📊 総テストケース数: ${totalTests} 件`);
  console.log(`🎯 総アサーション (expect) 数: ${totalAssertions} 件`);

  if (diffInfo) {
    console.log(`📈 差分アサーション: +${diffInfo.addedAssertions} / -${diffInfo.removedAssertions}`);
    if (diffInfo.removedAssertions > diffInfo.addedAssertions && diffInfo.removedAssertions > 5) {
      issues.push({
        file: 'Git Diff',
        rule: 'Assertion Reduction Warning',
        severity: 'WARN',
        count: diffInfo.removedAssertions - diffInfo.addedAssertions,
        description: '既存アサーションの削除数が追加数を上回っています。テスト弱体化がないか確認してください。'
      });
    }
  }

  console.log('\n--- 監査結果サマリ ---');

  if (issues.length === 0) {
    console.log('✅ PASS: スキップされたテストや骨抜きアサーションは検出されませんでした。');
    console.log('✨ テストの完全性が保たれています。\n');
    process.exit(0);
  } else {
    console.log(`⚠️ 検知された課題: ${issues.length} 件\n`);
    let hasError = false;

    console.table(issues.map(i => ({
      'ファイル': i.file,
      '重要度': i.severity,
      '違反ルール': i.rule,
      '件数': i.count,
      '詳細': i.description
    })));

    for (const issue of issues) {
      if (issue.severity === 'ERROR') {
        hasError = true;
      }
    }

    if (hasError) {
      console.error('\n❌ ERROR: 重大なテスト完全性違反が検出されました。PR作成前に修正してください。');
      process.exit(1);
    } else {
      console.log('\n⚠️ WARN: 警告事項があります。内容を確認してください。');
      process.exit(0);
    }
  }
}

main();
