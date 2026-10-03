#!/usr/bin/env node

/**
 * Documentation Integrity & Atomic Sync Verifier
 *
 * コードと設計書群（docs/design/）の完全同期を機械的に検証するスクリプト。
 * UIコンポーネント、コアライブラリモジュール、監査イベント、永続化キーストアの
 * 設計書への記載漏れ・Documentation Driftを検知しブロックする。
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

// ファイル読込ヘルパー
function readFileSafe(relativeFilePath) {
  const fullPath = path.join(ROOT_DIR, relativeFilePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

// ディレクトリ再帰走査（テスト・隠しファイル除外）
function getSourceFiles(dir, extension) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules' && entry.name !== '.next') {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        if (!entry.name.endsWith(`.test.${extension.slice(1)}`) &&
            !entry.name.endsWith(`.spec.${extension.slice(1)}`)) {
          results.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return results;
}

// 1. UIコンポーネント整合性検証
function verifyComponents(docContents) {
  const compDir = path.join(ROOT_DIR, 'src', 'components');
  const files = getSourceFiles(compDir, '.tsx');
  const issues = [];
  const checked = [];

  const targetDocs = [
    'docs/design/frontend/screen-flow.md',
    'docs/design/frontend/screen-specs.md'
  ];

  const combinedDocText = targetDocs
    .map(doc => docContents[doc] || '')
    .join('\n');

  for (const file of files) {
    const compName = path.basename(file, '.tsx');
    checked.push(compName);
    if (!combinedDocText.includes(compName)) {
      issues.push({
        category: 'UI Component',
        identifier: compName,
        sourceFile: path.relative(ROOT_DIR, file).replace(/\\/g, '/'),
        expectedIn: targetDocs.join(' または ')
      });
    }
  }

  return { checked, issues };
}

// 2. バックエンド/コアライブラリ整合性検証
function verifyLibModules(docContents) {
  const libDir = path.join(ROOT_DIR, 'src', 'lib');
  const files = getSourceFiles(libDir, '.ts');
  const issues = [];
  const checked = [];

  const targetDocs = [
    'docs/design/backend/api-spec.md',
    'docs/design/backend/error-handling.md'
  ];

  const combinedDocText = targetDocs
    .map(doc => docContents[doc] || '')
    .join('\n');

  for (const file of files) {
    const moduleName = path.basename(file, '.ts');
    checked.push(moduleName);
    if (!combinedDocText.includes(moduleName)) {
      issues.push({
        category: 'Lib Module',
        identifier: moduleName,
        sourceFile: path.relative(ROOT_DIR, file).replace(/\\/g, '/'),
        expectedIn: targetDocs.join(' または ')
      });
    }
  }

  return { checked, issues };
}

// 3. 監査イベント整合性検証
function verifyAuditEvents(docContents) {
  const issues = [];
  const checked = [];
  const targetDoc = 'docs/design/security/audit-logging.md';
  const docText = docContents[targetDoc] || '';

  const auditTypeFile = 'src/types/audit.ts';
  const content = readFileSafe(auditTypeFile);

  if (!content) {
    issues.push({
      category: 'Audit Event',
      identifier: 'N/A',
      sourceFile: auditTypeFile,
      expectedIn: `${auditTypeFile} not found`
    });
    return { checked, issues };
  }

  // export type AuditEventType = 'GAME_INIT' | ... からイベント種別を抽出
  const match = content.match(/export\s+type\s+AuditEventType\s*=\s*([^;]+);/);
  if (!match) {
    issues.push({
      category: 'Audit Event',
      identifier: 'AuditEventType',
      sourceFile: auditTypeFile,
      expectedIn: 'AuditEventType definition found'
    });
    return { checked, issues };
  }

  const events = [...match[1].matchAll(/'([A-Z0-9_]+)'/g)].map(m => m[1]);

  for (const ev of events) {
    checked.push(ev);
    if (!docText.includes(ev)) {
      issues.push({
        category: 'Audit Event',
        identifier: ev,
        sourceFile: auditTypeFile,
        expectedIn: targetDoc
      });
    }
  }

  return { checked, issues };
}

// 4. クライアント永続化キー整合性検証
function verifyStorageKeys(docContents) {
  const issues = [];
  const checked = new Set();
  const targetDoc = 'docs/design/database/schema-spec.md';
  const docText = docContents[targetDoc] || '';

  // ソースコードから algo_ で始まるキーを抽出
  const sourceFiles = [
    ...getSourceFiles(path.join(ROOT_DIR, 'src', 'lib'), '.ts'),
    ...getSourceFiles(path.join(ROOT_DIR, 'src', 'components'), '.tsx')
  ];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/'(algo_[a-zA-Z0-9_]+)'/g) || [];
    for (const m of matches) {
      const key = m.slice(1, -1);
      checked.add(key);
    }
  }

  // 既知の永続化キーも確実に検証対象に含める
  const requiredKeys = [
    'algo_player_stats',
    'algo_player_achievements',
    'algo_user_id',
    'algo_nickname',
    'algo_tutorial_completed',
    'algo_tutorial_skip_prompt',
    'algo_sound_enabled',
    'algo_assist_enabled'
  ];

  for (const key of requiredKeys) {
    checked.add(key);
  }

  const checkedList = Array.from(checked).sort();

  for (const key of checkedList) {
    if (!docText.includes(key)) {
      issues.push({
        category: 'Storage Key',
        identifier: key,
        sourceFile: 'src/(lib|components)',
        expectedIn: targetDoc
      });
    }
  }

  return { checked: checkedList, issues };
}

function main() {
  console.log('🔍 ドキュメント整合性とアトミック同期（Doc Integrity）の検証を開始します...\n');

  // 必要ドキュメントの一括読み込み
  const requiredDocs = [
    'docs/design/frontend/screen-flow.md',
    'docs/design/frontend/screen-specs.md',
    'docs/design/backend/api-spec.md',
    'docs/design/backend/error-handling.md',
    'docs/design/security/audit-logging.md',
    'docs/design/database/schema-spec.md'
  ];

  const docContents = {};
  let missingDocs = false;

  for (const doc of requiredDocs) {
    const text = readFileSafe(doc);
    if (text === null) {
      console.error(`❌ エラー: 必須設計書が存在しません: ${doc}`);
      missingDocs = true;
    } else {
      docContents[doc] = text;
    }
  }

  if (missingDocs) {
    process.exit(1);
  }

  const compResult = verifyComponents(docContents);
  const libResult = verifyLibModules(docContents);
  const auditResult = verifyAuditEvents(docContents);
  const storageResult = verifyStorageKeys(docContents);

  console.log(`📁 1. UIコンポーネント: ${compResult.checked.length} 件検証`);
  console.log(`⚙️  2. バックエンド/コアモジュール: ${libResult.checked.length} 件検証`);
  console.log(`🛡️  3. 監査イベント種別: ${auditResult.checked.length} 件検証`);
  console.log(`💾 4. クライアント永続化キー: ${storageResult.checked.length} 件検証`);

  const allIssues = [
    ...compResult.issues,
    ...libResult.issues,
    ...auditResult.issues,
    ...storageResult.issues
  ];

  console.log('\n--- ドキュメント整合性 監査結果サマリ ---');

  if (allIssues.length === 0) {
    console.log('✅ PASS: 全てのUIコンポーネント、コアモジュール、監査イベント、永続化キーが設計書に網羅されています。');
    console.log('✨ コードと設計書の完全なアトミック同期が確認されました。\n');
    process.exit(0);
  } else {
    console.error(`❌ ERROR: 設計書との乖離（Documentation Drift）が検知されました: ${allIssues.length} 件\n`);

    console.table(allIssues.map(i => ({
      'カテゴリ': i.category,
      '識別子': i.identifier,
      '対象コード': i.sourceFile,
      '期待される記載設計書': i.expectedIn
    })));

    console.error('\n💡 設計書（docs/design/）に上記識別子を追記し、コードと設計書をアトミックに同期してください。');
    process.exit(1);
  }
}

main();
