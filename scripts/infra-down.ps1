#!/usr/bin/env pwsh
# ============================================================
# infra-down.ps1 — Stop all infrastructure services
# Usage: .\scripts\infra-down.ps1
# Data volumes are PRESERVED (use infra-reset.ps1 to wipe)
# ============================================================

Write-Host ""
Write-Host "🛑 Stopping HRMS Portal infrastructure..." -ForegroundColor Yellow
Write-Host ""

podman-compose -f "$PSScriptRoot\..\podman-compose.yml" down

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Infrastructure stopped. Data volumes preserved." -ForegroundColor Green
    Write-Host "   Run 'pnpm infra:up' to start again." -ForegroundColor DarkGray
    Write-Host ""
}
