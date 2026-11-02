const fs = require('fs');
const path = require('path');

const CLASSES = {
  guerrero: { nombre: '🛡️ Guerrero', hpBase: 120, atkBase: 15, defBase: 8, desc: 'Resistente y fuerte en combate cuerpo a cuerpo.' },
  mago: { nombre: '🔮 Mago', hpBase: 80, atkBase: 20, defBase: 4, desc: 'Daño mágico alto, poca defensa.' },
  arquero: { nombre: '🏹 Arquero', hpBase: 100, atkBase: 16, defBase: 6, desc: 'Ataques a distancia y precisión.' },
  pícaro: { nombre: '🗡️ Pícaro', hpBase: 90, atkBase: 17, defBase: 5, desc: 'Críticos frecuentes y sigilo.' },
};

const WEAPONS = {
  nada: { nombre: 'Puños', atk: 0, precio: 0 },
  espada_hierro: { nombre: '⚔️ Espada de Hierro', atk: 8, precio: 1500 },
  arco_corto: { nombre: '🏹 Arco Corto', atk: 7, precio: 1400 },
  baston_madera: { nombre: '🪵 Bastón de Madera', atk: 6, precio: 1200 },
  daga_aguda: { nombre: '🗡️ Daga Aguda', atk: 7, precio: 1300 },
  espada_acero: { nombre: '⚔️ Espada de Acero', atk: 14, precio: 4000 },
  arco_largo: { nombre: '🏹 Arco Largo', atk: 13, precio: 3800 },
  baston_cristal: { nombre: '🔮 Bastón de Cristal', atk: 12, precio: 3500 },
  daga_venenosa: { nombre: '🗡️ Daga Venenosa', atk: 12, precio: 3600 },
  espada_dragón: { nombre: '🐉 Espada del Dragón', atk: 25, precio: 15000 },
  arco_elfico: { nombre: '🏹 Arco Elfo', atk: 23, precio: 14000 },
  baston_arca: { nombre: '🔮 Bastón Arcano', atk: 21, precio: 13000 },
  daga_sombría: { nombre: '🗡️ Daga Sombría', atk: 22, precio: 13500 },
};

const GUILD_RANKS = [
  { nombre: 'Recluta', requerimiento: 0 },
  { nombre: 'Miembro', requerimiento: 5000 },
  { nombre: 'Veterano', requerimiento: 20000 },
  { nombre: 'Oficial', requerimiento: 50000 },
  { nombre: 'Líder', requerimiento: 100000 },
];

const HOUSES = {
  choza: { nombre: '🏠 Choza', precio: 5000, beneficio: 'hp', valor: 10 },
  cabaña: { nombre: '🌲 Cabaña', precio: 15000, beneficio: 'hp', valor: 25 },
  casa: { nombre: '🏡 Casa', precio: 40000, beneficio: 'hp', valor: 50 },
  mansión: { nombre: '🏰 Mansión', precio: 100000, beneficio: 'atk', valor: 5 },
  castillo: { nombre: '🏰 Castillo', precio: 250000, beneficio: 'all', valor: 10 },
};

const MISSIONS = {
  cazador: { nombre: '🏹 Cazador de Jabalíes', objetivo: 'matar 3 jabalíes', recompensa: 3000, exp: 50, dificultad: 1 },
  explorador: { nombre: '🗺️ Explorador de Ruinas', objetivo: 'encontrar 5 fragmentos', recompensa: 5000, exp: 80, dificultad: 2 },
  asesino: { nombre: '⚔️ Eliminar Bandido', objetivo: 'derrotar al bandido jefe', recompensa: 8000, exp: 120, dificultad: 3 },
  caballero: { nombre: '🐉 Matar Dragón Joven', objetivo: 'derrotar al dragón', recompensa: 15000, exp: 200, dificultad: 5 },
};

const ENEMIES = {
  jabali: { nombre: '🐗 Jabalí', hp: 60, atk: 8, exp: 30, oro: 100 },
  lobo: { nombre: '🐺 Lobo', hp: 80, atk: 12, exp: 50, oro: 200 },
  bandido: { nombre: '🏴‍☠️ Bandido', hp: 120, atk: 18, exp: 80, oro: 400 },
  esqueleto: { nombre: '💀 Esqueleto', hp: 100, atk: 15, exp: 70, oro: 300 },
  dragon: { nombre: '🐉 Dragón Joven', hp: 300, atk: 35, exp: 250, oro: 1000 },
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const money = (n) => '¥' + Number(n || 0).toLocaleString('en-US') + ' Coins';

const classLabel = (key) => {
  const c = CLASSES[key];
  return c ? c.nombre : 'Sin clase';
};

const weaponLabel = (key) => {
  const w = WEAPONS[key];
  return w ? w.nombre : 'Puños';
};

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
  return r;
};

const getAvailableMissions = (nivel) => {
  const disponibles = [];
  for (const [key, m] of Object.entries(MISSIONS)) {
    if (nivel >= m.dificultad) disponibles.push({ key, ...m });
  }
  return disponibles;
};

const startMission = (u, missionKey) => {
  const m = MISSIONS[missionKey];
  if (!m) return null;
  const r = u.rpg;
  if (r.misiones[missionKey]) return null; // ya tiene esta misión activa
  r.misiones[missionKey] = {
    progreso: 0,
    objetivo: m.objetivo,
    completada: false,
    iniciada: Date.now(),
  };
  return m;
};

const completeMission = (u, missionKey) => {
  const m = MISSIONS[missionKey];
  const r = u.rpg;
  if (!r.misiones[missionKey]) return null;
  delete r.misiones[missionKey];
  r.misionesCompletadas.push(missionKey);
  u.cash += m.recompensa;
  u.rpg.exp += m.exp;
  // Subir nivel cada 100 exp
  while (u.rpg.exp >= u.rpg.nivel * 100) {
    u.rpg.exp -= u.rpg.nivel * 100;
    u.rpg.nivel += 1;
  }
  return m;
};

const startCombat = (u, enemyKey) => {
  const enemy = ENEMIES[enemyKey];
  if (!enemy) return null;
  u.rpg.combate = {
    enemyKey,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    turnos: 0,
  };
  return enemy;
};

const combatTurn = (u, action) => {
  const c = u.rpg.combate;
  if (!c) return null;
  const enemy = ENEMIES[c.enemyKey];
  c.turnos += 1;

  const r = u.rpg;
  const clase = r.clase ? CLASSES[r.clase] : { atkBase: 10, hpBase: 100 };
  const arma = WEAPONS[r.arma] || { atk: 0 };
  const casa = r.casa ? HOUSES[r.casa] : null;

  // Daño del jugador
  const dmgJugador = Math.max(1, clase.atkBase + arma.atk + (casa?.valor || 0) + rand(-3, 5));
  c.enemyHp -= dmgJugador;

  let resultado = `🗡️ Atacaste a *${enemy.nombre}* e infligiste *${dmgJugador}* de daño.\n`;

  if (c.enemyHp <= 0) {
    const oroGanado = enemy.oro;
    const expGanada = enemy.exp;
    u.cash += oroGanado;
    r.exp += expGanada;
    r.combate = null;
    while (r.exp >= r.nivel * 100) {
      r.exp -= r.nivel * 100;
      r.nivel += 1;
    }
    resultado += `\n💀 *Derrotaste a ${enemy.nombre}*!\n💰 Ganaste ${money(oroGanado)} y ${expGanada} EXP.`;
    return { resultado, terminado: true };
  }

  // Daño del enemigo
  const dmgEnemigo = Math.max(1, enemy.atk + rand(-5, 5));
  const defensaTotal = clase.defBase + (casa?.beneficio === 'hp' ? casa.valor : 0);
  const dmgFinal = Math.max(0, dmgEnemigo - defensaTotal);
  u.cash = Math.max(0, u.cash); // no afecta cash

  resultado += `👹 ${enemy.nombre} te atacó e infligió *${dmgFinal}* de daño.`;

  if (dmgFinal > 0) {
    // Reducir "hp virtual" - usamos oro como medida simple o solo registramos
    resultado += `\n❤️ Te queda *${Math.max(0, 100 - c.turnos * dmgFinal)}* de vitalidad estimada.`;
  }

  if (c.turnos >= 10) {
    r.combate = null;
    resultado += `\n⏰ El combate terminó por tiempo. Escapaste.`;
    return { resultado, terminado: true };
  }

  return { resultado, terminado: false };
};

module.exports = {
  CLASSES,
  WEAPONS,
  GUILD_RANKS,
  HOUSES,
  MISSIONS,
  ENEMIES,
  rand,
  money,
  classLabel,
  weaponLabel,
  ensureRPG,
  ensureGuild,
  getGuildRank,
  getHouseBenefit,
  getAvailableMissions,
  startMission,
  completeMission,
  startCombat,
  combatTurn,
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

const getHouseBenefit = (houseKey) => {
  return HOUSES[houseKey] || null;
};

module.exports = {
  CLASSES,
  WEAPONS,
  GUILD_RANKS,
  HOUSES,
  rand,
  money,
  classLabel,
  weaponLabel,
  ensureRPG,
  ensureGuild,
  getGuildRank,
  getHouseBenefit,
};