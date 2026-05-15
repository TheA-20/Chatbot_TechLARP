# ============================================================
# update.ps1 — Actualiza la app en el servidor desde casa
# Requisito: VPN UC3M activa (https://www.uc3m.es/sdic/servicios/vpn)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\update.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$SERVER_IP   = "163.117.137.118"
$SERVER_USER = "chatbot"

# ── 1. Subir cambios a GitHub ─────────────────────────────
Write-Host "=================================================="
Write-Host "  TechLARP — Publicar cambios"
Write-Host "=================================================="
Write-Host ""
Write-Host "[1/3] Subiendo cambios a GitHub..."

$LOCAL_DIR = Split-Path -Parent $PSScriptRoot
Push-Location $LOCAL_DIR

# Comprobar si hay cambios
$status = git status --porcelain
if ($status) {
    $msg = Read-Host "  Mensaje del commit (Enter para usar 'Update')"
    if (-not $msg) { $msg = "Update" }
    git add -A
    git commit -m $msg
    git push origin main
    Write-Host "  → Cambios subidos a GitHub"
} else {
    Write-Host "  → Sin cambios locales que subir"
}
Pop-Location

# ── 2. Verificar VPN ─────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Verificando acceso al servidor..."
$ping = Test-Connection -ComputerName $SERVER_IP -Count 1 -Quiet 2>$null
if (-not $ping) {
    Write-Host ""
    Write-Host "  ERROR: No se puede alcanzar $SERVER_IP"
    Write-Host "  Asegurate de estar conectado a la VPN de UC3M:"
    Write-Host "  https://www.uc3m.es/sdic/servicios/vpn"
    exit 1
}
Write-Host "  → Servidor accesible"

# ── 3. Desplegar en el servidor ───────────────────────────
Write-Host ""
Write-Host "[3/3] Desplegando en el servidor..."
& ssh "${SERVER_USER}@${SERVER_IP}" "bash ~/deploy-from-git.sh"

Write-Host ""
Write-Host "=================================================="
Write-Host "  Actualizacion completada"
Write-Host "  App: http://$SERVER_IP"
Write-Host "=================================================="
