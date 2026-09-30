#!/usr/bin/env pwsh
# ============================================================
# infra-reset.ps1 — WIPE all data and restart fresh
# ⚠️  WARNING: All database data, Redis keys, and MinIO files
#              will be permanently deleted.
# Usage: .\scripts\infra-reset.ps1
# ============================================================

Write-Host ""
Write-Host "⚠️  HRMS Portal — Infrastructure Reset" -ForegroundColor Yellow
Write-Host "   This will PERMANENTLY DELETE all local data." -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "   Type 'RESET' to confirm"

if ($confirm -ne "RESET") {
    Write-Host ""
    Write-Host "   Aborted. No changes made." -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "🗑️  Stopping and removing all containers + volumes..." -ForegroundColor Yellow
podman-compose -f "$PSScriptRoot\..\podman-compose.yml" down -v

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to stop containers." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting fresh infrastructure..." -ForegroundColor Cyan
podman-compose -f "$PSScriptRoot\..\podman-compose.yml" up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Infrastructure reset complete. All data wiped and services restarted." -ForegroundColor Green
    Write-Host "   Remember to re-run: pnpm --filter @hrms/api prisma migrate dev" -ForegroundColor DarkYellow
    Write-Host "   And re-seed:        pnpm --filter @hrms/api prisma db seed" -ForegroundColor DarkYellow
    Write-Host ""
} else {
    Write-Host "❌ Failed to restart infrastructure." -ForegroundColor Red
    exit 1
}
