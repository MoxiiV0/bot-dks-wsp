// FASE C/D/E — Mazmorras: incursión por pisos, entrada gratis, eventos con efectos reales.
// Estado en u.rpg.mazmorras: { [clave]: { piso, pisosVencidos, jefeVencido, botin, ... } }
// Sin apuesta, sin llaves.

// Mapeo de entradas del usuario a keys de ZONAS (igual que en index.js)
const mapaMazmorras = {
  '1': 'sakura',
  'cuevas_sakra': 'sakura',
  'cuevas_sarka': 'sakura',       // alias sin 'r' (error común)
  'cuevas_sakra_rota': 'sakura',
  '2': 'torii',
  'bosque_ji': 'torii',
  'bosque_mil_torii': 'torii',
  '3': 'luna',
  'templo_lunar': 'luna',
  '4': 'cristal',
  'desierto_cristal': 'cristal',
  '5': 'trueno',
  'cumbres_trueno': 'trueno',
  '6': 'abismo',
  'abismo_eclipse': 'abismo',
};

const { ENEMIGOS_MAZMORRA } = require('../data/mazmorras');
const { EVENTOS_MAZMORRA } = require('../data/eventos_mazmorra');
const { registrarBestiario, registrarVictoriaBestiario, verificarTitulosBestiario } = require('../data/mazmorra_drops');
const { ZONAS, ESCALADO } = require('../data/world');
const { RANGOS } = require('../data/ranks');
const { OBJETOS_COMBATE } = require('../data/items');
const { statsEscala, recompensas, zonaPorNivel } = require('./world');
const { getStats } = require('./stats');
const { rand, money, pick } = require('./narrate');
const { addExp, checkTitles } = require('./progression');
const { ensureRPG } = require('./migrate');
const { startCombat, combatTurn, puedeCombatir } = require('./combat');

const rankIndex = (key) => RANGOS.findIndex((x) => x.key === key);
const hoy = () => new Date().toISOString().slice(0, 10);

const PISOS_POR_JEFE = 10;
const PISOS_TOTALES = 30;
const MUERTE_PERDIDA_PCT = 0.5;

const mazmorraDe = (u) => {
  const r = ensureRPG(u);
  if (!r.mazmorras) r.mazmorras = {};
  return r.mazmorras;
};

const obtenerMazmorra = (clave) => {
  // Aplicar mapa de mazmorras ( traduce cuevas_sarka → sakura, 1 → sakura, etc.)
  const claveNormalizada = mapaMazmorras[clave] || clave;

  // Buscar en ZONAS primero (usa key normalizada)
  const zonaZonas = ZONAS[claveNormalizada.toLowerCase()];
  if (zonaZonas) return { clave: claveNormalizada, zona: { nombre: zonaZonas.nombre, nivelMin: zonaZonas.nivelMin, nivelMax: zonaZonas.nivelMax, enemigos: zonaZonas.enemigos } };

  // Fallback: buscar en ENEMIGOS_MAZMORRA (enemigos individuales)
  for (const [key, zona] of Object.entries(ENEMIGOS_MAZMORRA)) {
    if (zona.nombre.toLowerCase().includes(claveNormalizada.toLowerCase()) || key.toLowerCase().includes(claveNormalizada.toLowerCase())) {
      return { clave: claveNormalizada, zona };
    }
  }

  return null;
};

const listaMazmorras = () => {
  return Object.entries(ENEMIGOS_MAZMORRA).map(([clave, zona]) => ({
    clave,
    nombre: zona.nombre,
    nivelMin: zona.nivelMin,
    nivelMax: zona.nivelMax,
  }));
};

const enemigoMazmorra = (clave, piso) => {
  const def = obtenerMazmorra(clave);
  if (!def) return null;
  const zona = ENEMIGOS_MAZMORRA[def.clave];
  const defEnemigo = zona.enemigos[clave];
  if (!defEnemigo) return null;
  const nivel = defEnemigo.nivel || def.zona.nivelMin || 1;
  const s = escala(nivel, defEnemigo.tipo || 'normal');
  const dificultad = Math.pow(1 + 0.04, Math.max(0, piso - 1));
  const rec = recompensas(nivel);
  let oro = rec.oro;
  if (defEnemigo.tipo === 'jefe') oro += Math.round(recompensas(nivel).oro * 2);
  return {
    clave,
    nombre: defEnemigo.nombre,
    hp: Math.max(1, Math.round(s.hp * dificultad)),
    atk: Math.max(1, Math.round(s.atk * dificultad)),
    def: s.def,
    vel: s.vel,
    elemento: defEnemigo.elemento || null,
    arquetipo: defEnemigo.arquetipo || 'agresivo',
    esJefe: defEnemigo.tipo === 'jefe',
    oro,
    exp: rec.exp,
    zona: def.clave,
    nivel,
    tipo: defEnemigo.tipo,
  };
};

const aplicarEvento = (u, p) => {
  const roll = Math.random() * 100;
  let acumulado = 0;
  let ev = null;
  for (const e of Object.values(EVENTOS_MAZMORRA)) {
    acumulado += e.prob;
    if (roll < acumulado) { ev = e; break; }
  }
  if (!ev) ev = Object.values(EVENTOS_MAZMORRA)[0];

  const r = u.rpg;
  const s = getStats(u);

  if (ev.tipo === 'oro') {
    const base = ev.oroBase + ev.oroPorPiso * p.piso;
    const ganancia = rand(Math.round(base * (1 - ev.variacion)), Math.round(base * (1 + ev.variacion)));
    u.cash = Math.max(0, u.cash + ganancia);
    p.botín = (p.botín || 0) + ganancia;
    return { tipo: 'oro', texto: `${ev.nombre}: ${ev.desc}\n💰 +${money(ganancia)} (botín: ${money(p.botín)}).` };
  }

  if (ev.tipo === 'curar') {
    const hpCur = Math.round(s.hp * ev.hpPct);
    const kiCur = Math.round(s.kiMax * ev.kiPct);
    r.hp = Math.min(s.hp, (r.hp || 0) + hpCur);
    r.ki = Math.min(s.kiMax, (r.ki || 0) + kiCur);
    return { tipo: 'curar', texto: `${ev.nombre}: ${ev.desc}\n❤️ HP ${r.hp}/${s.hp} · 🌀 Ki ${r.ki}/${s.kiMax}.` };
  }

  if (ev.tipo === 'dano') {
    const hpPerd = Math.max(1, Math.round(s.hp * ev.hpPct));
    const kiPerd = Math.round(s.kiMax * ev.kiPct);
    r.hp = Math.max(1, (r.hp || s.hp) - hpPerd);
    r.ki = Math.max(0, (r.ki || s.kiMax) - kiPerd);
    return { tipo: 'dano', texto: `${ev.nombre}: ${ev.desc}\n❤️ −${hpPerd} HP (${r.hp}/${s.hp}) · 🌀 −${kiPerd} Ki (${r.ki}/${s.kiMax}).` };
  }

  if (ev.tipo === 'bono') {
    const hpPago = Math.max(1, Math.round(s.hp * ev.hpPct));
    r.hp = Math.max(1, (r.hp || s.hp) - hpPago);
    p.bonoAtk = ev.atkPct || 0;
    p.bonoPisos = ev.turnos || 0;
    return {
      tipo: 'bono',
      texto: `${ev.nombre}: ${ev.desc}\n❤️ −${hpPago} HP (${r.hp}/${s.hp}).\n⚔️ Bono: +${Math.round(ev.atkPct * 100)}% ATK durante ${ev.turnos} combates.`,
    };
  }

  if (ev.tipo === 'exp') {
    const base = ev.expBase + ev.expPorPiso * p.piso;
    const exp = rand(Math.round(base * (1 - ev.variacion)), Math.round(base * (1 + ev.variacion)));
    const subida = addExp(u, exp);
    r.ki = s.kiMax;
    let texto = `${ev.nombre}: ${ev.desc}\n⭐ +${exp} EXP · 🌀 Ki restaurado (${s.kiMax}/${s.kiMax}).`;
    if (subida) texto += `\n${subida}`;
    return { tipo: 'exp', texto, exp };
  }

  return { tipo: 'nada', texto: '🚶 Nada especial ocurrió en este piso.' };
};

// ---------------------------------------------------------------------------
// Abrir mazmorra
// ---------------------------------------------------------------------------
const abrirMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = mazmorraDe(u);
  const def = obtenerMazmorra(clave);
  if (!def) return { error: 'Mazmorra no encontrada.' };
  if (m[clave]) return { error: 'Ya tenés una mazmorra abierta. Usá #mazmorra continuar o #retirarse.' };
  if (r.combate) return { error: 'Estás en combate. Terminalo antes de entrar.' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;

  // def.zona puede ser un objeto (si vino de ZONAS) o string (si vino de ENEMIGOS_MAZMORRA)
  let zonaInfo = def.zona;
  if (typeof zonaInfo === 'string') {
    zonaInfo = ZONAS[zonaInfo] || {};
  }
  const nivelBase = zonaInfo.nivelMin || 1;
  const miRango = u.rpg.rango || 'E';
  if (rankIndex(miRango) < rankIndex('E')) {
    return { error: 'No tenés rango de Cazador válido.' };
  }

  m[clave] = {
    piso: 0,
    pisosVencidos: 0,
    botín: 0,
    enCombate: false,
    pisoEnemy: null,
    iniciado: Date.now(),
    lastAct: Date.now(),
    jefeVencido: [],
    intentos: 0,
  };

  const res = resolverPiso(u, m[clave]);
  return { tipo: res.tipo, texto: `🏰 *Mazmorra ${def.zona.nombre}* (nivel ${def.zona.nivelMin}-${def.zona.nivelMax})\n${res.texto}` };
};

const resolverPiso = (u, m) => {
  m.piso += 1;
  m.lastAct = Date.now();
  const piso = m.piso;
  const esJefe = piso % PISOS_POR_JEFE === 0;
  const base = `🏰 *Mazmorra ${m.clave} — Piso ${piso}*\n💰 Botín: ${money(m.botín || 0)}\n`;

  if (esJefe) {
    const jefeIdx = Math.floor(piso / PISOS_POR_JEFE);
    const jefeKey = `jefe${jefeIdx}`;
    const defZona = ENEMIGOS_MAZMORRA[m.clave];
    const jefeDef = defZona.jefes[jefeIdx];
    if (!jefeDef) {
      m.piso -= 1;
      return { tipo: 'error', texto: `${base}\n⚠️ No hay jefe definido para este piso.` };
    }
    const enemy = crearEnemigoJefe(jefeDef, piso);
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
  const enemigosDelJefe = Object.values(ENEMIGOS_MAZMORRA[m.clave].enemigos).filter(e =>
    e.clave.includes(jefeDef.clave.replace(' ', '_').toLowerCase()) && e.tipo === 'normal'
  );
  const elitesDelJefe = Object.values(ENEMIGOS_MAZMORRA[m.clave].enemigos).filter(e =>
    e.clave.includes(jefeDef.clave.replace(' ', '_').toLowerCase()) && e.tipo === 'elite'
  );

  const roll = Math.random() * 100;
  let tipoPiso = 'combate';
  if (roll < 20) tipoPiso = 'evento';

  if (tipoPiso === 'combate') {
    const esElite = Math.random() * 100 < 15;
    const pool = esElite ? elitesDelJefe : enemigosDelJefe;
    if (pool.length === 0) {
      // Fallback: cualquier enemigo de la zona
      const allEnemigos = Object.values(ENEMIGOS_MAZMORRA[m.clave].enemigos).filter(e => e.tipo === 'normal');
      const enemigo = allEnemigos[Math.floor(Math.random() * allEnemigos.length)];
      const iniciado = startCombat(u, enemigo.clave, { enemy: crearEnemigoMazmorraEnemigo(enemigo, piso) });
      if (!iniciado) {
        m.piso -= 1;
        return { tipo: 'error', texto: `${base}\n⚠️ No se pudo iniciar el combate.` };
      }
      m.enCombate = true;
      return { tipo: 'combate', texto: `${base}\n⚔️ *${enemigo.nombre}* (Nv ${enemigo.nivel})\nUsá #atk para atacar, #hab <n> para una habilidad o #def para defenderte.` };
    }
    const enemigo = pool[Math.floor(Math.random() * pool.length)];
    const iniciado = startCombat(u, enemigo.clave, { enemy: crearEnemigoMazmorraEnemigo(enemigo, piso) });
    if (!iniciado) {
      m.piso -= 1;
      return { tipo: 'error', texto: `${base}\n⚠️ No se pudo iniciar el combate.` };
    }
    m.enCombate = true;
    const marca = enemigo.tipo === 'elite' ? '⭐ *Élite*' : `Nv ${enemigo.nivel}`;
    return { tipo: 'combate', texto: `${base}\n⚔️ ${marca}: *${enemigo.nombre}*\nUsá #atk para atacar, #hab <n> para una habilidad o #def para defenderte.` };
  } else {
    // Evento
    const ev = aplicarEvento(u, m);
    m.pisosVencidos += 1;
    const nuevos = checkTitles(u);
    let texto = `${base}\n${ev.texto}`;
    if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
    texto += '\nUsá #avanzar para seguir o #retirarse para cobrar.';
    return { tipo: evTipo || 'evento', texto };
  }
};

// ---------------------------------------------------------------------------
// Crear objeto enemigo para startCombat a partir de un enemigo de mazmorra
// ---------------------------------------------------------------------------
const crearEnemigoMazmorraEnemigo = (enemigoDef, piso) => {
  const s = escala(enemigoDef.nivel || 1, enemigoDef.tipo || 'normal');
  const rec = recompensas(enemigoDef.nivel || 1);
  return {
    clave: enemigoDef.clave,
    nombre: enemigoDef.nombre,
    hp: Math.max(1, Math.round(s.hp * Math.pow(1 + 0.04, Math.max(0, piso - 1)))),
    atk: Math.max(1, Math.round(s.atk * Math.pow(1 + 0.04, Math.max(0, piso - 1)))),
    def: s.def,
    vel: s.vel,
    elemento: enemigoDef.elemento || null,
    arquetipo: enemigoDef.arquetipo || 'agresivo',
    esJefe: enemigoDef.tipo === 'jefe',
    oro: rec.oro,
    exp: rec.exp,
    zona: 'mazmorra',
    tipo: enemigoDef.tipo,
  };
};

// ---------------------------------------------------------------------------
// Avanza al siguiente piso de la mazmorra activa
// ---------------------------------------------------------------------------
const avanzarMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = r.mazmorras && r.mazmorras[clave];
  if (!m) return { error: 'No tenés una mazmorra abierta con esa clave.' };
  if (m.enCombate) return { error: 'Estás en combate. Terminalo con #atk, #hab o #def.' };
  if (u.rpg.combate) return { error: 'Estás en combate. Terminalo antes de avanzar (#huir para escapar).' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;
  return resolverPiso(u, m);
};

// ---------------------------------------------------------------------------
// Retirarse de la mazmorra conservando todo el botín
// ---------------------------------------------------------------------------
const retirarMazmorra = (u, clave) => {
  const r = ensureRPG(u);
  const m = r.mazmorras && r.mazmorras[clave];
  if (!m) return { error: 'No tenés una mazmorra abierta.' };
  if (m.enCombate || u.rpg.combate) return { error: 'No podés retirarte en medio de un combate.' };
  u.rpg.mazmorras[clave] = null;
  return {
    pisos: m.pisosVencidos,
    botín: m.botín || 0,
    texto: `🏰 *Retirada de la mazmorra ${m.clave}*\nPisos superados: ${m.pisosVencidos}\n💰 Botín conservado: *${money(m.botín || 0)}*`,
  };
};

// ---------------------------------------------------------------------------
// Post-combate: procesa resultado del combate en la mazmorra
// ---------------------------------------------------------------------------
const mazmorraPostCombate = (u, result) => {
  const r = u.rpg || {};
  const m = r.mazmorras;
  if (!m) return null;
  // Encontrar la mazmorra activa
  let mActiva = null, claveActiva = null;
  for (const [clave, mm] of Object.entries(m)) {
    if (mm && mm.enCombate) {
      mActiva = mm;
      claveActiva = clave;
      break;
    }
  }
  if (!mActiva) return null;
  if (!result || !result.terminado) return null;

  mActiva.enCombate = false;
  mActiva.lastAct = Date.now();
  const ene = mActiva.pisoEnemy || { oro: 0, nombre: '', esJefe: false };

  if (result.tipo === 'victoria') {
    mActiva.pisosVencidos += 1;
    mActiva.botín = (mActiva.botín || 0) + (ene.oro || 0);
    // Registrar en bestiario
    registrarBestiario(ene.clave);
    registrarVictoriaBestiario(ene.clave);
    const titulos = verificarTitulosBestiario(u);
    const nuevos = checkTitles(u);
    let texto = `🏰 *Piso ${mActiva.piso} superado* — venciste a ${ene.nombre}.\n💰 Botín: ${money(mActiva.botín)}`;
    if (ene.esJefe) {
      mActiva.jefesVencidos = mActiva.jefesVencidos || [];
      mActiva.jefesVencidos.push(ene.clave);
      texto += '\n👑 ¡Jefe de mazmorra derrotado!';
    }
    if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
    if (titulos.length) texto += `\n🏅 ¡Bestiario completado: ${titulos.join(', ')}!`;
    texto += '\nUsá #avanzar para seguir o #retirarse para cobrar.';
    return { tipo: 'victoria', texto, pisos: mActiva.pisosVencidos };
  }

  if (result.tipo === 'derrota') {
    const perdida = Math.max(0, Math.floor((u.cash || 0) * MUERTE_PERDIDA_PCT));
    u.cash = Math.max(0, u.cash - perdida);
    r.mazmorras[claveActiva] = null;
    return {
      tipo: 'derrota',
      muerte: true,
      texto: `💀 *La mazmorra se derrumbó*\nPerdiste el 50% del botín del bloque: −${money(perdida)}.\nPisos superados: ${mActiva.pisosVencidos}`,
    };
  }

  // escape o límite
  const texto = `🌀 Saliste de la mazmorra. Conservás *${money(mActiva.botín || 0)}* de botín (${mActiva.pisosVencidos} pisos).`;
  r.mazmorras[claveActiva] = null;
  return { tipo: result.tipo, texto };
};

// ---------------------------------------------------------------------------
// Estado de la mazmorra activa
// ---------------------------------------------------------------------------
const estadoMazmorra = (u) => {
  const r = ensureRPG(u);
  const m = r.mazmorras;
  if (!m) return 'No tenés una mazmorra abierta.';
  const activos = Object.entries(m).filter(([, mm]) => mm && mm.enCombate);
  if (activos.length === 0) return 'No tenés una mazmorra activa en combate.';
  const [clave, mm] = activos[0];
  const def = obtenerMazmorra(clave);
  return `🏰 *Mazmorra ${def ? def.zona.nombre : clave} — Piso ${mm.piso}*\n💰 Botín: ${money(mm.botín || 0)}\nUsá #avanzar para seguir o #retirarse para cobrar.`;
};

module.exports = {
  mazmorraDe,
  obtenerMazmorra,
  listaMazmorras,
  enemigoMazmorra,
  abrirMazmorra,
  avanzarMazmorra,
  retirarMazmorra,
  mazmorraPostCombate,
  estadoMazmorra,
  PISOS_POR_JEFE,
  PISOS_TOTALES,
};
