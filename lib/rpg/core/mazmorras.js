// FASE C — Mazmorras: incursión por pisos sin apuesta, enemigos temáticos por jefe,
// checkpoints, muerte sin perder EXP, exclusión de combo.
// Estado en u.rpg.mazmorras: { [claveMazmorra]: { maxPiso, checkpoint, jefesVencidos, intentos, enCombate, pisoEnemy, ultimoPiso } }

const { ENEMIGOS_MAZMORRA } = require('../data/mazmorras');
const { startCombat, combatTurn, puedeCombatir } = require('./combat');
const { getStats } = require('./stats');
const { addExp, checkTitles } = require('./progression');
const { ensureRPG } = require('./migrate');
const { money } = require('./narrate');
const { rand } = require('./narrate');

const PISOS_POR_JEFE = 10;
const PISOS_TOTALES = 30;
const MUERTE_PERDIDA_PCT = 0.5;

const mazmorraDe = (u) => {
  const r = ensureRPG(u);
  if (!r.mazmorras) r.mazmorras = {};
  return r.mazmorras;
};

const obtenerMazmorra = (clave) => {
  const { ENEMIGOS_MAZMORRA } = require('../data/mazmorras');
  // Buscar en todos los enemigos de todas las mazmorras
  for (const [mk, zona] of Object.entries(ENEMIGOS_MAZMORRA)) {
    if (zona.enemigos[clave]) return { clave: mk, zona: mk, def: zona.enemigos[clave] };
  }
  return null;
};

const listaMazmorras = () => {
  const { ENEMIGOS_MAZMORRA } = require('../data/mazmorras');
  return Object.entries(ENEMIGOS_MAZMORRA).map(([clave, zona]) => ({
    clave,
    nombre: zona.nombre,
    nivelMin: zona.nivelMin,
    nivelMax: zona.nivelMax,
    jefe1: zona.jefes[0],
    jefe2: zona.jefes[1],
    jefe3: zona.jefes[2],
  }));
};

const abrirMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = mazmorraDe(u);
  const def = obtenerMazmorra(clave);
  if (!def) return { error: 'Mazmorra no encontrada.' };
  if (r.combate) return { error: 'Estás en combate. Terminalo antes de entrar.' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;

  const nivelBase = def.def.nivelMin || 1;
  const mData = {
    clave,
    nombre: def.def.nombre,
    piso: 0,
    pisosVencidos: 0,
    checkpoint: 0,
    jefesVencidos: [],
    enCombate: false,
    pisoEnemy: null,
    iniciado: Date.now(),
    lastAct: Date.now(),
  };
  m[clave] = mData;
  const res = resolverPiso(u, mData);
  return { tipo: res.tipo, texto: `🏰 *Mazmorra ${def.def.nombre}* (nivel ${def.def.nivelMin}-${def.def.nivelMax})\n${res.texto}` };
};

const resolverPiso = (u, m) => {
  m.piso += 1;
  m.lastAct = Date.now();
  const piso = m.piso;
  const esJefe = piso % PISOS_POR_JEFE === 0;
  const base = `🏰 *Mazmorra ${m.clave} — Piso ${piso}*\n📊 Progreso: ${m.pisosVencidos}/${PISOS_TOTALES}\n`;

  if (esJefe) {
    const jefeIdx = (piso / PISOS_POR_JEFE) - 1;
    const jefeDef = ENEMIGOS_MAZMORRA[m.clave].jefes[jefeIdx];
    const enemigo = crearEnemigoJefe(jefeDef, piso);
    m.pisoEnemy = { clave: enemigo.clave, nombre: enemigo.nombre, esJefe: true, oro: enemigo.oro };
    const iniciado = startCombat(u, enemigo.clave, { enemy: enemigo });
    if (!iniciado) {
      m.piso -= 1;
      m.pisoEnemy = null;
      return { tipo: 'error', texto: `${base}\n⚠️ No se pudo iniciar el combate del jefe. Volvé a intentar con #avanzar.` };
    }
    m.enCombate = true;
    return { tipo: 'combate', texto: `${base}\n👑 *JEFE DEL PISO ${piso}*: *${enemigo.nombre}*\nUsá #atk para atacar, #hab <n> para una habilidad o #def para defenderte.` };
  }

  // Piso normal: sorteo entre enemigos normales del jefe del bloque actual
  const bloque = Math.floor((piso - 1) / PISOS_POR_JEFE);
  const jefeDelBloque = ENEMIGOS_MAZMORRA[m.clave].jefes[bloque];
  const séquito = ENEMIGOS_MAZMORRA[`${m.clave}_${jefeDef.clave.replace(' ', '_').toLowerCase()}`] || {};
  // Buscar enemigos del séquito de este jefe
  const enemigosDelJefe = Object.values(ENEMIGOS_MAZMORRA).filter(e => 
    e.clave.startsWith(`${m.clave}_`) && e.clave.includes(jefeDef.clave.toLowerCase().replace(' ', '_'))
  );
  
  const roll = Math.random() * 100;
  let tipoPiso = 'combate';
  if (roll < 20) tipoPiso = 'evento';
  
  if (tipoPiso === 'combate') {
    const esElite = Math.random() * 100 < 15;
    const pool = esElite ? enemigosDelJefe.filter(e => e.tipo === 'elite') : enemigosDelJefe.filter(e => e.tipo === 'normal');
    const enemigo = pool[Math.floor(Math.random() * pool.length)];
    const iniciado = startCombat(u, enemigo.clave, { enemy: enemigo });
    if (!iniciado) {
      m.piso -= 1;
      m.pisoEnemy = null;
      return { tipo: 'error', texto: `${base}\n⚠️ No se pudo iniciar el combate. Volvé a intentar con #avanzar.` };
    }
    m.enCombate = true;
    const marca = enemigo.tipo === 'elite' ? '⭐ *Élite*' : `Nv ${enemigo.nivel}`;
    return { tipo: 'combate', texto: `${base}\n⚔️ ${marca}: *${enemigo.nombre}*\nUsá #atk para atacar, #hab <n> para una habilidad o #def para defenderte.` };
  } else {
    // Evento
    const tipoEvento = Math.random() * 100;
    let evTipo, evTexto;
    if (tipoEvento < 30) {
      // Tesoro
      const oro = Math.floor(20 + 6 * m.piso);
      u.cash = Math.max(0, u.cash + oro);
      m.pisosVencidos += 1;
      evTipo = 'tesoro';
      evTexto = `📦 *Tesoro del piso*: encontraste ${money(oro)}.`;
    } else if (tipoEvento < 50) {
      // Santuario
      const s = getStats(u);
      u.rpg.hp = s.hp;
      u.rpg.ki = s.kiMax;
      m.pisosVencidos += 1;
      evTipo = 'santuario';
      evTexto = `⛩️ *Santuario de descanso*: HP y Ki restaurados al 100% (${s.hp}/${s.hp} HP · ${s.kiMax}/${s.kiMax} Ki).`;
    } else if (tipoEvento < 65) {
      // Mercader
      evTipo = 'mercader';
      evTexto = `🛒 *Mercader Errante*: Puedes comprar pociones y materiales. Usá #comprar para ver lo disponible.`;
    } else if (tipoEvento < 80) {
      // Sanadora
      const s = getStats(u);
      const cura = Math.round(s.hp * 0.4);
      u.rpg.hp = Math.min(s.hp, u.rpg.hp + cura);
      m.pisosVencidos += 1;
      evTipo = 'santuario';
      evTexto = `💧 *Pozo Sanador*: ${cura} HP restaurados (${u.rpg.hp}/${s.hp}).`;
    } else if (tipoEvento < 85) {
      // Ermitaño
      const s = getStats(u);
      const bonoAtk = Math.round(s.atk * 0.10);
      m.pisosVencidos += 1;
      evTipo = 'ermitaño';
      evTexto = `✨ *Ermitaño Instructor*: Tu ataque sube un 10% durante los próximos 3 combates (+${bonoAtk} ATK temporal).`;
      u.rpg.bonoAtkTemporal = (u.rpg.bonoAtkTemporal || 0) + 0.10;
      u.rpg.bonoPisos = (u.rpg.bonoPisos || 0) + 3;
    } else {
      // Cofre con trampa
      const s = getStats(u);
      const hpPerd = Math.max(1, Math.round(s.hp * 0.08));
      u.rpg.hp = Math.max(1, u.rpg.hp - hpPerd);
      m.pisosVencidos += 1;
      evTipo = 'trampa';
      evTexto = `💀 *Cofre con Trampa*: perdiste ${hpPerd} HP (${u.rpg.hp}/${s.hp}).`;
    }
    
    const nuevos = checkTitles(u);
    let texto = `${base}\n${evTexto}`;
    if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
    texto += `\nUsá #avanzar para seguir o #retirarse para cobrar.`;
    return { tipo: evTipo, texto };
  }
};

const crearEnemigoJefe = (jefeDef, piso) => {
  const s = escala(jefeDef.nivelBase + Math.floor((piso - 1) * 0.6), 'jefe');
  const recompensa = recompensas(jefeDef.nivelBase + Math.floor((piso - 1) * 0.6));
  return {
    clave: jefeDef.clave,
    nombre: jefeDef.nombre,
    nivel: jefeDef.nivelBase + Math.floor((piso - 1) * 0.6),
    tipo: 'jefe',
    elemento: jefeDef.elemento,
    arquetipo: 'jefe',
    hp: Math.max(1, Math.round((ESCALADO.hp.base + ESCALADO.hp.porNivel * (jefeDef.nivelBase + Math.floor((piso - 1) * 0.6))) * ESCALADO.jefe.hpMult)),
    atk: Math.max(1, Math.round((ESCALADO.atk.base + ESCALADO.atk.porNivel * (jefeDef.nivelBase + Math.floor((piso - 1) * 0.6))) * ESCALADO.jefe.atkMult)),
    def: Math.round(ESCALADO.def.base + ESCALADO.def.porNivel * (jefeDef.nivelBase + Math.floor((piso - 1) * 0.6))),
    vel: Math.round(ESCALADO.vel.base + ESCALADO.vel.porNivel * (jefeDef.nivelBase + Math.floor((piso - 1) * 0.6))),
    oro: recompensa.oro + (jefeDef.oroBase || 300) + (jefeDef.oroPorPiso || 40) * piso,
    exp: recompensa.exp * 5,
    zona: 'mazmorra',
    esJefe: true,
    séquito: jefeDef.séquito || [],
    élite: jefeDef.élite,
    banner: jefeDef.banner,
  };
};

const avanzarMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = r.mazmorras && r.mazmorras[clave];
  if (!m) return { error: 'No tenés una mazmorra abierta. Abríla con #mazmorra <id>.' };
  if (m.enCombate) return { error: 'Tenés un combate en curso. Terminalo con #atk, #hab o #def.' };
  if (u.rpg.combate) return { error: 'Estás en combate. Terminalo antes de avanzar (#huir para escapar).' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;
  return resolverPiso(u, m);
};

const retirarMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = r.mazmorras && r.mazmorras[clave];
  if (!m) return { error: 'No tenés una mazmorra abierta.' };
  if (m.enCombate || u.rpg.combate) return { error: 'No podés retirarte en medio de un combate.' };
  u.rpg.mazmorras[clave] = null;
  return {
    pisos: m.pisosVencidos,
    botín: m.botín || 0,
    texto: `🏰 *Retirada de ${m.clave}*\nPisos superados: ${m.pisosVencidos}\n💰 Botín conservado: *${money(m.botín || 0)}*`,
  };
};

const mazmorraPostCombate = (u, result) => {
  const r = u.rpg || {};
  if (!r.mazmorras) return null;
  // Encontrar qué mazmorra está activa
  let mActiva = null, claveActiva = null;
  for (const [clave, m] of Object.entries(r.mazmorras)) {
    if (m && m.enCombate) {
      mActiva = m;
      claveActiva = clave;
      break;
    }
  }
  if (!mActiva) return null;
  if (!result || !result.terminado) return null;
  
  mActiva.enCombate = false;
  mActiva.lastAct = Date.now();
  
  if (result.tipo === 'victoria') {
    mActiva.pisosVencidos += 1;
    mActiva.botín = (mActiva.botín || 0) + (result.oro || 0);
    const nuevos = checkTitles(u);
    let texto = `🏰 *Piso ${mActiva.piso} superado* — venciste a ${mActiva.pisoEnemy.nombre}.\n💰 Botín: ${money(mActiva.botín)}`;
    if (mActiva.pisoEnemy.esJefe) {
      mActiva.jefesVencidos.push(mActiva.pisoEnemy.clave);
      texto += '\n👑 ¡Jefe de mazmorra derrotado!';
    }
    if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
    texto += '\nUsá #avanzar para seguir o #retirarse para cobrar.';
    return { tipo: 'victoria', texto, pisos: mActiva.pisosVencidos };
  }
  
  if (result.tipo === 'derrota') {
    const perdida = Math.max(0, Math.floor((u.cash || 0) * 0.5));
    u.cash = Math.max(0, u.cash - perdida);
    r.mazmorras[claveActiva] = null;
    return {
      tipo: 'derrota',
      muerte: true,
      texto: `💀 *La mazmorra se derrumbó*\nPerdiste el 50% del botín del bloque: −${money(perdida)}.`,
    };
  }
  
  // escape o límite
  const texto = `🌀 Saliste de la mazmorra. Conservás *${money(mActiva.botín || 0)}* de botín (${mActiva.pisosVencidos} pisos).`;
  r.mazmorras[claveActiva] = null;
  return { tipo: result.tipo, texto };
};

module.exports = {
  mazmorraDe,
  obtenerMazmorra,
  listaMazmorras,
  abrirMazmorra,
  avanzarMazmorra,
  retirarMazmorra,
  mazmorraPostCombate,
  PISOS_POR_JEFE,
  PISOS_TOTALES,
};
