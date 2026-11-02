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

const BOSSSES = {
  slime: { nombre: '🟣 Rey Slime', hp: 200, atk: 15, exp: 100, oro: 2000, dificultad: 1 },
  orco: { nombre: '👹 Señor Orco', hp: 350, atk: 22, exp: 250, oro: 4000, dificultad: 2 },
  hechicero: { nombre: '🧙 Hechicero Oscuro', hp: 300, atk: 30, exp: 350, oro: 6000, dificultad: 3 },
  golem: { nombre: '🗿 Golem de Piedra', hp: 600, atk: 20, exp: 500, oro: 8000, dificultad: 4 },
  vampiro: { nombre: '🧛 Señor Vampiro', hp: 450, atk: 35, exp: 700, oro: 10000, dificultad: 5 },
  dragon_viejo: { nombre: '🐉 Dragón Ancestral', hp: 1000, atk: 45, exp: 1200, oro: 20000, dificultad: 7 },
};

const CHESTS = {
  comun: { nombre: '📦 Cofre Común', costo: 500, min: 200, max: 1500, trampa: 5 },
  raro: { nombre: '🎁 Cofre Raro', costo: 1500, min: 1000, max: 4000, trampa: 15 },
  epico: { nombre: '✨ Cofre Épico', costo: 5000, min: 3000, max: 12000, trampa: 25 },
  legendario: { nombre: '👑 Cofre Legendario', costo: 15000, min: 10000, max: 50000, trampa: 40 },
};

const WEAPON_CLASSES = {
  espada: { nombre: '🗡️ Espada', bonificacion: 'atk', valor: 2, desc: 'Ataque equilibrado y confiable.' },
  arco: { nombre: '🏹 Arco', bonificacion: 'crit', valor: 5, desc: 'Mayor probabilidad de golpe crítico.' },
  baston: { nombre: '🪵 Bastón', bonificacion: 'exp', valor: 10, desc: 'Ganas más experiencia en combate.' },
  daga: { nombre: '🔪 Daga', bonificacion: 'velocidad', valor: 3, desc: 'Ataques más rápidos, más turnos.' },
};

const SKILLS = {
  guerrero: {
    golpe_fuerte: { nombre: '💥 Golpe Fuerte', descripcion: 'Ataque potente que causa 1.5x daño.', costo: 10, multiplicador: 1.5 },
    escudo: { nombre: '🛡️ Escudo', descripcion: 'Reduce daño entrante un 50% este turno.', costo: 15, reduccion: 0.5 },
  },
  mago: {
    bola_fuego: { nombre: '🔥 Bola de Fuego', descripcion: 'Causa 2x daño mágico.', costo: 20, multiplicador: 2 },
    curacion: { nombre: '✨ Curación', descripcion: 'Recupera 30 de vida en combate.', costo: 15, curacion: 30 },
  },
  arquero: {
    disparo_preciso: { nombre: '🎯 Disparo Preciso', descripcion: 'Golpe crítico garantizado (2x daño).', costo: 12, multiplicador: 2 },
    evasion: { nombre: '🌀 Evasión', descripcion: '50% de probabilidad de esquivar el próximo ataque.', costo: 18, evadir: 0.5 },
  },
  pícaro: {
    ataque_sombra: { nombre: '🌑 Ataque en Sombra', descripcion: 'Causa 1.8x daño y roba oro.', costo: 18, multiplicador: 1.8, roba_oro: true },
    sigilo: { nombre: '🫥 Sigilo', descripcion: 'El siguiente turno no recibes daño.', costo: 25, bloquear: true },
  },
};

const EVENTOS_MAZMORRA = {
  cofre_oculto: { nombre: '📦 Cofre Oculto', desc: 'Encontraste un cofre escondido en la pared.', tipo: 'oro', min: 500, max: 3000, prob: 30 },
  trampa_sombra: { nombre: '🌑 Trampa de Sombras', desc: 'Una sombra te emboscó y te quitó oro.', tipo: 'perder_oro', min: 100, max: 1000, prob: 20 },
  pozo_sano: { nombre: '💧 Pozo Sanador', desc: 'Bebiste de un pozo y te sentiste renovado.', tipo: 'curar', valor: 50, prob: 15 },
  altar_sacrificio: { nombre: '⚔️ Altar de Sacrificio', desc: 'Sacrificaste oro para ganar fuerza.', tipo: 'sacrificio', min: 500, max: 2000, prob: 10 },
  encuentro_mistico: { nombre: '✨ Encuentro Místico', desc: 'Un ser místico te otorgó experiencia extra.', tipo: 'exp', min: 100, max: 500, prob: 25 },
};

const COMBINACIONES_SKILLS = {
  'golpe_fuerte+escudo': { nombre: '💥🛡️ Golpe Escudo', descripcion: 'Ataque potente con reducción de daño.', clases: ['guerrero'], skill1: 'golpe_fuerte', skill2: 'escudo', resultado: 'golpe_escudo', costo: 20 },
  'bola_fuego+curacion': { nombre: '🔥✨ Fuego Sanador', descripcion: 'Ataca y te curas al mismo tiempo.', clases: ['mago'], skill1: 'bola_fuego', skill2: 'curacion', resultado: 'fuego_sanador', costo: 25 },
  'disparo_preciso+evasion': { nombre: '🎯🌀 Tiro Evasivo', descripcion: 'Disparo crítico con posibilidad de esquivar.', clases: ['arquero'], skill1: 'disparo_preciso', skill2: 'evasion', resultado: 'tiro_evasivo', costo: 22 },
  'ataque_sombra+sigilo': { nombre: '🌑🫥 Sombra Sigilosa', descripcion: 'Ataque desde las sombras sin ser detectado.', clases: ['pícaro'], skill1: 'ataque_sombra', skill2: 'sigilo', resultado: 'sombra_sigilosa', costo: 30 },
};

const EVOLUCIONES_CLASE = {
  pícaro: { nombre: 'asesino', requisito: 15, costo: 0 },
  arquero: { nombre: 'gran_arquero', requisito: 15, costo: 0 },
  guerrero: { nombre: 'caballero', requisito: 15, costo: 0 },
  mago: { nombre: 'archimago', requisito: 15, costo: 0 },
};

const NUEVAS_CLASES = {
  asesino: { nombre: '🔪 Asesino', hpBase: 100, atkBase: 22, defBase: 6, desc: 'Maestro del sigilo y golpes mortales.' },
  gran_arquero: { nombre: '🏹 Gran Arquero', hpBase: 110, atkBase: 20, defBase: 7, desc: 'Experto en arquería y trampas a distancia.' },
  caballero: { nombre: '⚔️ Caballero', hpBase: 150, atkBase: 18, defBase: 12, desc: 'Guerrero elite con armadura pesada y honor.' },
  archimago: { nombre: '🔮 Archimago', hpBase: 90, atkBase: 25, defBase: 5, desc: 'Maestro de las artes arcanas y elementos.' },
  invocador: { nombre: '👹 Invocador', hpBase: 95, atkBase: 14, defBase: 6, desc: 'Domador de bestias y maestro de invocaciones.' },
  nigromante: { nombre: '💀 Nigromante', hpBase: 85, atkBase: 19, defBase: 4, desc: 'Controla los muertos y la magia oscura.' },
};

const HABILIDADES_POR_NIVEL = {
  guerrero: [
    { nivel: 5, key: 'golpe_fuerte', nombre: '💥 Golpe Fuerte', costo: 10 },
    { nivel: 10, key: 'escudo', nombre: '🛡️ Escudo', costo: 15 },
    { nivel: 15, key: 'embestida', nombre: '🐂 Embestida', costo: 20 },
    { nivel: 20, key: 'furia', nombre: '😡 Furia Berserker', costo: 25 },
  ],
  mago: [
    { nivel: 5, key: 'bola_fuego', nombre: '🔥 Bola de Fuego', costo: 20 },
    { nivel: 10, key: 'curacion', nombre: '✨ Curación', costo: 15 },
    { nivel: 15, key: 'rayo', nombre: '⚡ Rayo', costo: 25 },
    { nivel: 20, key: 'meteorito', nombre: '☄️ Meteorito', costo: 40 },
  ],
  arquero: [
    { nivel: 5, key: 'disparo_preciso', nombre: '🎯 Disparo Preciso', costo: 12 },
    { nivel: 10, key: 'evasion', nombre: '🌀 Evasión', costo: 18 },
    { nivel: 15, key: 'disparo_rapido', nombre: '⚡ Disparo Rápido', costo: 22 },
    { nivel: 20, key: 'lluvia_flechas', nombre: '🌧️ Lluvia de Flechas', costo: 35 },
  ],
  pícaro: [
    { nivel: 5, key: 'ataque_sombra', nombre: '🌑 Ataque en Sombra', costo: 18 },
    { nivel: 10, key: 'sigilo', nombre: '🫥 Sigilo', costo: 25 },
    { nivel: 15, key: 'dagas_venenosas', nombre: '☠️ Dagas Venenosas', costo: 28 },
    { nivel: 20, key: 'golpe_mortal', nombre: '💀 Golpe Mortal', costo: 45 },
  ],
  asesino: [
    { nivel: 15, key: 'golpe_silencioso', nombre: '🤫 Golpe Silencioso', costo: 20 },
    { nivel: 20, key: 'asesinato', nombre: '⚰️ Asesinato', costo: 40 },
  ],
  gran_arquero: [
    { nivel: 15, key: 'punteria_mortal', nombre: '🎯 Puntería Mortal', costo: 20 },
    { nivel: 20, key: 'flecha_explosiva', nombre: '💣 Flecha Explosiva', costo: 40 },
  ],
  caballero: [
    { nivel: 15, key: 'escudo_sagrado', nombre: '✨ Escudo Sagrado', costo: 20 },
    { nivel: 20, key: 'golpe_divino', nombre: '⚡ Golpe Divino', costo: 40 },
  ],
  archimago: [
    { nivel: 15, key: 'conejo_arcano', nombre: '🌀 Conejo Arcano', costo: 20 },
    { nivel: 20, key: 'invocacion_demonios', nombre: '👹 Invocación Demonios', costo: 45 },
  ],
  invocador: [
    { nivel: 5, key: 'domar_bestia', nombre: '🐺 Domar Bestia', costo: 15 },
    { nivel: 10, key: 'invocacion', nombre: '👹 Invocación', costo: 25 },
    { nivel: 15, key: 'bestia_alpha', nombre: '🐉 Bestia Alpha', costo: 40 },
  ],
  nigromante: [
    { nivel: 5, key: 'animar_muerto', nombre: '💀 Animar Muerto', costo: 15 },
    { nivel: 10, key: 'explosion_ossea', nombre: '🦴 Explosión Ósea', costo: 28 },
    { nivel: 15, key: 'ejercito_sombras', nombre: '👥 Ejército de Sombras', costo: 45 },
  ],
};

const HABILIDADES_ESPECIALES = {
  10: { key: 'golpe_epico', nombre: '⭐ Golpe Épico', descripcion: 'Daño masivo 3x. Solo cada 10 niveles.', costo: 50 },
  20: { key: 'habilidad_ultima', nombre: '🌟 Habilidad Última', descripcion: 'Tu poder máximo desbloqueado.', costo: 100 },
  30: { key: 'dios_de_la_guerra', nombre: '⚡ Dios de la Guerra', descripcion: 'Inmortalidad temporal por 3 turnos.', costo: 200 },
  40: { key: 'final_eclipse', nombre: '���� Eclipse Final', descripcion: 'Aniquila a todos los enemigos.', costo: 500 },
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

const openChest = (u, chestKey) => {
  const chest = CHESTS[chestKey];
  if (!chest) return null;
  const r = u.rpg;
  if (u.cash < chest.costo) return { error: 'No tienes suficiente dinero para abrir este cofre.' };

  u.cash = Math.max(0, u.cash - chest.costo);
  const esTrampa = Math.random() * 100 < chest.trampa;

  if (esTrampa) {
    const perdida = Math.floor(u.cash * 0.5);
    u.cash = Math.max(0, u.cash - perdida);
    return {
      tipo: 'trampa',
      mensaje: `💀 ¡Trampa! El cofre explota y pierdes ${money(perdida)}.`,
      costo: chest.costo,
      perdida,
    };
  }

  const ganancia = rand(chest.min, chest.max);
  u.cash += ganancia;
  return {
    tipo: 'exito',
    mensaje: `🎉 ¡Cofre abierto! Encontraste ${money(ganancia)}.`,
    costo: chest.costo,
    ganancia,
  };
};

const useSkill = (u, skillKey) => {
  const r = u.rpg;
  if (!r.clase || !SKILLS[r.clase]) return { error: 'No tienes una clase seleccionada.' };
  const skill = SKILLS[r.clase][skillKey];
  if (!skill) return { error: 'Esa habilidad no existe para tu clase.' };
  if (u.cash < skill.costo) return { error: `No tienes suficiente oro. Costo: ${money(skill.costo)}.` };

  u.cash = Math.max(0, u.cash - skill.costo);
  return { skill, costo: skill.costo };
};

const generarEventoMazmorra = (u) => {
  const r = Math.random() * 100;
  let acumulado = 0;
  for (const [key, ev] of Object.entries(EVENTOS_MAZMORRA)) {
    acumulado += ev.prob;
    if (r <= acumulado) {
      if (ev.tipo === 'oro') {
        const ganancia = rand(ev.min, ev.max);
        u.cash += ganancia;
        return { tipo: 'oro', mensaje: `📦 ${ev.desc}\n💰 Encontraste ${money(ganancia)}.`, ganancia };
      }
      if (ev.tipo === 'perder_oro') {
        const perdida = Math.min(u.cash, rand(ev.min, ev.max));
        u.cash = Math.max(0, u.cash - perdida);
        return { tipo: 'perder_oro', mensaje: `🌑 ${ev.desc}\n💸 Perdiste ${money(perdida)}.`, perdida };
      }
      if (ev.tipo === 'curar') {
        return { tipo: 'curar', mensaje: `💧 ${ev.desc}\n❤️ Te sientes renovado (+${ev.valor} vitalidad).` };
      }
      if (ev.tipo === 'sacrificio') {
        const costo = Math.min(u.cash, rand(ev.min, ev.max));
        u.cash = Math.max(0, u.cash - costo);
        const bono = Math.floor(costo * 1.5);
        return { tipo: 'sacrificio', mensaje: `⚔️ ${ev.desc}\n💸 Sacrificaste ${money(costo)} para ganar fuerza.`, costo, bono };
      }
      if (ev.tipo === 'exp') {
        const expGanada = rand(ev.min, ev.max);
        u.rpg.exp += expGanada;
        while (u.rpg.exp >= u.rpg.nivel * 100) {
          u.rpg.exp -= u.rpg.nivel * 100;
          u.rpg.nivel += 1;
        }
        return { tipo: 'exp', mensaje: `✨ ${ev.desc}\n⭐ Ganaste ${expGanada} EXP.`, exp: expGanada };
      }
    }
  }
  return { tipo: 'nada', mensaje: '🚶 Nada especial ocurrió en este piso.' };
};

const combinarSkills = (u, key1, key2) => {
  const r = u.rpg;
  if (!r.clase || !SKILLS[r.clase]) return { error: 'No tienes una clase seleccionada.' };

  const claseSkills = SKILLS[r.clase];
  if (!claseSkills[key1] || !claseSkills[key2]) {
    return { error: 'Una o ambas habilidades no existen para tu clase.' };
  }

  const combinacionKey = `${key1}+${key2}`;
  const combinacionInversa = `${key2}+${key1}`;
  const comb = COMBINACIONES_SKILLS[combinacionKey] || COMBINACIONES_SKILLS[combinacionInversa];

  if (!comb) {
    return { error: 'No se pueden combinar esas dos habilidades.' };
  }

  if (!comb.clases.includes(r.clase)) {
    return { error: 'Esta combinación no está disponible para tu clase.' };
  }

  if (u.cash < comb.costo) {
    return { error: `No tienes suficiente oro. Costo: ${money(comb.costo)}.` };
  }

  if (!r.skillsCombinadas) r.skillsCombinadas = [];
  if (r.skillsCombinadas.includes(comb.resultado)) {
    return { error: 'Ya has combinado estas habilidades anteriormente.' };
  }

  u.cash = Math.max(0, u.cash - comb.costo);
  r.skillsCombinadas.push(comb.resultado);

  return {
    tipo: 'exito',
    mensaje: `✨ ¡Habilidades combinadas!\n🎯 Nueva habilidad: *${comb.nombre}*\n${comb.descripcion}\nCosto: ${money(comb.costo)}`,
    resultado: comb.resultado,
  };
};

const getStats = (u) => {
  rpg.ensureRPG(u);
  const r = u.rpg;
  const clase = r.clase ? CLASSES[r.clase] : null;
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

  return {
    clase: clase ? clase.nombre : 'Sin clase',
    nivel: r.nivel || 1,
    exp: r.exp || 0,
    expSiguiente: (r.nivel || 1) * 100,
    oro: r.oro || 0,
    cash: typeof u.cash === 'number' ? u.cash : 0,
    bank: typeof u.bank === 'number' ? u.bank : 0,
    atk: atkTotal,
    def: defTotal,
    hp: hpTotal,
    habilidades: r.skillsCombinadas || [],
    misionesCompletadas: r.misionesCompletadas || [],
    gremio: r.gremio ? 'Sí' : 'No',
    casa: casa ? casa.nombre : 'Ninguna',
    nombrePersonalizado: r.nombrePersonalizado || 'Sin nombre',
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

const getHouseBenefit = (houseKey) => {
  return HOUSES[houseKey] || null;
};

const evolucionarClase = (u, nuevaClave) => {
  const r = u.rpg;
  const actual = r.clase;
  const evo = EVOLUCIONES_CLASE[actual];
  if (!evo || evo.nombre !== nuevaClave) {
    return { error: 'No puedes evolucionar a esa clase desde tu clase actual.' };
  }
  if (r.nivel < evo.requisito) {
    return { error: `Necesitas nivel ${evo.requisito} para evolucionar. Tu nivel: ${r.nivel}.` };
  }
  if (r.claseEvolucionada) {
    return { error: 'Ya evolucionaste tu clase.' };
  }

  const nueva = NUEVAS_CLASES[nuevaClave];
  if (!nueva) return { error: 'Clase de destino no encontrada.' };

  r.clase = nuevaClave;
  r.claseEvolucionada = true;
  return {
    exito: true,
    mensaje: `✨ ¡Has evolucionado a *${nueva.nombre}*!`,
    nueva,
  };
};

const obtenerHabilidadesNivel = (u) => {
  const r = u.rpg;
  if (!r.clase) return [];
  const claseKey = r.clase;
  const lista = HABILIDADES_POR_NIVEL[claseKey] || [];
  const desbloqueadas = r.habilidadesDesbloqueadas || [];
  const disponibles = [];
  for (const h of lista) {
    if (r.nivel >= h.nivel && !desbloqueadas.includes(h.key)) {
      disponibles.push(h);
    }
  }
  return disponibles;
};

const desbloquearHabilidadPorNivel = (u, key) => {
  const r = u.rpg;
  if (!r.clase) return { error: 'No tienes clase.' };
  const lista = HABILIDADES_POR_NIVEL[r.clase] || [];
  const hab = lista.find((h) => h.key === key);
  if (!hab) return { error: 'Habilidad no encontrada para tu clase.' };
  if (r.nivel < hab.nivel) return { error: `Necesitas nivel ${hab.nivel} para desbloquear ${hab.nombre}.` };
  if (!r.habilidadesDesbloqueadas) r.habilidadesDesbloqueadas = [];
  if (r.habilidadesDesbloqueadas.includes(key)) return { error: 'Ya desbloqueaste esta habilidad.' };
  r.habilidadesDesbloqueadas.push(key);
  return { exito: true, habilidad: hab };
};

const obtenerHabilidadEspecial = (nivel) => {
  if (nivel % 10 !== 0) return null;
  return HABILIDADES_ESPECIALES[nivel] || null;
};

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

module.exports = {
  CLASSES,
  WEAPONS,
  GUILD_RANKS,
  HOUSES,
  MISSIONS,
  ENEMIES,
  BOSSSES,
  CHESTS,
  WEAPON_CLASSES,
  SKILLS,
  EVOLUCIONES_CLASE,
  NUEVAS_CLASES,
  HABILIDADES_POR_NIVEL,
  HABILIDADES_ESPECIALES,
  EVENTOS_MAZMORRA,
  COMBINACIONES_SKILLS,
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
  openChest,
  useSkill,
  generarEventoMazmorra,
  combinarSkills,
  getStats,
  evolucionarClase,
  obtenerHabilidadesNivel,
  desbloquearHabilidadPorNivel,
  obtenerHabilidadEspecial,
  getStatsCompletos,
};