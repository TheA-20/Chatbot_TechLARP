#!/bin/bash
# ============================================================
# deploy.sh — Despliega/actualiza la app en el servidor
# Ejecutar desde tu máquina local (Windows: usar Git Bash o WSL)
# Uso: bash scripts/deploy.sh
# ============================================================
set -euo pipefail

# ── Configuración ────────────────────────────────────────
SERVER_IP="163.117.137.118"
SERVER_USER="chatbot"
REMOTE_DIR="/var/www/edularp-app"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=================================================="
echo "  TechLARP — Despliegue a $SERVER_IP"
echo "=================================================="

# ── Verificar .env.production existe ─────────────────────
if [ ! -f "$LOCAL_DIR/.env.production" ]; then
  echo "ERROR: No existe .env.production en $LOCAL_DIR"
  echo "Copia .env.example a .env.production y rellena los valores"
  exit 1
fi

# ── 1. Sincronizar archivos (excluir node_modules, data, .env.local) ──
echo ""
echo "[1/5] Transfiriendo archivos al servidor..."
rsync -avz --progress \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='data/' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='public/uploads' \
  "$LOCAL_DIR/" \
  "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

# ── 2. Subir el archivo de entorno ───────────────────────
echo ""
echo "[2/5] Subiendo .env.production..."
scp "$LOCAL_DIR/.env.production" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env.production"

# ── 3. Ejecutar instalación y build en el servidor ──────
echo ""
echo "[3/5] Instalando dependencias y compilando en el servidor..."
ssh "$SERVER_USER@$SERVER_IP" bash << 'REMOTE_SCRIPT'
  set -euo pipefail
  cd /var/www/edularp-app

  echo "  → Instalando dependencias npm..."
  npm ci --production=false

  echo "  → Compilando Next.js..."
  NODE_ENV=production npm run build

  echo "  → Creando directorio de logs..."
  mkdir -p logs
  mkdir -p public/uploads
REMOTE_SCRIPT

# ── 4. Levantar servicios Docker (PostgreSQL + Redis) ───
echo ""
echo "[4/5] Iniciando servicios Docker (BD + Redis)..."
ssh "$SERVER_USER@$SERVER_IP" bash << 'REMOTE_SCRIPT'
  set -euo pipefail
  cd /var/www/edularp-app

  echo "  → Levantando PostgreSQL y Redis..."
  docker compose up -d

  echo "  → Esperando que PostgreSQL esté listo..."
  sleep 8
  docker compose ps
REMOTE_SCRIPT

# ── 5. Iniciar/Reiniciar la app con PM2 ──────────────────
echo ""
echo "[5/5] Iniciando la aplicación con PM2..."
ssh "$SERVER_USER@$SERVER_IP" bash << 'REMOTE_SCRIPT'
  set -euo pipefail
  cd /var/www/edularp-app

  # Copiar .env.production como .env.local para Next.js
  cp .env.production .env.local

  # Si PM2 ya tiene el proceso, reiniciar; si no, iniciar
  if pm2 list | grep -q "edularp"; then
    echo "  → Reiniciando proceso existente..."
    pm2 reload ecosystem.config.js --update-env
  else
    echo "  → Iniciando nuevo proceso..."
    pm2 start ecosystem.config.js
  fi

  pm2 save
  pm2 status
REMOTE_SCRIPT

echo ""
echo "=================================================="
echo "  ✓ Despliegue completado"
echo ""
echo "  App:  http://$SERVER_IP"
echo "  Logs: ssh $SERVER_USER@$SERVER_IP 'pm2 logs edularp'"
echo "=================================================="
