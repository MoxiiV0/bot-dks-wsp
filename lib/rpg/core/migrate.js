// Inicialización y migración del esquema u.rpg.
// FASE 1: solo garantiza el esquema v1 actual (idempotente).
// FASE 2: sumará migrateV2 (v1 -> v2) con dry-run y log de migraciones.

const SCHEMA_VERSION = 1;

// Inicializa u.rpg con el esquema v1. Idempotente: llamarlo N veces es seguro.
const ensureRPG = (u) => {
  if (!u.rpg) u.rpg = {};
  const r = u.rpg;
  if (!r.clase) r.clase = null;
  if (!r.arma) r.arma = 'nada';
  if (!r.armas) r.armas = ['nada'];
  if (!r.nivel) r.nivel = 1;
  if (!r.exp) r.exp = 0;
  if (!r.oro) r.oro = 0;
  if (!r.pescado) r.pescado = 0;
  if (!r.minerales) r.minerales = 0;
  if (!r.nombrePersonalizado) r.nombrePersonalizado = null;
  if (!r.casa) r.casa = null;
  if (!r.aventureros) r.aventureros = [];
  if (!r.aprendiz) r.aprendiz = null;
  if (!r.misiones) r.misiones = {};
  if (!r.misionesCompletadas) r.misionesCompletadas = [];
  if (!r.combate) r.combate = null;
  if (!r.entrenamiento) r.entrenamiento = { atk: 0, def: 0, hp: 0 };
  if (!r.mana) r.mana = 0;
  if (!r.manaMax) r.manaMax = 100;
  if (!r.statsTrabajos) r.statsTrabajos = 0;
  if (!r.statsCrimenes) r.statsCrimenes = 0;
  if (!r.maxBank) r.maxBank = 0;
  if (!r.statsEnemigosDerrotados) r.statsEnemigosDerrotados = 0;
  if (!r.statsPisos) r.statsPisos = 0;
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  if (!r.tituloEquipado) r.tituloEquipado = null;
  if (!r.v) r.v = SCHEMA_VERSION;
  return r;
};

// Registro de migraciones (FASE 2 lo conectará a un log persistente).
const logMigracion = (entrada) => {
  console.log('[rpg:migracion]', JSON.stringify(entrada));
};

// FASE 2: migración v1 -> v2 (placeholder idempotente con dry-run).
// Por ahora solo asegura el esquema y no transforma nada.
const migrate = (u, opts = {}) => {
  const dryRun = !!opts.dryRun;
  ensureRPG(u);
  const r = u.rpg;
  if ((r.v || 1) >= 2) return { migrado: false, razon: 'ya-v2', dryRun };
  // La conversión real llega en la FASE 2.
  return { migrado: false, razon: 'sin-cambios', dryRun, version: r.v };
};

module.exports = { SCHEMA_VERSION, ensureRPG, migrate, logMigracion };
