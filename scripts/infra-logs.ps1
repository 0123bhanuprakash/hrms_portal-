#!/usr/bin/env pwsh
# ============================================================
# infra-logs.ps1 — Tail logs from all (or one) service
# Usage:
#   .\scripts\infra-logs.ps1              # all services
#   .\scripts\infra-logs.ps1 postgres     # specific service
#   .\scripts\infra-logs.ps1 redis -n 50  # last 50 lines
# ============================================================

param(
    [string]$Service = "",
    [int]$Lines = 100
)

$composeFile = "$PSScriptRoot\..\podman-compose.yml"

Write-Host ""
Write-Host "📋 HRMS Portal — Container Logs" -ForegroundColor Cyan
if ($Service) {
    Write-Host "   Service: $Service (last $Lines lines, following...)" -ForegroundColor DarkGray
} else {
    Write-Host "   All services (following... Press Ctrl+C to stop)" -ForegroundColor DarkGray
}
Write-Host ""

if ($Service) {
    podman-compose -f $composeFile logs --tail=$Lines -f $Service
} else {
    podman-compose -f $composeFile logs --tail=$Lines -f
}
