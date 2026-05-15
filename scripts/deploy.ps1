# ============================================================
# deploy.ps1 — Despliega la app al servidor desde Windows
# Requiere: OpenSSH (incluido en Windows 10/11)
# Ejecutar desde: C:\...\Chatbot\edularp-export\
# Uso: powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$SERVER_IP   = "163.117.137.118"
$SERVER_USER = "chatbot"
$REMOTE_DIR  = "/var/www/edularp-app"
$LOCAL_DIR   = Split-Path -Parent $PSScriptRoot

Write-Host "=================================================="
Write-Host "  TechLARP — Despliegue a $SERVER_IP"
Write-Host "=================================================="

# ── Verificar .env.production ─────────────────────────────
$envFile = Join-Path $LOCAL_DIR ".env.production"
if (-not (Test-Path $envFile)) {
    Write-Error "No existe .env.production en $LOCAL_DIR"
    Write-Host "Copia .env.example a .env.production y rellena los valores"
    exit 1
}

# ── Verificar que ssh está disponible ────────────────────
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Error "OpenSSH no encontrado. Instálalo desde Configuracion > Aplicaciones > Caracteristicas opcionales > OpenSSH"
    exit 1
}

# ── 1. Empaquetar archivos (excluir lo innecesario) ──────
Write-Host ""
Write-Host "[1/5] Empaquetando archivos..."
$tarFile = Join-Path $env:TEMP "edularp-deploy.tar.gz"

# Crear lista de exclusiones
$excludes = @("node_modules", ".next", "data", ".env.local", ".env.production", "public\uploads", ".git")

# Usar tar (incluido en Windows 10+) para empaquetar
Push-Location $LOCAL_DIR
$excludeArgs = $excludes | ForEach-Object { "--exclude=./$_" }
& tar -czf $tarFile @excludeArgs .
Pop-Location
Write-Host "  → Paquete creado: $tarFile"

# ── 2. Transferir al servidor ─────────────────────────────
Write-Host ""
Write-Host "[2/5] Transfiriendo archivos al servidor..."
& scp $tarFile "${SERVER_USER}@${SERVER_IP}:/tmp/edularp-deploy.tar.gz"

# ── 3. Subir .env.production ─────────────────────────────
Write-Host ""
Write-Host "[3/5] Subiendo .env.production..."
& scp $envFile "${SERVER_USER}@${SERVER_IP}:/tmp/.env.production"

# ── 4. Descomprimir, instalar y compilar en el servidor ──
Write-Host ""
Write-Host "[4/5] Instalando dependencias y compilando en el servidor..."
$remoteScript = @"
set -euo pipefail
mkdir -p $REMOTE_DIR
cd $REMOTE_DIR

echo '  -> Descomprimiendo archivos...'
tar -xzf /tmp/edularp-deploy.tar.gz -C $REMOTE_DIR
cp /tmp/.env.production $REMOTE_DIR/.env.production
cp $REMOTE_DIR/.env.production $REMOTE_DIR/.env.local

echo '  -> Instalando dependencias npm...'
npm ci --production=false

echo '  -> Compilando Next.js...'
NODE_ENV=production npm run build

echo '  -> Preparando directorios...'
mkdir -p logs
mkdir -p public/uploads

echo '  -> Levantando Docker (PostgreSQL + Redis)...'
docker compose up -d
sleep 8
docker compose ps
"@

& ssh "${SERVER_USER}@${SERVER_IP}" $remoteScript

# ── 5. Iniciar/Reiniciar con PM2 ─────────────────────────
Write-Host ""
Write-Host "[5/5] Iniciando la aplicacion con PM2..."
$pm2Script = @"
set -euo pipefail
cd $REMOTE_DIR
if pm2 list | grep -q 'edularp'; then
  echo '  -> Reiniciando proceso existente...'
  pm2 reload ecosystem.config.js --update-env
else
  echo '  -> Iniciando nuevo proceso...'
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 status
"@

& ssh "${SERVER_USER}@${SERVER_IP}" $pm2Script

# ── Limpieza ─────────────────────────────────────────────
Remove-Item $tarFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=================================================="
Write-Host "  Despliegue completado"
Write-Host ""
Write-Host "  App:  http://$SERVER_IP"
Write-Host "  Logs: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs edularp'"
Write-Host "=================================================="
