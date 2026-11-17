// Cálculo de stats del jugador: clase + arma + casa + título equipado.

const { getClass } = require('../data/classes');
const { WEAPONS, HOUSES } = require('../data/items');
const { TITLES } = require('../data/titles');
const { GUILD_RANKS } = require('../data/zones');
const { ensureRPG } = require('./migrate');
const { expToNext } = require('./curve');

const getStats = (u) => {
  ensureRPG(u);
  const r = u.rpg;
  const clase = getClass(r.clase);
  const arma = r.arma ? WEAPONS[r.arma] : null;
  const casa = r.casa ? HOUSES[r.casa] : null;
  const rank = getGuildRank(r.oro || 0);

  let atkTotal = (clase ? clase.atkBase : 0) + (arma ? arma.atk : 0);
  let defTotal = (clase ? clase.defBase : 0);
  let hpTotal = (clase ? clase.hpBase : 0);

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

  // HP actual (v2): se llena la primera vez y se recalca al máximo real (con título)
  const hpFinal = hpTotal + tituloBonusHp;
  if (r.hp == null || r.hp <= 0) r.hp = hpFinal;
  else if (r.hp > hpFinal) r.hp = hpFinal;

  return {
    clase: clase ? clase.nombre : 'Sin clase',
    nivel: r.nivel || 1,
    exp: r.exp || 0,
    expSiguiente: expToNext(r.nivel || 1),
    hpActual: r.hp,
    ki: r.ki || 0,
    kiMax: r.kiMax || 0,
    oro: r.oro || 0,
    cash: typeof u.cash === 'number' ? u.cash : 0,
    bank: typeof u.bank === 'number' ? u.bank : 0,
    atk: atkTotal + tituloBonusAtk,
    def: defTotal + tituloBonusDef,
    hp: hpFinal,
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
