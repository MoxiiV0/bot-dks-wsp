// Índice del RPG modular: compone data/ + core/ y expone la API completa.
// lib/rpg.js (fachada legacy) delega aquí, así que index.js no cambia.

// --- DATA ---
const { CLASSES, SUBCLASES, CLASES_AVANZADAS, DESPERTAR_MAYOR, CLASE_BASE, getClass, getSubclase, getClaseAvanzada, classLabel, baseClassKey, getGrowth, kiBaseDe, velBaseDe, pasivaDe, KI_SIN_CLASE, VEL_SIN_CLASE } = require('./data/classes');
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
const arcs = require('./core/arcs');
const loot = require('./core/loot');
const lock = require('./core/lock');
const equipo = require('./core/equipo');
const mazmorras = require('./core/mazmorras');
const compañeros = require('./core/companions');
const duels = require('./core/duels');
const economia = require('./core/economia');
const narrativa = require('./core/narrativa');

module.exports = {
  // data
  CLASSES,
  SUBCLASES,
  CLASES_AVANZADAS,
  DESPERTAR_MAYOR,
  CLASE_BASE,
  getClass,
  getSubclase,
  getClaseAvanzada,
  classLabel,
  baseClassKey: (key) => {
    const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
    return c ? c.claseBase || key : key;
  },
  baseClassKey,
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
  weaponLabel: narrate.weaponLabel,
  barra: narrate.barra,

  // migrate
  ensureRPG: migrate.ensureRPG,
  migrate: migrate.migrate,
  resetRPG: migrate.resetRPG,
  resetAllRPG: migrate.resetAllRPG,
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

  // arcs (FASE 8 — arcos narrativos)
  arcoActual: arcs.arcoActual,
  iniciarCapitulo: arcs.iniciarCapitulo,
  listarArcos: arcs.listarArcos,
  arcoPostCombate: arcs.arcoPostCombate,

  // loot
  openChest: loot.openChest,
  generarEventoMazmorra: loot.generarEventoMazmorra,

  // lock
  withLock: lock.withLock,
  isLocked: lock.isLocked,
  clearLocks: lock.clearLocks,

  // equipo (FASE 9)
  equipoDe: equipo.equipoDe,
  equipar: equipo.equipar,
  desequipar: equipo.desequipar,
  bonosEquipo: equipo.bonosEquipo,
  forjar: equipo.forjar,
  mejorar: equipo.mejorar,
  reparar: equipo.reparar,
  gastarDurabilidad: equipo.gastarDurabilidad,
  listarEquipo: equipo.listarEquipo,
  CATALOGO: equipo.CATALOGO,
  obtenerItem: equipo.obtenerItem,
  crearItem: equipo.crearItem,
  RAREZAS: equipo.RAREZAS,
  AFIJOS: equipo.AFIJOS,
  MATERIALES: equipo.MATERIALES,

  // compañeros (FASE 10 — compañeros y vínculos; #domar/#invocar son alias de #espiritu)
  compañerosDe: compañeros.compañerosDe,
  datosDe: compañeros.datosDe,
  reclutarCompañero: compañeros.reclutar,
  activarCompañero: compañeros.activar,
  desactivarCompañero: compañeros.desactivar,
  compañeroActivo: compañeros.activo,
  listarCompañeros: compañeros.listar,
  sumarPuntoVínculo: compañeros.sumarPuntoVínculo,
  ataqueCombinado: compañeros.ataqueCombinado,
  aplicarCombateCompañero: compañeros.aplicarCombateCompañero,
  setMarkEconDirty: compañeros.setMarkEconDirty,
  COMPANIONES: compañeros.COMPANIONES,
  ESPIRITUS: compañeros.ESPIRITUS,
  VINCULO: compañeros.VINCULO,

  // duels (FASE 11 — PvP y social: duelos, torneos, jefe mundial)
  dueloIniciar: duels.dueloIniciar,
  dueloAceptar: duels.dueloAceptar,
  dueloEstado: duels.dueloEstado,
  dueloTurno: duels.dueloTurno,
  dueloRendirse: duels.dueloRendirse,
  torneoInscribir: duels.torneoInscribir,
  torneoEstado: duels.torneoEstado,
  torneoRonda: duels.torneoRonda,
  jefeMundialIniciar: duels.jefeMundialIniciar,
  jefeMundialDaño: duels.jefeMundialDaño,
  jefeMundialEstado: duels.jefeMundialEstado,
  DUELO: duels.DUELO,
  TORNEO: duels.TORNEO,
  JEFEMUNDIAL: duels.JEFEMUNDIAL,
  setEconomiaHooks: duels.setEconomiaHooks,

  // mazmorras (FASE C — mazmorras por pisos, sin apuesta)
  mazmorraDe: mazmorras.mazmorraDe,
  obtenerMazmorra: mazmorras.obtenerMazmorra,
  listaMazmorras: mazmorras.listaMazmorras,
  abrirMazmorra: mazmorras.abrirMazmorra,
  avanzarMazmorra: mazmorras.avanzarMazmorra,
  retirarMazmorra: mazmorras.retirarMazmorra,
  mazmorraPostCombate: mazmorras.mazmorraPostCombate,
  PISOS_POR_JEFE: mazmorras.PISOS_POR_JEFE,
  PISOS_TOTALES: mazmorras.PISOS_TOTALES,

  // economía (FASE 12 — anti-abuso, límite diario de EXP, auditoría, respaldo)
  aplicarLimiteEXPDiaria: economia.aplicarLimiteEXPDiaria,
  auditLogGanancia: economia.auditLogGanancia,
  respaldoDiario: economia.respaldoDiario,
  EXP_DIARIA: economia.EXP_DIARIA,
  AUDIT_UMBRAL: economia.AUDIT_UMBRAL,
  SUMIDEROS: economia.SUMIDEROS,

  // narrativa (FASE 14 — formato de mensajes y plantillas)
  narrativa,
  FRASES: narrativa.FRASES,
};
