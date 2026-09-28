const cp = require('child_process');
const path = require('path');

const hookConfig = require('../hooks.json');
const command = hookConfig['destructive-operation-guard'].PreToolUse[0].hooks[0].command;

console.log('Testing configured command:', command);

const testCases = [
  // --- GIT DESTRUCTIVE (DENY) ---
  {
    name: 'Git: Force Push with -f',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git push origin feature/test -f' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'Git: Force Push with --force',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git push --force origin my-branch' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'Git: Direct Push to main',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'Git: Delete main branch remotely',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git push origin :main' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'Git: Delete main branch locally with -D',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git branch -D main' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'Git: git clean -fd',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git clean -fd' } } },
    expectedDecision: 'deny'
  },

  // --- GIT HIGH RISK (FORCE_ASK) ---
  {
    name: 'Git: git reset --hard',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git reset --hard HEAD~1' } } },
    expectedDecision: 'force_ask'
  },
  {
    name: 'Git: git restore .',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git restore .' } } },
    expectedDecision: 'force_ask'
  },
  {
    name: 'Git: Delete topic branch with -D',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git branch -D feature/old-task' } } },
    expectedDecision: 'force_ask'
  },
  {
    name: 'Git: gh pr merge',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'gh pr merge 12 --auto --merge' } } },
    expectedDecision: 'force_ask'
  },

  // --- GIT SAFE (ALLOW) ---
  {
    name: 'Git: Push topic branch',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git push origin feature/issue-12-auth' } } },
    expectedDecision: 'allow'
  },
  {
    name: 'Git: git status / diff / commit',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'git status' } } },
    expectedDecision: 'allow'
  },

  // --- AWS DESTRUCTIVE (DENY) ---
  {
    name: 'AWS: Terraform destroy',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'terraform destroy -auto-approve' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: CDK destroy',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'cdk destroy --all' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: s3 rb (remove bucket)',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws s3 rb s3://my-prod-bucket --force' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: s3 rm recursive on bucket root',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws s3 rm s3://my-prod-bucket/ --recursive' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: dynamodb delete-table',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws dynamodb delete-table --table-name Users' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: rds delete-db-instance',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws rds delete-db-instance --db-instance-identifier main-db' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: ec2 terminate-instances',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws ec2 terminate-instances --instance-ids i-1234567890abcdef0' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: cloudformation delete-stack',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws cloudformation delete-stack --stack-name AppStack' } } },
    expectedDecision: 'deny'
  },
  {
    name: 'AWS: iam delete-role',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws iam delete-role --role-name AppExecutionRole' } } },
    expectedDecision: 'deny'
  },

  // --- AWS MODIFICATION (FORCE_ASK) ---
  {
    name: 'AWS: s3 rm specific object',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws s3 rm s3://my-bucket/temp/data.csv' } } },
    expectedDecision: 'force_ask'
  },
  {
    name: 'AWS: terraform apply',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'terraform apply tfplan' } } },
    expectedDecision: 'force_ask'
  },
  {
    name: 'AWS: cdk deploy',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'cdk deploy AppStack' } } },
    expectedDecision: 'force_ask'
  },

  // --- AWS READ / SAFE (ALLOW) ---
  {
    name: 'AWS: s3 ls',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws s3 ls s3://my-bucket/' } } },
    expectedDecision: 'allow'
  },
  {
    name: 'AWS: dynamodb describe-table',
    payload: { toolCall: { name: 'run_command', args: { CommandLine: 'aws dynamodb describe-table --table-name Users' } } },
    expectedDecision: 'allow'
  },

  // --- MCP TOOL (GITHUB) ---
  {
    name: 'MCP: delete_file on main (DENY)',
    payload: {
      toolCall: {
        name: 'call_mcp_tool',
        args: {
          ServerName: 'github-mcp-server',
          ToolName: 'delete_file',
          Arguments: { branch: 'main', path: 'src/index.ts' }
        }
      }
    },
    expectedDecision: 'deny'
  },
  {
    name: 'MCP: delete_file on feature (FORCE_ASK)',
    payload: {
      toolCall: {
        name: 'call_mcp_tool',
        args: {
          ServerName: 'github-mcp-server',
          ToolName: 'delete_file',
          Arguments: { branch: 'feature/issue-1', path: 'temp.txt' }
        }
      }
    },
    expectedDecision: 'force_ask'
  },
  {
    name: 'MCP: merge_pull_request (FORCE_ASK)',
    payload: {
      toolCall: {
        name: 'call_mcp_tool',
        args: {
          ServerName: 'github-mcp-server',
          ToolName: 'merge_pull_request',
          Arguments: { pull_number: 5 }
        }
      }
    },
    expectedDecision: 'force_ask'
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const res = cp.spawnSync(command, {
    cwd: path.resolve(__dirname, '..'),
    input: JSON.stringify(tc.payload),
    shell: true,
    encoding: 'utf-8'
  });

  let decision = 'unknown';
  try {
    const parsed = JSON.parse(res.stdout.trim());
    decision = parsed.decision;
  } catch (err) {
    console.error(`Failed to parse output for ${tc.name}:`, res.stdout, res.stderr);
  }

  if (decision === tc.expectedDecision) {
    console.log(`PASS: [${tc.expectedDecision.toUpperCase()}] ${tc.name}`);
    passed++;
  } else {
    console.error(`FAIL: ${tc.name} -> Expected ${tc.expectedDecision}, got ${decision}`);
    if (res.stdout) console.error('  stdout:', res.stdout.trim());
    if (res.stderr) console.error('  stderr:', res.stderr.trim());
    failed++;
  }
}

console.log(`\nTest Summary: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
if (failed > 0) {
  process.exit(1);
}
