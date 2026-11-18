// FASE 12 — Economía y anti-abuso: límite diario de EXP, auditoría de ganancias
// grandes y respaldo automático del economy.json cada día.
// Estado en u.rpg.expDiaria y settings.economyBackup. Sin globales sueltos.

const { EXP_DIARIA, AUDIT_UMBRAL, SUMIDEROS } = require('../data/economia');
const fs = require('fs');
const path = require('path');

const EXP_DIARIA_FECHA = (d = new Date()) => d.toISOString().slice(0, 10);

// Aplica el límite diario de EXP por caza de rutina. Devuelve la EXP efectiva
// que se puede otorgar y cuánto se bloqueó.
const aplicarLimiteEXPDiaria = (u, exp) => {
  const r = u.rpg || {};
  const hoy = EXP_DIARIA_FECHA();
  if (!r.expDiaria || r.expDiaria.fecha !== hoy) {
    r.expDiaria = { fecha: hoy, expHoy: 0 };
  }
  const disponible = Math.max(0, EXP_DIARIA.tope - r.expDiaria.expHoy);
  const efectiva = Math.min(exp, disponible);
  r.expDiaria.expHoy += efectiva;
  return { efectiva, bloqueada: Math.max(0, exp - efectiva), expHoy: r.expDiaria.expHoy };
};

// Registra en AUDIT_LOG las ganancias grandes de RPG (para evitar dinero fácil de casino).
const auditLogGanancia = (u, monto, motivo, jid) => {
  if (!monto || monto < AUDIT_UMBRAL) return;
  const dir = path.join(__dirname, '..', '..', '..', 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const linea = JSON.stringify({
    ts: new Date().toISOString(),
    usuario: u.id || 'desconocido',
    monto,
    motivo,
    chat: jid || '',
  }) + '\n';
  try { fs.appendFileSync(path.join(dir, 'audit.log'), linea); } catch (e) {}
};

// Respaldo automático del economy.json cada día (por fecha, sin timers).
const respaldoDiario = (settings, rutaEconomy) => {
  const hoy = EXP_DIARIA_FECHA();
  const previo = settings.economyBackup || {};
  if (previo.fecha === hoy) return false; // ya se hizo hoy
  try {
    const origen = rutaEconomy || path.join(__dirname, '..', '..', '..', 'dks-data', 'economy.json');
    const destino = path.join(__dirname, '..', '..', '..', 'logs', `economy.backup.${hoy}.json`);
    if (fs.existsSync(origen)) {
      fs.copyFileSync(origen, destino);
    }
  } catch (e) {}
  settings.economyBackup = { fecha: hoy };
  return true;
};

module.exports = {
  EXP_DIARIA,
  AUDIT_UMBRAL,
  SUMIDEROS,
  aplicarLimiteEXPDiaria,
  auditLogGanancia,
  respaldoDiario,
};
