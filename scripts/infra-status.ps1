#!/usr/bin/env pwsh
# ============================================================
# infra-status.ps1 — Show health status of all services
# Usage: .\scripts\infra-status.ps1
# ============================================================

Write-Host ""
Write-Host "📊 HRMS Portal — Infrastructure Status" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Container status
$containers = @("hrms_postgres", "hrms_redis", "hrms_elasticsearch", "hrms_minio", "hrms_mailpit")
$allHealthy = $true

foreach ($container in $containers) {
    $info = podman inspect $container 2>$null | ConvertFrom-Json 2>$null
    if ($null -eq $info) {
        Write-Host "  ❌ $container — NOT RUNNING" -ForegroundColor Red
        $allHealthy = $false
        continue
    }

    $state  = $info[0].State.Status
    $health = $info[0].State.Health.Status

    $icon = switch ($state) {
        "running" { if ($health -eq "healthy" -or $null -eq $health) { "✅" } elseif ($health -eq "starting") { "⏳" } else { "⚠️" } }
        "exited"  { "🔴" }
        default   { "❓" }
    }

    $healthStr = if ($health) { " ($health)" } else { "" }
    Write-Host "  $icon $container — $state$healthStr" -ForegroundColor $(
        if ($state -eq "running") { "Green" } else { "Red" }
    )
    if ($state -ne "running") { $allHealthy = $false }
}

Write-Host ""
Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray

if ($allHealthy) {
    Write-Host ""
    Write-Host "  Service Endpoints:" -ForegroundColor White
    Write-Host "  ├── PostgreSQL    → postgresql://localhost:5432/hrms_dev" -ForegroundColor DarkGray
    Write-Host "  ├── Redis         → redis://localhost:6379" -ForegroundColor DarkGray
    Write-Host "  ├── Elasticsearch → http://localhost:9200" -ForegroundColor DarkGray
    Write-Host "  ├── MinIO API     → http://localhost:9000" -ForegroundColor DarkGray
    Write-Host "  ├── MinIO Console → http://localhost:9001  (admin UI)" -ForegroundColor DarkGray
    Write-Host "  └── Mailpit UI    → http://localhost:8025  (email catcher)" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  ⚠️  Some services are not running." -ForegroundColor Yellow
    Write-Host "  Run 'pnpm infra:up' to start them." -ForegroundColor DarkGray
    Write-Host ""
}
