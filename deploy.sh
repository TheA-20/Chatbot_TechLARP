#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Despliegue de EduLARP / TechLARP en servidor Linux
# Uso:  sudo bash deploy.sh [--update]
#
#   Sin flags  → instalación completa (primera vez)
#   --update   → solo actualiza código, recompila y reinicia el servicio
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuración ─────────────────────────────────────────────────────────────
APP_DIR="/opt/edularp"          # Directorio de instalación
APP_USER="edularp"              # Usuario del sistema (sin contraseña)
SERVICE="edularp"               # Nombre del servicio systemd
PORT=3000                       # Puerto de la aplicación
NODE_MIN="18"                   # Versión mínima de Node.js

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Comprobaciones previas ────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Ejecuta como root: sudo bash deploy.sh"

UPDATE_ONLY=false
[[ "${1:-}" == "--update" ]] && UPDATE_ONLY=true

# Verificar Node.js
if ! command -v node &>/dev/null; then
  err "Node.js no encontrado. Instálalo con:\n  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\n  apt-get install -y nodejs"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[[ "$NODE_VER" -lt "$NODE_MIN" ]] && err "Node.js >= $NODE_MIN requerido (tienes $NODE_VER)"
ok "Node.js $(node -v)"

# ── Instalación completa (primera vez) ───────────────────────────────────────
if [[ "$UPDATE_ONLY" == false ]]; then
  echo ""
  echo "━━━ INSTALACIÓN INICIAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Crear usuario del sistema
  if ! id "$APP_USER" &>/dev/null; then
    /usr/sbin/useradd --system --shell /bin/false --home "$APP_DIR" --create-home "$APP_USER"
    ok "Usuario del sistema '$APP_USER' creado"
  else
    warn "Usuario '$APP_USER' ya existe"
  fi

  # Crear directorio
  mkdir -p "$APP_DIR"
  mkdir -p "$APP_DIR/public/uploads"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  ok "Directorio $APP_DIR preparado"

  # Copiar fichero .env.local si no existe
  if [[ ! -f "$APP_DIR/.env.local" ]]; then
    if [[ -f ".env.local" ]]; then
      cp .env.local "$APP_DIR/.env.local"
      chown "$APP_USER:$APP_USER" "$APP_DIR/.env.local"
      chmod 600 "$APP_DIR/.env.local"
      ok ".env.local copiado"
    else
      warn ".env.local no encontrado — cópialo manualmente a $APP_DIR/.env.local antes de iniciar"
    fi
  fi

  # Instalar el servicio systemd
  SERVICE_FILE="$(dirname "$(realpath "$0")")/edularp.service"
  if [[ -f "$SERVICE_FILE" ]]; then
    cp "$SERVICE_FILE" "/etc/systemd/system/${SERVICE}.service"
    # Ajustar WorkingDirectory y ExecStart con la ruta real
    sed -i "s|/opt/edularp|$APP_DIR|g" "/etc/systemd/system/${SERVICE}.service"
    # Usar npm del sistema como arranque (más portable)
    NPM_BIN=$(which npm)
    sed -i "s|ExecStart=.*|ExecStart=$NPM_BIN run start -- -p $PORT|" \
      "/etc/systemd/system/${SERVICE}.service"
    # Garantizar reinicio ilimitado (eliminar StartLimitBurst si quedó de versiones anteriores)
    sed -i "/^StartLimitBurst=/d" "/etc/systemd/system/${SERVICE}.service"
    systemctl daemon-reload
    ok "Servicio systemd instalado (reinicio automático ilimitado)"
  else
    err "edularp.service no encontrado junto a deploy.sh"
  fi
fi

# ── Parar servicio si estaba corriendo ───────────────────────────────────────
echo ""
echo "━━━ BUILD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if systemctl is-active --quiet "$SERVICE"; then
  systemctl stop "$SERVICE"
  ok "Servicio detenido"
fi

# ── Sincronizar código ────────────────────────────────────────────────────────
SRC_DIR="$(dirname "$(realpath "$0")")"
echo "Sincronizando código desde $SRC_DIR → $APP_DIR ..."
rsync -a --delete \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude=".env*" \
  --exclude="public/uploads" \
  "$SRC_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "Código sincronizado"

# ── Instalar dependencias y compilar ─────────────────────────────────────────
echo "Instalando dependencias..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci --omit=dev 2>&1 | tail -3

echo "Compilando Next.js (puede tardar 1-3 min)..."
sudo -u "$APP_USER" npm run build 2>&1 | tail -10
ok "Build completado"

# ── Inicializar / migrar base de datos ───────────────────────────────────────
echo ""
echo "━━━ BASE DE DATOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if sudo -u "$APP_USER" npm run db:migrate -- --dry-run &>/dev/null 2>&1; then
  sudo -u "$APP_USER" npm run db:migrate
  ok "Migraciones aplicadas"
else
  warn "Ejecuta manualmente: cd $APP_DIR && npm run db:init"
fi

# ── Arrancar y habilitar el servicio ─────────────────────────────────────────
echo ""
echo "━━━ SERVICIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl start "$SERVICE"
systemctl enable "$SERVICE"
sleep 2

if systemctl is-active --quiet "$SERVICE"; then
  ok "Servicio '$SERVICE' arrancado y habilitado"
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  EduLARP desplegado en http://$(hostname -I | awk '{print $1}'):$PORT${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  Comandos útiles:"
  echo "    journalctl -u $SERVICE -f          # Ver logs en tiempo real"
  echo "    systemctl status $SERVICE          # Estado del servicio"
  echo "    systemctl restart $SERVICE         # Reiniciar"
  echo "    sudo bash deploy.sh --update       # Actualizar código"
else
  err "El servicio no arrancó. Revisa los logs:\n  journalctl -u $SERVICE -n 50"
fi
