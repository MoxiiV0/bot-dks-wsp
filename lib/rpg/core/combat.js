// Motor de combate por turnos contra enemigos.
// - HP real del jugador (hpJugador/hpMaxJugador dentro de u.rpg.combate)
// - Expiración por timestamp (10 min) y tope de 15 turnos
// - Skills pendientes (rpg.skillPendiente) aplicadas en el turno completo
// - Victoria: oro + EXP + títulos + doma de bestias (invocador)
// - Derrota: pierde 10% de cash y queda a 30% de HP

const { ENEMIES } = require('../data/enemies');
const { getClass } = require('../data/classes');
const { WEAPONS } = require('../data/items');
const { getStats, hpMaxDe } = require('./stats');
const { addExp, checkTitles } = require('./progression');
const { rand, money, barra } = require('./narrate');
const { ataqueEnemigo } = require('./ai');

const COMBATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos sin actividad
const COMBATE_MAX_TURNOS = 15;
const DERROTA_PIERDE_PCT = 0.1; // 10% del cash en mano
const DERROTA_HP_RESTANTE_PCT = 0.3; // queda con 30% de HP
const DOMA_BESTIA_PROB = 0.2; // invocador doma bestias al vencer
const DOMA_BESTIAS = { jabali: 'jabali', lobo: 'lobo', esqueleto: 'esqueleto' };

const startCombat = (u, enemyKey) => {
  const enemy = ENEMIES[enemyKey];
  if (!enemy) return null;
  const hpMax = hpMaxDe(u);
  u.rpg.combate = {
    enemyKey,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    hpJugador: hpMax,
    hpMaxJugador: hpMax,
    turnos: 0,
    iniciado: Date.now(),
  };
  return enemy;
};

const combatTurn = (u, action) => {
  const c = u.rpg.combate;
  if (!c) return null;
  const enemy = ENEMIES[c.enemyKey];
  if (!enemy) { u.rpg.combate = null; return null; }
  c.turnos += 1;

  const r = u.rpg;
  const clase = getClass(r.clase) || { atkBase: 10, defBase: 5, hpBase: 100 };
  const arma = WEAPONS[r.arma] || { atk: 0 };
  const stats = getStats(u);

  // Expiración por timestamp (10 minutos sin actividad)
  if (c.iniciado && Date.now() - c.iniciado > COMBATE_TIMEOUT_MS) {
    r.combate = null;
    r.skillPendiente = null;
    return { resultado: '⏰ El combate expiró por inactividad (10 min). Escapaste.', terminado: true, tipo: 'escape' };
  }

  // Daño del jugador (con skill pendiente si la hay)
  let dmgJugador = Math.max(1, clase.atkBase + arma.atk + rand(-3, 5));
  let extraTexto = '';
  const skill = r.skillPendiente; // se consume al final del turno completo
  if (skill) {
    if (skill.multiplicador) dmgJugador = Math.round(dmgJugador * skill.multiplicador);
    if (skill.curacion) {
      c.hpJugador = Math.min(c.hpMaxJugador, c.hpJugador + skill.curacion);
      extraTexto += `\n✨ Te curaste ${skill.curacion} de vida.`;
    }
    if (skill.roba_oro) {
      const robo = Math.min(u.cash + 200, rand(50, 200));
      u.cash += robo;
      extraTexto += `\n💰 Robaste ${money(robo)}.`;
    }
  }
  c.enemyHp -= dmgJugador;

  let resultado = `🗡️ Atacaste a *${enemy.nombre}* e infligiste *${dmgJugador}* de daño.${extraTexto}\n`;

  if (c.enemyHp <= 0) {
    const oroGanado = enemy.oro;
    const expGanada = enemy.exp;
    u.cash += oroGanado;
    r.combate = null;
    r.skillPendiente = null;
    // Stats v2 (fuente de verdad) + espejo legacy
    if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
    r.stats.kills = (r.stats.kills || 0) + 1;
    r.statsEnemigosDerrotados = r.stats.kills;
    const subida = addExp(u, expGanada);
    const nuevosTitulos = checkTitles(u);
    resultado += `\n💀 *Derrotaste a ${enemy.nombre}*!\n💰 Ganaste ${money(oroGanado)} y ${expGanada} EXP.`;
    if (subida) resultado += `\n${subida}`;
    if (nuevosTitulos.length) resultado += `\n🏆 ¡Título desbloqueado: ${nuevosTitulos.join(', ')}!`;

    // Invocador puede domar bestias al derrotarlas
    if (r.clase === 'invocador') {
      const bestiaClave = DOMA_BESTIAS[c.enemyKey];
      if (bestiaClave && Math.random() < DOMA_BESTIA_PROB) {
        if (!r.bestiasDomadas) r.bestiasDomadas = [];
        if (!r.bestiasDomadas.includes(bestiaClave)) {
          r.bestiasDomadas.push(bestiaClave);
          resultado += `\n🐺 ¡Domaste a ${enemy.nombre}! Ahora puedes invocarla con #invocar ${bestiaClave}.`;
        }
      }
    }

    return { resultado, terminado: true, tipo: 'victoria' };
  }

  // Daño del enemigo al HP real del jugador (aplica efectos defensivos de la skill)
  let dmgEnemigo = ataqueEnemigo(enemy);
  if (skill) {
    if (skill.reduccion) dmgEnemigo = Math.round(dmgEnemigo * (1 - skill.reduccion));
    if (skill.evadir && Math.random() < skill.evadir) {
      dmgEnemigo = 0;
      resultado += `\n🌀 Esquivaste el ataque.`;
    }
    if (skill.bloquear) {
      dmgEnemigo = 0;
      resultado += `\n🫥 Bloqueaste todo el daño.`;
    }
    r.skillPendiente = null; // skill consumida por completo en este turno
  }
  const dmgFinal = dmgEnemigo === 0 ? 0 : Math.max(1, dmgEnemigo - stats.def);
  c.hpJugador = Math.max(0, c.hpJugador - dmgFinal);

  resultado += dmgFinal === 0
    ? `👹 ${enemy.nombre} atacó pero no te infligió daño.\n`
    : `👹 ${enemy.nombre} te atacó e infligió *${dmgFinal}* de daño.\n`;
  resultado += `❤️ ${barra(c.hpJugador, c.hpMaxJugador)} ${c.hpJugador}/${c.hpMaxJugador}`;

  if (c.hpJugador <= 0) {
    // Derrota: pierde % del oro en mano y queda a % de HP
    const perdida = Math.floor(u.cash * DERROTA_PIERDE_PCT);
    u.cash = Math.max(0, u.cash - perdida);
    c.hpJugador = Math.ceil(c.hpMaxJugador * DERROTA_HP_RESTANTE_PCT);
    r.combate = null;
    r.skillPendiente = null;
    if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
    r.stats.muertes = (r.stats.muertes || 0) + 1;
    resultado += `\n💀 *¡Fuiste derrotado!* Perdiste ${money(perdida)} y escapaste con ${c.hpJugador} de vida.`;
    return { resultado, terminado: true, tipo: 'derrota' };
  }

  if (c.turnos >= COMBATE_MAX_TURNOS) {
    r.combate = null;
    r.skillPendiente = null;
    resultado += `\n⏰ El combate terminó por tiempo. Escapaste.`;
    return { resultado, terminado: true, tipo: 'limite' };
  }

  return { resultado, terminado: false, tipo: null };
};

module.exports = { startCombat, combatTurn, COMBATE_TIMEOUT_MS, COMBATE_MAX_TURNOS };
