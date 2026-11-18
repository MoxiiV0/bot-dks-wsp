// FASE 7 — Portales: incursión por pisos que reemplaza la mazmorra con apuesta.
// - Estado en u.rpg.portal (persistido con la economía; sin globals sueltos).
// - Cada piso: 55% combate, 25% evento, 10% tesoro, 10% santuario (DATA).
// - Dificultad +4% por piso; jefe de portal cada 10 pisos (fases 70/40/15).
// - #avanzar sigue, #retirarse conserva el botín; al morir se pierde 50%.
// - Ranking semanal por grupo (en settings.chats, con corte por semana ISO).

const { PORTAL, EVENTOS_PORTAL } = require('../data/portals');
const { ZONAS, ESCALADO } = require('../data/world');
const { RANGOS } = require('../data/ranks');
const { OBJETOS_COMBATE } = require('../data/items');
const { statsEscala, recompensas, zonaPorNivel } = require('./world');
const { getStats } = require('./stats');
const { rand, money, pick } = require('./narrate');
const { addExp, checkTitles } = require('./progression');
const { ensureRPG } = require('./migrate');
const { startCombat, puedeCombatir } = require('./combat');

const rankIndex = (key) => RANGOS.findIndex((x) => x.key === key);
const hoy = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Llaves de portal (3 al día; se reinician por fecha, sin timers)
// ---------------------------------------------------------------------------
const llavesDisponibles = (u) => {
  const r = ensureRPG(u);
  const fecha = hoy();
  if (!r.portalLlaves || r.portalLlaves.fecha !== fecha) {
    r.portalLlaves = { fecha, gastadas: 0 };
  }
  return Math.max(0, PORTAL.llavesPorDia - (r.portalLlaves.gastadas || 0));
};

// ---------------------------------------------------------------------------
// Expiración por inactividad (timestamp; cierra conservando el botín)
// ---------------------------------------------------------------------------
const vigilarExpiracion = (u) => {
  const p = u.rpg && u.rpg.portal;
  if (!p) return null;
  if (Date.now() - (p.lastAct || p.started || 0) > PORTAL.expiracionMs) {
    u.rpg.portal = null;
    return { pisos: p.pisosVencidos, botin: p.botin };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Enemigo del piso: zona según el rango del portal + dificultad por piso
// ---------------------------------------------------------------------------
const enemigoPortal = (p) => {
  const nivel = PORTAL.rangos[p.rango].nivelBase;
  const esJefe = p.piso % PORTAL.jefeCadaPisos === 0;
  const zonaKey = zonaPorNivel(nivel);
  const zona = ZONAS[zonaKey];
  const entradas = Object.entries(zona.enemigos);

  let par;
  if (esJefe) {
    par = entradas.find(([, d]) => d.tipo === 'jefe');
  } else {
    const normales = entradas.filter(([, d]) => d.tipo === 'normal');
    const elites = entradas.filter(([, d]) => d.tipo === 'elite');
    const saleElite = elites.length > 0 && Math.random() * 100 < ESCALADO.caza.elite;
    const pool = saleElite ? elites : normales;
    par = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!par) par = entradas[0];
  const d = par[1];

  const s = statsEscala(nivel, d.tipo);
  const dificultad = Math.pow(1 + PORTAL.dificultadPorPiso, p.piso - 1);
  const rec = recompensas(nivel);
  let oro = rec.oro;
  if (esJefe) oro += PORTAL.jefeBotin.oroBase + PORTAL.jefeBotin.oroPorPiso * p.piso;

  return {
    key: `portal_${p.rango}_${p.piso}`,
    nombre: d.nombre,
    hp: Math.max(1, Math.round(s.hp * dificultad)),
    atk: Math.max(1, Math.round(s.atk * dificultad)),
    def: s.def,
    vel: s.vel,
    elemento: d.elemento || null,
    arquetipo: d.arquetipo || 'agresivo',
    esJefe: d.tipo === 'jefe',
    oro,
    exp: rec.exp,
    rango: null,
    zona: zonaKey,
    nivel,
    tipo: d.tipo,
  };
};

// ---------------------------------------------------------------------------
// Pisos: sorteo según DATA y resolución con efectos reales
// ---------------------------------------------------------------------------
const sortearPiso = () => {
  const roll = Math.random() * 100;
  let acumulado = 0;
  for (const [tipo, prob] of Object.entries(PORTAL.pisos)) {
    acumulado += prob;
    if (roll < acumulado) return tipo;
  }
  return 'combate';
};

// Actualiza el récord de pisos (título Explorador) y chequea títulos.
const anotarPiso = (u) => {
  const r = u.rpg;
  if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
  if (r.portal && r.portal.pisosVencidos > (r.stats.pisos || 0)) {
    r.stats.pisos = r.portal.pisosVencidos;
    r.statsPisos = r.stats.pisos;
  }
  return checkTitles(u);
};

// Los 5 eventos viejos con efectos reales sobre HP, Ki, oro y bonos temporales.
const aplicarEvento = (u, p) => {
  const roll = Math.random() * 100;
  let acumulado = 0;
  let ev = null;
  for (const e of Object.values(EVENTOS_PORTAL)) {
    acumulado += e.prob;
    if (roll < acumulado) { ev = e; break; }
  }
  if (!ev) ev = Object.values(EVENTOS_PORTAL)[0];

  const r = u.rpg;
  const s = getStats(u); // aplica regeneración y da los máximos/actuales

  if (ev.tipo === 'oro') {
    const base = ev.oroBase + ev.oroPorPiso * p.piso;
    const ganancia = rand(Math.round(base * (1 - ev.variacion)), Math.round(base * (1 + ev.variacion)));
    u.cash = Math.max(0, u.cash + ganancia);
    p.botin += ganancia;
    return { tipo: 'oro', texto: `${ev.nombre}: ${ev.desc}\n💰 +${money(ganancia)} (botín: ${money(p.botin)}).` };
  }

  if (ev.tipo === 'dano') {
    const hpPerd = Math.max(1, Math.round(s.hp * ev.hpPct));
    const kiPerd = Math.round(s.kiMax * ev.kiPct);
    r.hp = Math.max(1, s.hpActual - hpPerd);
    r.ki = Math.max(0, s.ki - kiPerd);
    return { tipo: 'dano', texto: `${ev.nombre}: ${ev.desc}\n❤️ −${hpPerd} HP (${r.hp}/${s.hp}) · 🌀 −${kiPerd} Ki (${r.ki}/${s.kiMax}).` };
  }

  if (ev.tipo === 'curar') {
    const hpCur = Math.round(s.hp * ev.hpPct);
    const kiCur = Math.round(s.kiMax * ev.kiPct);
    r.hp = Math.min(s.hp, s.hpActual + hpCur);
    r.ki = Math.min(s.kiMax, s.ki + kiCur);
    return { tipo: 'curar', texto: `${ev.nombre}: ${ev.desc}\n❤️ HP ${r.hp}/${s.hp} · 🌀 Ki ${r.ki}/${s.kiMax}.` };
  }

  if (ev.tipo === 'bono') {
    const hpPago = Math.max(1, Math.round(s.hp * ev.hpPct));
    r.hp = Math.max(1, s.hpActual - hpPago);
    p.bonoAtk = PORTAL.bonoAltar.atkPct;
    p.bonoPisos = PORTAL.bonoAltar.combates;
    return {
      tipo: 'bono',
      texto: `${ev.nombre}: ${ev.desc}\n❤️ −${hpPago} HP (${r.hp}/${s.hp}).\n⚔️ Bono: +${Math.round(PORTAL.bonoAltar.atkPct * 100)}% ATK durante los próximos ${PORTAL.bonoAltar.combates} combates.`,
    };
  }

  // exp: EXP real + recarga completa de Ki
  const base = ev.expBase + ev.expPorPiso * p.piso;
  const exp = rand(Math.round(base * (1 - ev.variacion)), Math.round(base * (1 + ev.variacion)));
  const subida = addExp(u, exp);
  r.ki = s.kiMax;
  let texto = `${ev.nombre}: ${ev.desc}\n⭐ +${exp} EXP · 🌀 Ki restaurado (${s.kiMax}/${s.kiMax}).`;
  if (subida) texto += `\n${subida}`;
  return { tipo: 'exp', texto, exp };
};

// Avanza a un piso y lo resuelve. Combates: inicia el motor (enCombate=true).
const resolverPiso = (u) => {
  const p = u.rpg.portal;
  p.piso += 1;
  p.lastAct = Date.now();

  const esJefe = p.piso % PORTAL.jefeCadaPisos === 0;
  const tipoPiso = esJefe ? 'combate' : sortearPiso();
  const base = `🏰 *Portal Rango ${p.rango} — Piso ${p.piso}*\n💰 Botín: ${money(p.botin)}`;

  if (tipoPiso === 'combate') {
    const enemy = enemigoPortal(p);
    p.pisoEnemy = { oro: enemy.oro, nombre: enemy.nombre, esJefe: enemy.esJefe };
    const bono = p.bonoPisos > 0 ? p.bonoAtk : 0;
    const iniciado = startCombat(u, enemy.key, { enemy, bonoAtk: bono });
    if (!iniciado) {
      // No se pudo iniciar (p. ej. inconsciencia): el piso se re-sortea.
      p.piso -= 1;
      p.pisoEnemy = null;
      return { tipo: 'error', texto: `${base}\n⚠️ No se pudo iniciar el combate del piso. Volvé a intentar con #avanzar.` };
    }
    p.enCombate = true;
    if (p.bonoPisos > 0) p.bonoPisos -= 1;
    const marca = enemy.esJefe ? '👑 *JEFE DE PORTAL*' : (enemy.tipo === 'elite' ? '⭐ *Élite*' : `Nv ${enemy.nivel}`);
    return { tipo: 'combate', texto: `${base}\n⚔️ ${marca}: *${enemy.nombre}*\nUsá #atk para atacar, #hab <n> para una habilidad o #def para defenderte.` };
  }

  let ev;
  if (tipoPiso === 'evento') ev = aplicarEvento(u, p);
  else if (tipoPiso === 'tesoro') {
    const t = PORTAL.tesoro;
    const baseOro = t.oroBase + t.oroPorPiso * p.piso;
    const ganancia = rand(Math.round(baseOro * (1 - t.variacion)), Math.round(baseOro * (1 + t.variacion)));
    u.cash = Math.max(0, u.cash + ganancia);
    p.botin += ganancia;
    let texto = `📦 *Tesoro del piso*: encontraste ${money(ganancia)} (botín: ${money(p.botin)}).`;
    if (Math.random() * 100 < t.objetoProb) {
      const id = pick(Object.keys(OBJETOS_COMBATE));
      if (!u.rpg.inventario) u.rpg.inventario = {};
      u.rpg.inventario[id] = (u.rpg.inventario[id] || 0) + 1;
      texto += `\n🎁 También encontraste *${OBJETOS_COMBATE[id].nombre}* (usá #obj ${id}).`;
    }
    ev = { tipo: 'tesoro', texto };
  } else {
    const s = getStats(u);
    u.rpg.hp = s.hp;
    u.rpg.ki = s.kiMax;
    ev = { tipo: 'santuario', texto: `⛩️ *Santuario de descanso*: HP y Ki restaurados al 100% (${s.hp}/${s.hp} HP · ${s.kiMax}/${s.kiMax} Ki).` };
  }

  // Piso no combativo: queda superado al instante.
  p.pisosVencidos += 1;
  const nuevos = anotarPiso(u);
  let texto = `${base}\n${ev.texto}`;
  if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
  texto += `\nUsá #avanzar para seguir o #retirarse para cobrar.`;
  return { tipo: tipoPiso, texto };
};

// ---------------------------------------------------------------------------
// Abrir / avanzar / retirar
// ---------------------------------------------------------------------------
const listaRangos = (u) => Object.entries(PORTAL.rangos).map(([key, conf]) => {
  const miRango = (u.rpg && u.rpg.rango) || 'E';
  const ok = rankIndex(miRango) >= rankIndex(key);
  return `${ok ? '✅' : '🔒'} *Portal ${key}* — enemigos nv${conf.nivelBase}${ok ? '' : ` (requiere rango ${key})`}`;
}).join('\n');

const abrirPortal = (u, rangoRef) => {
  const r = ensureRPG(u);
  vigilarExpiracion(u); // un portal vencido no bloquea una nueva entrada
  const key = String(rangoRef || '').trim().toUpperCase();
  if (!PORTAL.rangos[key]) {
    return { error: `Rango de portal inválido. Usá: #portal <${Object.keys(PORTAL.rangos).join('|')}>` };
  }
  if (r.portal) return { error: 'Ya tenés un portal abierto. Usá #avanzar para seguir o #retirarse para salir.' };
  if (r.combate) return { error: 'Estás en combate: terminalo antes de abrir un portal.' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;

  const miRango = r.rango || 'E';
  if (rankIndex(miRango) < rankIndex(key)) {
    return { error: `Necesitás el rango de Cazador ${key} para un portal de ese rango (tu rango: ${miRango}).` };
  }

  // Entrada: 1 llave del día o pago en oro (nunca ambas).
  const llaves = llavesDisponibles(u);
  let entrada;
  if (llaves > 0) {
    r.portalLlaves.gastadas += 1;
    entrada = `🚪 Entraste con 1 llave (quedan ${llavesDisponibles(u)}/${PORTAL.llavesPorDia})`;
  } else if (u.cash >= PORTAL.costoOro) {
    u.cash = Math.max(0, u.cash - PORTAL.costoOro);
    entrada = `🚪 Entraste pagando ${money(PORTAL.costoOro)} (sin llaves disponibles)`;
  } else {
    return { error: `Sin llaves de portal (${PORTAL.llavesPorDia} al día) y necesitás ${money(PORTAL.costoOro)} de oro para pagar la entrada.` };
  }

  r.portal = {
    rango: key,
    piso: 0,
    pisosVencidos: 0,
    botin: 0,
    enCombate: false,
    bonoAtk: 0,
    bonoPisos: 0,
    pisoEnemy: null,
    started: Date.now(),
    lastAct: Date.now(),
  };
  const res = resolverPiso(u);
  return { tipo: res.tipo, texto: `🌀 *Portal del Rango ${key}*\n${entrada}\n\n${res.texto}` };
};

const avanzarPortal = (u) => {
  ensureRPG(u);
  const v = vigilarExpiracion(u);
  if (v) {
    return { expiro: true, texto: `⏳ Tu portal expiró por inactividad. Conservaste ${money(v.botin)} de botín (${v.pisos} pisos superados).` };
  }
  const p = u.rpg.portal;
  if (!p) return { error: 'No tenés un portal abierto. Abrilo con #portal <rango>.' };
  if (p.enCombate) return { error: 'Tenés un combate de portal en curso. Terminalo con #atk, #hab o #def.' };
  if (u.rpg.combate) return { error: 'Estás en combate: terminalo antes de avanzar (#huir para escapar).' };
  const bloqueo = puedeCombatir(u);
  if (bloqueo.error) return bloqueo;
  return resolverPiso(u);
};

const retirarPortal = (u) => {
  ensureRPG(u);
  const v = vigilarExpiracion(u);
  if (v) {
    return { expiro: true, pisos: v.pisos, botin: v.botin, texto: `⏳ Tu portal ya expiró. Conservaste ${money(v.botin)} de botín (${v.pisos} pisos superados).` };
  }
  const p = u.rpg.portal;
  if (!p) return { error: 'No tenés un portal abierto. Abrilo con #portal <rango>.' };
  if (p.enCombate || u.rpg.combate) {
    return { error: 'No podés retirarte en medio de un combate (usá #huir para escapar).' };
  }
  u.rpg.portal = null;
  return {
    pisos: p.pisosVencidos,
    botin: p.botin,
    rango: p.rango,
    texto: `🌀 *Retirada del portal (Rango ${p.rango})*\nPisos superados: ${p.pisosVencidos}\n💰 Botín conservado: *${money(p.botin)}* (ya está en tu efectivo).`,
  };
};

// ---------------------------------------------------------------------------
// Post-combate: cierra o continúa la incursión según el resultado del motor
// ---------------------------------------------------------------------------
const portalPostCombate = (u, result) => {
  const r = u.rpg || {};
  const p = r.portal;
  if (!p || !p.enCombate) return null;
  if (!result || !result.terminado) return null; // el combate sigue

  p.enCombate = false;
  p.lastAct = Date.now();
  const ene = p.pisoEnemy || { oro: 0, nombre: '', esJefe: false };

  if (result.tipo === 'victoria') {
    p.botin += ene.oro;
    p.pisosVencidos += 1;
    const nuevos = anotarPiso(u);
    let texto = `🏰 *Piso ${p.piso} superado* — venciste a ${ene.nombre}.\n💰 Botín: ${money(p.botin)}`;
    if (ene.esJefe) texto += '\n👑 ¡Jefe de portal derrotado!';
    if (nuevos.length) texto += `\n🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`;
    texto += '\nUsá #avanzar para seguir o #retirarse para cobrar.';
    return { tipo: 'victoria', texto, pisos: p.pisosVencidos, botin: p.botin };
  }

  if (result.tipo === 'derrota') {
    const perdida = Math.min(u.cash, Math.floor(p.botin * PORTAL.botinMuertePct));
    u.cash = Math.max(0, u.cash - perdida);
    const info = { pisos: p.pisosVencidos, botin: p.botin, perdida };
    r.portal = null;
    return {
      tipo: 'derrota',
      muerte: true,
      pisos: info.pisos,
      botin: info.botin,
      perdida,
      texto: `💀 *El portal se derrumbó*\nPerdiste el 50% del botín acumulado: −${money(perdida)} (los ${money(info.botin)} restantes ya estaban en tu efectivo).`,
    };
  }

  // escape o límite de turnos: salís conservando todo el botín
  const razon = result.tipo === 'escape'
    ? 'Huiste del combate y saliste del portal'
    : 'Se agotaron los turnos del combate y saliste del portal';
  const texto = `🌀 ${razon}: conservás *${money(p.botin)}* de botín (${p.pisosVencidos} pisos superados).`;
  const info = { pisos: p.pisosVencidos, botin: p.botin };
  r.portal = null;
  return { tipo: result.tipo, cierre: true, pisos: info.pisos, botin: info.botin, texto };
};

// ---------------------------------------------------------------------------
// Estado y ranking semanal por grupo
// ---------------------------------------------------------------------------
const estadoPortal = (u) => {
  const r = ensureRPG(u);
  const v = vigilarExpiracion(u);
  const llaves = llavesDisponibles(u);
  const base = `🔑 Llaves: ${llaves}/${PORTAL.llavesPorDia} · Entrada sin llave: ${money(PORTAL.costoOro)}`;
  if (v) return `🌀 *Portal expirado*\nConservaste ${money(v.botin)} de botín (${v.pisos} pisos superados).\n\n${base}\n\n${listaRangos(u)}\nUso: #portal <rango> · #portal ranking`;

  const p = r.portal;
  if (!p) {
    return `🌀 *Portales*\n${base}\n\nRangos disponibles:\n${listaRangos(u)}\n\nUso: #portal <rango> para abrir · #portal ranking para el ranking semanal.`;
  }
  const bono = p.bonoPisos > 0 ? `\n⚔️ Bono activo: +${Math.round(p.bonoAtk * 100)}% ATK (${p.bonoPisos} combates)` : '';
  const est = p.enCombate
    ? '⚔️ En combate: #atk / #hab <n> / #def'
    : 'Usá #avanzar para seguir o #retirarse para cobrar.';
  return `🌀 *Portal Rango ${p.rango} — Piso ${p.piso}*\n💰 Botín: ${money(p.botin)} · Pisos superados: ${p.pisosVencidos}${bono}\n${est}\n${base}`;
};

// Clave de semana ISO (YYYY-Www) para el ranking semanal.
const semanaClave = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((t - inicio) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
};

// Registra el récord semanal del jugador en el chat/grupo (top N).
const registrarRanking = (chats, jid, usuario, pisos) => {
  if (!jid || !usuario || !pisos || pisos <= 0) return null;
  const c = (chats[jid] = chats[jid] || {});
  const semana = semanaClave();
  if (!c.portalRanking || c.portalRanking.semana !== semana) {
    c.portalRanking = { semana, top: [] };
  }
  const top = c.portalRanking.top;
  const prev = top.find((x) => x.id === usuario.id);
  if (prev) {
    if (pisos <= prev.pisos) return c.portalRanking;
    prev.pisos = pisos;
  } else {
    top.push({ id: usuario.id, nombre: usuario.nombre || String(usuario.id), pisos });
  }
  top.sort((a, b) => b.pisos - a.pisos);
  c.portalRanking.top = top.slice(0, PORTAL.rankingTop);
  return c.portalRanking;
};

// Ranking del grupo (resetea perezosamente al cambiar de semana).
const rankingGrupo = (chats, jid) => {
  if (!jid) return null;
  const c = chats[jid];
  const semana = semanaClave();
  if (!c || !c.portalRanking) return null;
  if (c.portalRanking.semana !== semana) {
    c.portalRanking = { semana, top: [] };
    return null;
  }
  const top = c.portalRanking.top;
  if (!top.length) return null;
  const medallas = ['🥇', '🥈', '🥉'];
  const lineas = top.map((x, i) => `${medallas[i] || `${i + 1}.`} ${x.nombre} — ${x.pisos} pisos`);
  return `🏆 *Ranking semanal de portales* (${c.portalRanking.semana})\n${lineas.join('\n')}`;
};

module.exports = {
  llavesDisponibles,
  enemigoPortal,
  abrirPortal,
  avanzarPortal,
  retirarPortal,
  portalPostCombate,
  estadoPortal,
  registrarRanking,
  rankingGrupo,
  semanaClave,
  PORTAL,
  EVENTOS_PORTAL,
};
