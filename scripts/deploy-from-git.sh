#!/bin/bash
# ============================================================
# deploy-from-git.sh — Script que corre EN EL SERVIDOR
# Hace git pull y reinicia la app
# Uso: ssh chatbot@163.117.137.118 "bash ~/deploy-from-git.sh"
# ============================================================
set -euo pipefail

APP_DIR="/var/www/edularp-app"
cd "$APP_DIR"

echo "[1/5] Actualizando código desde Git..."
git pull origin main

echo "[2/5] Instalando nuevas dependencias (si las hay)..."
npm ci --production=false

echo "[3/5] Recompilando Next.js..."
NODE_ENV=production npm run build

echo "[4/5] Copiando archivos al servidor standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
# Variables de entorno necesarias para el servidor standalone
cp .env.local .next/standalone/.env.local

echo "[5/5] Reiniciando aplicación..."
pm2 reload ecosystem.config.js --update-env
pm2 save

echo ""
echo "✓ Actualización completada"
pm2 status
