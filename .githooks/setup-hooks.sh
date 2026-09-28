#!/bin/sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-push 2>/dev/null || true
chmod +x .githooks/pre-commit 2>/dev/null || true
echo "✅ Git hooks path configured to .githooks (pre-commit & pre-push)"
