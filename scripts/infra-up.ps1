#!/usr/bin/env pwsh
# ============================================================
# infra-up.ps1 — Start all infrastructure services
# Usage: .\scripts\infra-up.ps1
# ============================================================

Write-Host ""
Write-Host "🚀 Starting HRMS Portal infrastructure..." -ForegroundColor Cyan
Write-Host ""

# Check if podman-compose is available
if (-not (Get-Command podman-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ podman-compose not found." -ForegroundColor Red
    Write-Host "   Install it with: pip install podman-compose" -ForegroundColor Yellow
    exit 1
}

# Check if Podman is running
try {
    podman info *> $null
} catch {
    Write-Host "❌ Podman is not running. Please start Podman Desktop." -ForegroundColor Red
    exit 1
}

# Start services
podman-compose -f "$PSScriptRoot\..\podman-compose.yml" up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Infrastructure started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Service URLs:" -ForegroundColor White
    Write-Host "  ├── PostgreSQL    → localhost:5432 (db: hrms_dev)" -ForegroundColor Gray
    Write-Host "  ├── Redis         → localhost:6379" -ForegroundColor Gray
    Write-Host "  ├── Elasticsearch → http://localhost:9200" -ForegroundColor Gray
    Write-Host "  ├── MinIO (S3)    → http://localhost:9000" -ForegroundColor Gray
    Write-Host "  ├── MinIO Console → http://localhost:9001" -ForegroundColor Gray
    Write-Host "  └── Mailpit UI    → http://localhost:8025" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Run 'pnpm infra:status' to check service health." -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Failed to start infrastructure. Check the logs above." -ForegroundColor Red
    exit 1
}
