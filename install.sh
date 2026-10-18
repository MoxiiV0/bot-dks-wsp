#!/usr/bin/env bash
# Instala el bot 24/7 en un servidor Ubuntu/Debian (Oracle Cloud Free, etc.)
# Uso:  sudo bash install.sh
set -euo pipefail

APP_DIR="/opt/bot-dks-wsp"
APP_USER="botdks"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutalo como root:  sudo bash install.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

try_pkg() {
  for p in "$@"; do
    if apt-get install -y "$p"; then return 0; fi
  done
  echo "AVISO: no se pudo instalar ninguno de: $*"
  return 0
}

echo "[1/6] Paquetes base y libs de Chromium..."
apt-get update -y
apt-get install -y git curl ca-certificates unzip fontconfig fonts-liberation \
  libnss3 libnspr4 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libx11-6 libxcb1 libxext6 libx11-xcb1
try_pkg libatk1.0-0t64 libatk1.0-0
try_pkg libatk-bridge2.0-0t64 libatk-bridge2.0-0
try_pkg libcups2t64 libcups2
try_pkg libasound2t64 libasound2
try_pkg libglib2.0-0t64 libglib2.0-0

echo "[2/6] Node.js LTS..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v)"

echo "[3/6] Swap (si la VM tiene menos de 4GB de RAM)..."
RAM_MB="$(awk '/^MemTotal:/{print int($2/1024)}' /proc/meminfo)"
if [ "$RAM_MB" -lt 4000 ] && ! swapon --show 2>/dev/null | grep -q .; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap de 2G creado"
fi

echo "[4/6] Usuario y directorio..."
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"

echo "[5/6] Copiando codigo e instalando dependencias..."
if [ "$SRC_DIR" != "$APP_DIR" ]; then
  tar -C "$SRC_DIR" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./.wwebjs_auth' \
    --exclude='./.wwebjs_auth_*' \
    --exclude='./.wwebjs_cache' \
    --exclude='./*.log' \
    -cf - . | tar -C "$APP_DIR" -xf -
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && npm ci --omit=dev"

echo "[6/6] Servicio systemd..."
cp "$APP_DIR/bot-dks-wsp.service" /etc/systemd/system/bot-dks-wsp.service
systemctl daemon-reload
systemctl enable bot-dks-wsp >/dev/null 2>&1

cat <<'EOF'

========================================
 INSTALADO. Pasos finales:

 1) Escanea el QR (foreground, con el telefono):
      sudo -u botdks -H bash -c 'cd /opt/bot-dks-wsp && node index.js'
    Espera a que diga "conectado y listo" y sal con Ctrl+C.

 2) Arranca el servicio 24/7:
      systemctl start bot-dks-wsp

 3) Ver logs en vivo:
      journalctl -u bot-dks-wsp -f
    (salir del log: Ctrl+C)

 El servicio se reinicia solo si se cae y arranca al prender la VM.
========================================
EOF
