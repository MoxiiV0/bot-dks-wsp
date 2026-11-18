// Índice del RPG modular: compone data/ + core/ y expone la API completa.
// lib/rpg.js (fachada legacy) delega aquí, así que index.js no cambia.

// --- DATA ---
const { CLASSES, NUEVAS_CLASES, CLASES_EVOLUCION, EVOLUCIONES_CLASE, DESPERTAR_MAYOR, CLASE_BASE, getClass, baseClassKey, esClaseSecundaria, getGrowth, kiBaseDe, velBaseDe, pasivaDe, KI_SIN_CLASE, VEL_SIN_CLASE } = require('./data/classes');
const { SKILLS, SKILLS_V2, KITS_POR_CLASE, SKILLS_ALIAS, COMBINACIONES_SKILLS, HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES } = require('./data/skills');
const { ENEMIES, BOSSSES } = require('./data/enemies');
const { EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS } = require('./data/zones');
const { WEAPONS, HOUSES, CHESTS, OBJETOS_COMBATE, WEAPON_CLASSES, ENTRENAMIENTO, DESCANSO, REGEN, MANA } = require('./data/items');
const { RANGOS, EXAMENES } = require('./data/ranks');
const { ZONAS, ZONA_INICIAL, ESCALADO } = require('./data/world');
const { PORTAL, EVENTOS_PORTAL } = require('./data/portals');
const { BATALLA, ELEMENTOS, ARQUETIPOS } = require('./data/battle');
const { ARCS } = require('./data/arcs');
const { TITLES } = require('./data/titles');
const { STATUSES } = require('./data/statuses');
const { CLASS_MAP, ARMAS_RAREZA } = require('./data/migrations');

// --- CORE ---
const narrate = require('./core/narrate');
const curve = require('./core/curve');
const migrate = require('./core/migrate');
const stats = require('./core/stats');
const progression = require('./core/progression');
const ranks = require('./core/ranks');
const effects = require('./core/effects');
const ai = require('./core/ai');
const combat = require('./core/combat');
const world = require('./core/world');
const portal = require('./core/portal');
const loot = require('./core/loot');
const lock = require('./core/lock');

module.exports = {
  // data
  CLASSES,
  NUEVAS_CLASES,
  CLASES_EVOLUCION,
  EVOLUCIONES_CLASE,
  DESPERTAR_MAYOR,
  CLASE_BASE,
  getClass,
  baseClassKey,
  esClaseSecundaria,
  getGrowth,
  kiBaseDe,
  velBaseDe,
  pasivaDe,
  KI_SIN_CLASE,
  VEL_SIN_CLASE,
  SKILLS,
  SKILLS_V2,
  KITS_POR_CLASE,
  SKILLS_ALIAS,
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
  OBJETOS_COMBATE,
  WEAPON_CLASSES,
  ENTRENAMIENTO,
  DESCANSO,
  REGEN,
  MANA,
  RANGOS,
  EXAMENES,
  ZONAS,
  ZONA_INICIAL,
  ESCALADO,
  PORTAL,
  EVENTOS_PORTAL,
  BATALLA,
  ELEMENTOS,
  ARQUETIPOS,
  ARCS,
  TITLES,
  STATUSES,
  CLASS_MAP,
  ARMAS_RAREZA,

  // curve
  expToNext: curve.expToNext,
  MAX_LEVEL: curve.MAX_LEVEL,

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
  invertirPunto: progression.invertirPunto,
  reiniciarPuntos: progression.reiniciarPuntos,
  descansar: progression.descansar,
  checkTitles: progression.checkTitles,
  unlockTitle: progression.unlockTitle,
  evolucionarClase: progression.evolucionarClase,
  obtenerHabilidadesNivel: progression.obtenerHabilidadesNivel,
  desbloquearHabilidadPorNivel: progression.desbloquearHabilidadPorNivel,
  obtenerHabilidadEspecial: progression.obtenerHabilidadEspecial,
  getAvailableMissions: progression.getAvailableMissions,
  startMission: progression.startMission,
  completeMission: progression.completeMission,

  // effects (FASE 5: kitDe/resolveHabilidad para #hab)
  useSkill: effects.useSkill,
  combinarSkills: effects.combinarSkills,
  kitDe: effects.kitDe,
  resolveHabilidad: effects.resolveHabilidad,

  // ai
  ataqueEnemigo: ai.ataqueEnemigo,

  // ranks (FASE 3 — rangos de Cazador)
  getRango: ranks.getRango,
  examenActual: ranks.examenActual,
  ascenderRango: ranks.ascenderRango,

  // combat (FASE 5 — motor unificado)
  startCombat: combat.startCombat,
  combatTurn: combat.combatTurn,
  getEnemy: combat.getEnemy,
  puedeCombatir: combat.puedeCombatir,
  activarDespertar: combat.activarDespertar,
  factorElemental: combat.factorElemental,
  aplicarEstado: combat.aplicarEstado,

  // world (FASE 6 — zonas, escalado, caza y viaje)
  statsEscala: world.statsEscala,
  recompensas: world.recompensas,
  enemigoZona: world.enemigoZona,
  zonaActual: world.zonaActual,
  puedeViajar: world.puedeViajar,
  viajar: world.viajar,
  cazar: world.cazar,
  listaZonas: world.listaZonas,
  zonaPorNivel: world.zonaPorNivel,

  // portal (FASE 7 — incursión por pisos, reemplaza la mazmorra)
  llavesDisponibles: portal.llavesDisponibles,
  enemigoPortal: portal.enemigoPortal,
  abrirPortal: portal.abrirPortal,
  avanzarPortal: portal.avanzarPortal,
  retirarPortal: portal.retirarPortal,
  portalPostCombate: portal.portalPostCombate,
  estadoPortal: portal.estadoPortal,
  registrarRanking: portal.registrarRanking,
  rankingGrupo: portal.rankingGrupo,
  semanaClave: portal.semanaClave,

  // loot
  openChest: loot.openChest,
  generarEventoMazmorra: loot.generarEventoMazmorra,

  // lock
  withLock: lock.withLock,
  isLocked: lock.isLocked,
  clearLocks: lock.clearLocks,
};
