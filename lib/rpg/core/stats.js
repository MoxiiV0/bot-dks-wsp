// Cálculo de stats del jugador: clase + crecimiento + equipo + casa + título
// + puntos de atributo (FASE 3). También aplica la regeneración por tiempo.

const { getClass, getGrowth, kiBaseDe, velBaseDe } = require('../data/classes');
const { WEAPONS, HOUSES, ENTRENAMIENTO, REGEN } = require('../data/items');
const { TITLES } = require('../data/titles');
const { GUILD_RANKS } = require('../data/zones');
const { ensureRPG } = require('./migrate');
const { expToNext } = require('./curve');
const { bonosEquipo } = require('./equipo');

// Bonus de un atributo invertido: puntos * valor por punto (DATA).
const bonoAtributo = (r, clave) => {
  const conf = ENTRENAMIENTO.atributos[clave];
  if (!conf) return 0;
  return ((r.atributos && r.atributos[clave]) || 0) * conf.porPunto;
};

// Regeneración por tiempo (sin timers): se calcula al consultar contra
// ultimaRegen. HP 1%/min, Ki 2%/min (REGEN en data/items.js). Conserva el
// resto de minutos que no llega al intervalo.
const aplicarRegen = (r, hpMax, kiMax) => {
  const ahora = Date.now();
  if (!r.ultimaRegen) { r.ultimaRegen = ahora; return; }
  const transcurrido = ahora - r.ultimaRegen;
  if (transcurrido < REGEN.intervaloMs) return;
  const minutos = Math.floor(transcurrido / REGEN.intervaloMs);
  r.ultimaRegen += minutos * REGEN.intervaloMs;
  const hpGanado = Math.floor(hpMax * (REGEN.hpPctPorMinuto / 100) * minutos);
  const kiGanado = Math.floor(kiMax * (REGEN.kiPctPorMinuto / 100) * minutos);
  r.hp = Math.min(hpMax, (r.hp || 0) + hpGanado);
  r.ki = Math.min(kiMax, (r.ki || 0) + kiGanado);
};

const getStats = (u) => {
  ensureRPG(u);
  const r = u.rpg;
  const clase = getClass(r.clase);
  const arma = r.arma ? WEAPONS[r.arma] : null;
  const casa = r.casa ? HOUSES[r.casa] : null;
  const rank = getGuildRank(r.oro || 0);
  const nivel = r.nivel || 1;
  const L = Math.max(0, nivel - 1);
  const crec = getGrowth(r.clase); // null sin clase -> sin crecimiento

  // Stat final = base de clase + crecimiento * (L-1) + equipo + título
  //               + casa + puntos de atributo (fórmula FASE 3)
  // FASE 9: los bonos de equipo (arma, armadura, accesorio, reliquia,
  //         afijos, sets y mejoras) vienen de bonosEquipo (core/equipo.js).
  const bonoEquip = bonosEquipo(u);
  let atkTotal = (clase ? clase.atkBase + (crec ? crec.atk * L : 0) : 0)
    + bonoEquip.atk
    + bonoAtributo(r, 'atk');
  let defTotal = (clase ? clase.defBase + (crec ? crec.def * L : 0) : 0)
    + bonoEquip.def
    + bonoAtributo(r, 'def');
  let hpTotal = (clase ? clase.hpBase + (crec ? crec.hp * L : 0) : 0)
    + bonoEquip.hp
    + bonoAtributo(r, 'hp');
  const kiMaxTotal = Math.round(kiBaseDe(r.clase) + (crec ? crec.ki * L : 0) + bonoAtributo(r, 'ki') + bonoEquip.ki);
  const velTotal = Math.round(velBaseDe(r.clase) + bonoAtributo(r, 'vel') + bonoEquip.vel);

  if (casa) {
    if (casa.beneficio === 'hp') hpTotal += casa.valor;
    if (casa.beneficio === 'atk') atkTotal += casa.valor;
    if (casa.beneficio === 'all') {
      hpTotal += casa.valor;
      atkTotal += casa.valor;
      defTotal += Math.floor(casa.valor / 2);
    }
  }

  // Bonificaciones de título equipado
  let tituloBonusAtk = 0;
  let tituloBonusDef = 0;
  let tituloBonusHp = 0;
  let tituloEquipadoNombre = 'Ninguno';
  if (r.tituloEquipado && TITLES[r.tituloEquipado]) {
    const t = TITLES[r.tituloEquipado];
    tituloBonusAtk = t.bonus.atk || 0;
    tituloBonusDef = t.bonus.def || 0;
    tituloBonusHp = t.bonus.hp || 0;
    tituloEquipadoNombre = t.nombre;
  }

  // HP/Ki máximo real (con título) y regeneración por tiempo
  const hpFinal = Math.round(hpTotal + tituloBonusHp);
  aplicarRegen(r, hpFinal, kiMaxTotal);
  r.kiMax = kiMaxTotal;
  if (r.ki == null || r.ki < 0) r.ki = kiMaxTotal;

  // HP actual (v2): se llena la primera vez y se recalca al máximo real (con título)
  if (r.hp == null || r.hp <= 0) r.hp = hpFinal;
  else if (r.hp > hpFinal) r.hp = hpFinal;
  if (r.ki > kiMaxTotal) r.ki = kiMaxTotal;

  return {
    clase: clase ? clase.nombre : 'Sin clase',
    nivel,
    exp: r.exp || 0,
    expSiguiente: expToNext(nivel),
    hpActual: r.hp,
    ki: r.ki || 0,
    kiMax: kiMaxTotal,
    vel: velTotal,
    puntos: r.puntos || 0,
    atributos: r.atributos || { atk: 0, def: 0, hp: 0, ki: 0, vel: 0 },
    oro: r.oro || 0,
    cash: typeof u.cash === 'number' ? u.cash : 0,
    bank: typeof u.bank === 'number' ? u.bank : 0,
    atk: Math.round(atkTotal + tituloBonusAtk),
    def: Math.round(defTotal + tituloBonusDef),
    hp: hpFinal,
    // FASE 9: equipo equipado y sus bonos (para comandos #equipo, #estado).
    equipado: r.equipo || { arma: null, armadura: null, accesorio: null, reliquia: null },
    bonosEquipo: bonoEquip,
    habilidades: r.skillsCombinadas || [],
    misionesCompletadas: r.misionesCompletadas || [],
    gremio: r.gremio ? 'Sí' : 'No',
    casa: casa ? casa.nombre : 'Ninguna',
    nombrePersonalizado: r.nombrePersonalizado || 'Sin nombre',
    tituloEquipado: tituloEquipadoNombre,
    titulosDesbloqueados: r.titulosDesbloqueados || [],
  };
};

// HP máximo actual del jugador (clase + casa + título)
const hpMaxDe = (u) => getStats(u).hp;

const getStatsCompletos = (u) => {
  const base = getStats(u);
  const r = u.rpg;
  return {
    ...base,
    claseEvolucionada: r.claseEvolucionada || false,
    habilidadesDesbloqueadas: r.habilidadesDesbloqueadas || [],
    habilidadesCombinadas: r.skillsCombinadas || [],
    bestiasDomadas: r.bestiasDomadas || [],
    bestiasActivas: r.bestiasActivas || [],
  };
};

const ensureGuild = (settings) => {
  if (!settings.guilds) settings.guilds = {};
  return settings.guilds;
};

const getGuildRank = (oroTotal) => {
  for (let i = GUILD_RANKS.length - 1; i >= 0; i--) {
    if (oroTotal >= GUILD_RANKS[i].requerimiento) return GUILD_RANKS[i];
  }
  return GUILD_RANKS[0];
};

const getHouseBenefit = (houseKey) => HOUSES[houseKey] || null;

module.exports = {
  getStats,
  hpMaxDe,
  getStatsCompletos,
  ensureGuild,
  getGuildRank,
  getHouseBenefit,
};
