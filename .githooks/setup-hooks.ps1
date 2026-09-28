# Setup Git Hooks for Antigravity Governance Starter
git config core.hooksPath .githooks
Write-Host "✅ Git hooks path configured to .githooks" -ForegroundColor Green
Write-Host "Active hooks: pre-commit (auto-format & lint), pre-push (branch & force-push guards)" -ForegroundColor Cyan
Write-Host "Protected branches: main, master" -ForegroundColor Cyan
