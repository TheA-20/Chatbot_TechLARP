#!/bin/bash
# ============================================================
# setup-git-deploy.sh — Configura el servidor para usar Git
# Ejecutar en el servidor UNA SOLA VEZ después de setup-server.sh
# Uso: ssh chatbot@163.117.137.118 "bash /tmp/setup-git-deploy.sh"
# ============================================================
set -euo pipefail

APP_DIR="/var/www/edularp-app"
DEPLOY_SCRIPT="$HOME/deploy-from-git.sh"

echo "=================================================="
echo "  Configurando despliegue via Git"
echo "=================================================="

# ── 1. Pedir URL del repositorio ─────────────────────────
echo ""
read -p "URL de tu repositorio GitHub (ej: https://github.com/TU_USUARIO/techlarp-chatbot.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
  echo "ERROR: URL requerida"
  exit 1
fi

# ── 2. Clonar el repositorio ──────────────────────────────
echo ""
echo "[1/4] Clonando repositorio..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  → El repositorio ya existe, actualizando..."
  cd "$APP_DIR" && git pull origin main
else
  # Hacer backup si hay archivos existentes
  if [ "$(ls -A $APP_DIR 2>/dev/null)" ]; then
    echo "  → Haciendo backup de archivos existentes..."
    mv "$APP_DIR" "${APP_DIR}.bak.$(date +%Y%m%d)"
  fi
  git clone "$REPO_URL" "$APP_DIR"
fi

chown -R chatbot:chatbot "$APP_DIR"

# ── 3. Restaurar .env.production si hay backup ───────────
if [ -f "${APP_DIR}.bak."*"/.env.production" ] 2>/dev/null; then
  echo "  → Restaurando .env.production del backup..."
  cp "${APP_DIR}.bak."*"/.env.production" "$APP_DIR/.env.production"
fi

# ── 4. Copiar script de despliegue al home del usuario ───
echo ""
echo "[2/4] Instalando script de despliegue rápido..."
cp "$APP_DIR/scripts/deploy-from-git.sh" "$DEPLOY_SCRIPT"
chmod +x "$DEPLOY_SCRIPT"
echo "  → Script disponible en: ~/deploy-from-git.sh"

# ── 5. Instalar dependencias y compilar ──────────────────
echo ""
echo "[3/4] Instalando dependencias..."
cd "$APP_DIR"

# Copiar .env si existe
if [ -f "$APP_DIR/.env.production" ]; then
  cp "$APP_DIR/.env.production" "$APP_DIR/.env.local"
  echo "  → .env.local configurado"
else
  echo "  AVISO: No hay .env.production. Cópialo antes de iniciar la app:"
  echo "  scp .env.production chatbot@163.117.137.118:/var/www/edularp-app/"
fi

npm ci --production=false
NODE_ENV=production npm run build
mkdir -p logs public/uploads

# ── 6. Levantar Docker y PM2 ─────────────────────────────
echo ""
echo "[4/4] Iniciando servicios..."
docker compose up -d
sleep 6
docker compose ps

if pm2 list | grep -q "edularp"; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo ""
echo "=================================================="
echo "  ✓ Configuración Git completada"
echo ""
echo "  Para futuras actualizaciones, desde tu PC:"
echo "    powershell -ExecutionPolicy Bypass -File scripts\\update.ps1"
echo "=================================================="
