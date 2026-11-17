// Índice del RPG modular: compone data/ + core/ y expone la API completa.
// lib/rpg.js (fachada legacy) delega aquí, así que index.js no cambia.

// --- DATA ---
const { CLASSES, NUEVAS_CLASES, EVOLUCIONES_CLASE, CLASE_BASE, getClass, baseClassKey, esClaseSecundaria } = require('./data/classes');
const { SKILLS, COMBINACIONES_SKILLS, HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES } = require('./data/skills');
const { ENEMIES, BOSSSES } = require('./data/enemies');
const { EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS } = require('./data/zones');
const { WEAPONS, HOUSES, CHESTS, WEAPON_CLASSES, ENTRENAMIENTO, MANA } = require('./data/items');
const { ARCS } = require('./data/arcs');
const { TITLES } = require('./data/titles');
const { STATUSES } = require('./data/statuses');

// --- CORE ---
const narrate = require('./core/narrate');
const migrate = require('./core/migrate');
const stats = require('./core/stats');
const progression = require('./core/progression');
const effects = require('./core/effects');
const ai = require('./core/ai');
const combat = require('./core/combat');
const loot = require('./core/loot');
const lock = require('./core/lock');

module.exports = {
  // data
  CLASSES,
  NUEVAS_CLASES,
  EVOLUCIONES_CLASE,
  CLASE_BASE,
  getClass,
  baseClassKey,
  esClaseSecundaria,
  SKILLS,
  COMBINACIONES_SKILLS,
  HABILIDADES_POR_NIVEL,
  HABILIDADES_ESPECIALES,
  ENEMIES,
  BOSSSES,
  EVENTOS_MAZMORRA,
  MISSIONS,
  GUILD_RANKS,
  WEAPONS,
  HOUSES,
  CHESTS,
  WEAPON_CLASSES,
  ENTRENAMIENTO,
  MANA,
  ARCS,
  TITLES,
  STATUSES,

  // narrate
  rand: narrate.rand,
  pick: narrate.pick,
  money: narrate.money,
  classLabel: narrate.classLabel,
  weaponLabel: narrate.weaponLabel,
  barra: narrate.barra,

  // migrate
  ensureRPG: migrate.ensureRPG,
  migrate: migrate.migrate,
  SCHEMA_VERSION: migrate.SCHEMA_VERSION,

  // stats
  getStats: stats.getStats,
  hpMaxDe: stats.hpMaxDe,
  getStatsCompletos: stats.getStatsCompletos,
  ensureGuild: stats.ensureGuild,
  getGuildRank: stats.getGuildRank,
  getHouseBenefit: stats.getHouseBenefit,

  // progression
  addExp: progression.addExp,
  checkTitles: progression.checkTitles,
  unlockTitle: progression.unlockTitle,
  evolucionarClase: progression.evolucionarClase,
  obtenerHabilidadesNivel: progression.obtenerHabilidadesNivel,
  desbloquearHabilidadPorNivel: progression.desbloquearHabilidadPorNivel,
  obtenerHabilidadEspecial: progression.obtenerHabilidadEspecial,
  getAvailableMissions: progression.getAvailableMissions,
  startMission: progression.startMission,
  completeMission: progression.completeMission,

  // effects
  useSkill: effects.useSkill,
  combinarSkills: effects.combinarSkills,

  // ai
  ataqueEnemigo: ai.ataqueEnemigo,

  // combat
  startCombat: combat.startCombat,
  combatTurn: combat.combatTurn,

  // loot
  openChest: loot.openChest,
  generarEventoMazmorra: loot.generarEventoMazmorra,

  // lock
  withLock: lock.withLock,
  isLocked: lock.isLocked,
  clearLocks: lock.clearLocks,
};
