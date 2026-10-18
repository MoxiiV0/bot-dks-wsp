#!/data/data/com.termux/files/usr/bin/bash
# Arranca el bot y lo reinicia solo si se cae (para Termux)
cd "$(dirname "$0")"

command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

while true; do
  node index.js
  echo ""
  echo "[watchdog] El bot se detuvo. Reintentando en 5 segundos..."
  sleep 5
done
