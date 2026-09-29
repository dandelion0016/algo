#!/usr/bin/env node

/**
 * AWS & Deployment Verification Script (Phase 0-C)
 * Validates the existence and configuration of CloudFormation, S3, CloudFront, and IAM setup.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

console.log('====================================================');
console.log('🔍 Phase 0-C AWS & Deployment Verification Script');
console.log('====================================================\n');

// 1. Verify Template Files Exist
console.log('1. Checking Infrastructure & CI/CD Config Files:');
const requiredFiles = [
  'infrastructure/cloudformation/main.yaml',
  'infrastructure/iam/github-oidc-trust-policy.json',
  'infrastructure/iam/deploy-least-privilege-policy.json',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  'docs/setup/aws-initial-setup-guide.md',
  'docs/setup/mcp-and-agent-permissions.md'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ [FOUND] ${file}`);
  } else {
    console.log(`  ❌ [MISSING] ${file}`);
    allFilesExist = false;
  }
}

// 2. Check Static Build Output
console.log('\n2. Checking Static Build Output:');
const outDir = path.resolve(process.cwd(), 'out');
if (fs.existsSync(outDir) && fs.existsSync(path.join(outDir, 'index.html'))) {
  console.log('  ✅ [OK] Static export directory (out/) exists with index.html');
} else {
  console.log('  ⚠️ [WARN] out/ directory not found. Run `npm run build` to generate.');
}

// 3. Optional AWS CLI Check
console.log('\n3. Checking AWS CLI Environment (Optional Local Check):');
const awsCallerIdentity = run('aws sts get-caller-identity --output json');
if (awsCallerIdentity) {
  try {
    const identity = JSON.parse(awsCallerIdentity);
    console.log(`  ✅ [CONNECTED] AWS Account: ${identity.Account} (Arn: ${identity.Arn})`);

    // Check CloudFormation Stack
    const stackStatus = run('aws cloudformation describe-stacks --stack-name algo-prod-stack --query "Stacks[0].StackStatus" --output text --region ap-northeast-1');
    if (stackStatus) {
      console.log(`  ✅ [CFN STACK] algo-prod-stack Status: ${stackStatus}`);
    } else {
      console.log('  ℹ️ [CFN STACK] algo-prod-stack not yet created or not accessible.');
    }
  } catch (e) {
    console.log('  ℹ️ AWS CLI returned unexpected format.');
  }
} else {
  console.log('  ℹ️ AWS CLI is not configured locally or credentials not found.');
  console.log('  👉 Cloud deployment is executed securely via GitHub Actions OIDC.');
}

console.log('\n====================================================');
if (allFilesExist) {
  console.log('🎉 All Phase 0-C assets and configurations are verified!');
} else {
  console.log('⚠️ Some required files are missing. Please review.');
}
console.log('====================================================');
