#!/bin/bash
# ============================================================
# setup-server.sh — Configuración inicial del servidor Debian 13
# Servidor: 163.117.137.118 | Usuario: chatbot
# Ejecutar como root: bash setup-server.sh
# ============================================================
set -euo pipefail

echo "=================================================="
echo "  TechLARP Chatbot — Configuración del servidor"
echo "=================================================="

# ── 1. Actualizar sistema ──────────────────────────────────
echo ""
echo "[1/8] Actualizando sistema..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git unzip gnupg lsb-release ca-certificates \
                   apt-transport-https software-properties-common

# ── 2. Instalar Node.js 20 LTS ────────────────────────────
echo ""
echo "[2/8] Instalando Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# Instalar PM2 globalmente
npm install -g pm2

# ── 3. Instalar Docker ────────────────────────────────────
echo ""
echo "[3/8] Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Añadir usuario chatbot al grupo docker
usermod -aG docker chatbot
systemctl enable docker
systemctl start docker
docker --version

# ── 4. Instalar Nginx ─────────────────────────────────────
echo ""
echo "[4/8] Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx
nginx -v

# ── 5. Crear estructura de directorios ───────────────────
echo ""
echo "[5/8] Creando directorios de la aplicación..."
mkdir -p /var/www/edularp-app
mkdir -p /var/www/edularp-app/logs
mkdir -p /var/www/edularp-app/public/uploads
chown -R chatbot:chatbot /var/www/edularp-app

# ── 6. Configurar firewall (ufw) ─────────────────────────
echo ""
echo "[6/8] Configurando firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

# ── 7. Configurar PM2 para arrancar con el sistema ──────
echo ""
echo "[7/8] Configurando PM2 como servicio del sistema..."
# Se ejecutará como chatbot, no como root
sudo -u chatbot pm2 startup systemd -u chatbot --hp /home/chatbot || true
# Guardar para que arranque al inicio
env PATH=$PATH:/usr/bin pm2 startup systemd -u chatbot --hp /home/chatbot

# ── 8. Instalar certbot (Let's Encrypt) — opcional ──────
echo ""
echo "[8/8] Instalando Certbot para SSL (futuro uso)..."
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "=================================================="
echo "  ✓ Servidor configurado correctamente"
echo "=================================================="
echo ""
echo "Próximo paso: Ejecutar scripts/deploy.sh desde tu máquina local"
echo ""
