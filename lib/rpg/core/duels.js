// FASE 11 — PvP y social: duelos, torneos semanales y jefe mundial.
// Estado en u.rpg.duelo, u.rpg.torneo y settings.torneos / settings.jefesMundiales.
// Todo es DATA (reglas en data/duels.js) + lógica pura aquí.

const { DUELO, TORNEO, JEFEMUNDIAL } = require('../data/duels');
const { startCombat, combatTurn, puedeCombatir } = require('./combat');
const { getStats } = require('./stats');
const { ensureRPG } = require('./migrate');
const { money } = require('./narrate');

const TORNEO_SEMANA = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((t - inicio) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Stats normalizadas por nivel (arena): crecimiento a nivelRef, equipo real.
// ---------------------------------------------------------------------------
const statsNormalizadas = (u, nivelRef) => {
  const r = ensureRPG(u);
  const { getClass, getGrowth, kiBaseDe, velBaseDe } = require('./classes');
  const { WEAPONS, HOUSES, ENTRENAMIENTO } = require('../data/items');
  const clase = r.clase ? getClass(r.clase) : null;
  const crec = getGrowth(r.clase);
  const L = Math.max(0, Math.min(nivelRef - 1, (r.nivel || 1) - 1));
  const arma = r.arma ? WEAPONS[r.arma] : null;
  const bonoAtributo = (clave) => {
    const conf = ENTRENAMIENTO.atributos[clave];
    if (!conf) return 0;
    return ((r.atributos && r.atributos[clave]) || 0) * conf.porPunto;
  };
  const casa = r.casa ? HOUSES[r.casa] : null;
  const atkTotal = (clase ? clase.atkBase + (crec ? crec.atk * L : 0) : 0)
    + (arma ? arma.atk : 0) + bonoAtributo('atk');
  const defTotal = (clase ? clase.defBase + (crec ? crec.def * L : 0) : 0)
    + bonoAtributo('def');
  const hpTotal = (clase ? clase.hpBase + (crec ? crec.hp * L : 0) : 0)
    + bonoAtributo('hp');
  const kiMaxTotal = Math.round(kiBaseDe(r.clase) + (crec ? crec.ki * L : 0) + bonoAtributo('ki'));
  const velTotal = Math.round(velBaseDe(r.clase) + bonoAtributo('vel'));
  let hpFinal = Math.round(hpTotal);
  if (casa) {
    if (casa.beneficio === 'hp') hpFinal += casa.valor;
    if (casa.beneficio === 'atk') atkTotal += casa.valor;
    if (casa.beneficio === 'all') { hpFinal += casa.valor; atkTotal += casa.valor; defTotal += Math.floor(casa.valor / 2); }
  }
  return { hp: hpFinal, atk: Math.round(atkTotal), def: Math.round(defTotal), ki: kiMaxTotal, vel: Math.round(velTotal), nivel: nivelRef };
};

// Crea un enemigo sintético a partir de otro jugador (para el motor de combate).
const crearEnemigoDuelo = (u, oponente, nivelRef) => {
  const s = statsNormalizadas(oponente, nivelRef);
  return {
    clave: `duelo_${oponente.id || 'anon'}_${Date.now()}`,
    nombre: oponente.rpg && oponente.rpg.nombrePersonalizado ? oponente.rpg.nombrePersonalizado : `Oponente ${oponente.id || '?'}`,
    hp: s.hp,
    atk: s.atk,
    def: s.def,
    vel: s.vel,
    elemento: 'luz',
    arquetipo: 'agresivo',
    oro: 0,
    exp: 0,
    esJefe: false,
  };
};

// ---------------------------------------------------------------------------
// Duelos 1v1 (el duelo se guarda en AMBOS usuarios para poder aceptarlo)
// ---------------------------------------------------------------------------
const dueloIniciar = (uIniciador, uOponente, apuesta) => {
  const r = ensureRPG(uIniciador);
  if (r.duelo) return { error: 'Ya tenés un duelo o torneo en curso.' };
  if (r.combate) return { error: 'Estás en combate. Terminalo antes de duelar.' };
  const bloqueo = puedeCombatir(uIniciador);
  if (bloqueo.error) return bloqueo;
  const ap = Math.floor(Number(apuesta || 0));
  if (ap < DUELO.apuestaMin) return { error: `Apuesta mínima: ${money(DUELO.apuestaMin)}.` };
  if (ap > DUELO.apuestaMax) return { error: `Apuesta máxima: ${money(DUELO.apuestaMax)}.` };
  if ((uIniciador.cash || 0) < ap) return { error: `No tenés suficiente oro. Tenés ${money(uIniciador.cash || 0)}.` };
  if ((uOponente.cash || 0) < ap) return { error: `El oponente no tiene suficiente oro.` };
  uIniciador.cash = Math.max(0, uIniciador.cash - ap);
  const duelo = {
    tipo: 'duelo',
    iniciador: uIniciador.id,
    oponente: uOponente.id,
    apuesta: ap,
    estado: 'esperando',
    turnos: 0,
    iniciado: Date.now(),
    lastAct: Date.now(),
    resultado: null,
  };
  uIniciador.rpg.duelo = duelo;
  uOponente.rpg.duelo = duelo;
  markEconDirtyLocal();
  return {
    exito: true,
    oponenteId: uOponente.id,
    apuesta: ap,
    texto: `⚔️ Desafío de duelo enviado a *${uOponente.id}* por ${money(ap)}. Esperá que acepte con #duelo aceptar.`,
  };
};

const dueloAceptar = (u) => {
  const r = ensureRPG(u);
  if (!r.duelo || r.duelo.tipo !== 'duelo') {
    return { error: 'No tenés un duelo pendiente.' };
  }
  if (r.duelo.oponente !== u.id) {
    return { error: 'No sos el oponente de este duelo.' };
  }
  if (r.duelo.estado !== 'esperando') return { error: 'Ese duelo ya no está esperando.' };
  if ((u.cash || 0) < r.duelo.apuesta) return { error: 'No tenés suficiente oro para aceptar la apuesta.' };
  u.cash = Math.max(0, u.cash - r.duelo.apuesta);
  r.duelo.estado = 'activo';
  r.duelo.lastAct = Date.now();
  r.duelo.u1Vida = null;
  r.duelo.u2Vida = null;
  markEconDirtyLocal();
  return { exito: true, texto: `✅ Duelo aceptado. ¡Que empiece el combate! Usá #duelo atk / #duelo def / #duelo hab <n>.` };
};

const dueloEstado = (u) => {
  const r = ensureRPG(u);
  if (!r.duelo) return { error: 'No tenés un duelo activo.' };
  const d = r.duelo;
  let txt = `⚔️ *Duelo* — Estado: ${d.estado}\nApuesta: ${money(d.apuesta)}\nTurnos: ${d.turnos}`;
  if (d.u1Vida != null) txt += `\nTu vida: ${d.u1Vida}%`;
  if (d.u2Vida != null) txt += `\nVida oponente: ${d.u2Vida}%`;
  return { texto: txt, duelo: d };
};

const dueloTurno = (u, accion, param) => {
  const r = ensureRPG(u);
  const d = r.duelo;
  if (!d || d.estado !== 'activo') return { error: 'No tenés un duelo activo.' };
  if (Date.now() - d.lastAct > DUELO.turnoSegundos * 1000) {
    d.estado = 'terminado';
    d.resultado = 'expiracion';
    return { error: 'El duelo expiró por inactividad.' };
  }
  d.lastAct = Date.now();
  d.turnos += 1;

  const oponenteFake = {
    id: d.oponente,
    rpg: { clase: 'kensei', nivel: u.rpg.nivel || 1, nombrePersonalizado: 'Oponente' },
  };
  const enemy = crearEnemigoDuelo(u, oponenteFake, u.rpg.nivel || 1);

  if (!u.rpg.combate) {
    startCombat(u, enemy.clave, { enemy });
  }
  const res = combatTurn(u, accion, param);
  if (!res || !res.terminado) {
    const c = u.rpg.combate;
    const accEnemigo = c.cargando ? 'defender' : 'atacar';
    const dmgEnemigo = Math.max(1, Math.round((enemy.atk * 0.9) * 100 / (100 + (getStats(u).def || 10))));
    u.rpg.hp = Math.max(1, (u.rpg.hp || getStats(u).hp) - dmgEnemigo);
    res.resultado = (res.resultado || '') + `\n👹 ${enemy.nombre} contraataca: −${dmgEnemigo} HP.`;
  }

  if (res && res.terminado) {
    const ganador = res.tipo === 'victoria' ? u.id : d.oponente;
    const pozo = d.apuesta * 2;
    const comision = Math.round(pozo * DUELO.comisionApuesta);
    const premio = pozo - comision;
    if (ganador === u.id) {
      u.cash = Math.max(0, u.cash + premio);
      d.resultado = 'victoria';
    } else {
      d.resultado = 'derrota';
    }
    d.estado = 'terminado';
    markEconDirtyLocal();
    return {
      terminado: true,
      tipo: d.resultado,
      texto: `${res.resultado}\n🏆 *Duelo terminado:* ${ganador === u.id ? '¡Ganaste!' : 'Perdiste.'}\n💰 Premio: ${money(premio)} (comisión ${money(comision)}).`,
    };
  }
  markEconDirtyLocal();
  return { terminado: false, texto: res.resultado || 'Turno resuelto.' };
};

const dueloRendirse = (u) => {
  const r = ensureRPG(u);
  const d = r.duelo;
  if (!d || d.estado !== 'activo') return { error: 'No tenés un duelo activo.' };
  d.estado = 'terminado';
  d.resultado = 'rendido';
  u.cash = Math.max(0, u.cash - d.apuesta);
  markEconDirtyLocal();
  return { terminado: true, tipo: 'derrota', texto: '🏳️ Te rendiste del duelo. Perdiste la apuesta.' };
};

// ---------------------------------------------------------------------------
// Torneo semanal (8 jugadores, cuadrado automático)
// ---------------------------------------------------------------------------
const torneoEnsured = (settings, jid) => {
  settings.torneos = settings.torneos || {};
  const semana = TORNEO_SEMANA();
  if (!settings.torneos[jid] || settings.torneos[jid].semana !== semana) {
    settings.torneos[jid] = {
      semana,
      jugadores: [],
      estado: 'inscripcion',
      ronda: 0,
      rondas: TORNEO.rondas,
      resultados: [],
      campeon: null,
    };
  }
  return settings.torneos[jid];
};

const torneoInscribir = (u, jid, settings) => {
  const t = torneoEnsured(settings, jid);
  if (t.estado !== 'inscripcion') return { error: 'El torneo no está en inscripción.' };
  if (t.jugadores.find((j) => j.id === u.id)) return { error: 'Ya estás inscrito.' };
  if (t.jugadores.length >= TORNEO.maxJugadores) return { error: 'El torneo está lleno (8 jugadores).' };
  if ((u.cash || 0) < 1000) return { error: 'Inscripción cuesta ¥1,000.' };
  u.cash = Math.max(0, u.cash - 1000);
  t.jugadores.push({ id: u.id, nombre: (u.rpg && u.rpg.nombrePersonalizado) || `Jugador ${u.id}`, victorias: 0, derrotas: 0, eliminado: false });
  markEconDirtyLocal();
  saveSettingsLocal(settings);
  return { exito: true, texto: `🏆 Inscrito en el torneo semanal (${t.jugadores.length}/${TORNEO.maxJugadores}).` };
};

const torneoEstado = (jid, settings) => {
  const t = torneoEnsured(settings, jid);
  let txt = `🏆 *Torneo Semanal* — ${t.semana}\nEstado: ${t.estado}\nJugadores: ${t.jugadores.length}/${TORNEO.maxJugadores}\n`;
  for (const j of t.jugadores) {
    txt += `• ${j.nombre} — V:${j.victorias} D:${j.derrotas}${j.eliminado ? ' (eliminado)' : ''}\n`;
  }
  if (t.campeon) txt += `\n👑 Campeón: ${t.campeon}`;
  return txt;
};

const torneoRonda = (jid, settings) => {
  const t = torneoEnsured(settings, jid);
  if (t.estado === 'terminado') return { error: 'El torneo ya terminó.' };
  if (t.estado === 'inscripcion') {
    if (t.jugadores.length < 2) return { error: 'Necesitás al menos 2 jugadores para iniciar.' };
    t.estado = 'rondas';
    t.ronda = 0;
    t.resultados = [];
  }
  const activos = t.jugadores.filter((j) => !j.eliminado);
  if (activos.length === 1) {
    t.estado = 'terminado';
    t.campeon = activos[0].nombre;
    saveSettingsLocal(settings);
    return { terminado: true, campeon: activos[0].nombre, texto: `🏆 ¡Torneo terminado! Campeón: *${activos[0].nombre}*` };
  }
  const emparejados = [...activos].sort(() => Math.random() - 0.5);
  const resultados = [];
  for (let i = 0; i < emparejados.length; i += 2) {
    const j1 = emparejados[i];
    const j2 = emparejados[i + 1];
    if (!j2) { j1.victorias += 1; resultados.push(`${j1.nombre} avanza (bye)`); continue; }
    const n1 = 10;
    const n2 = 10;
    let p1 = 0.5;
    p1 = Math.max(0.15, Math.min(0.85, p1));
    const g1 = Math.random() < p1;
    const ganador = g1 ? j1 : j2;
    const perdedor = g1 ? j2 : j1;
    ganador.victorias += 1;
    perdedor.derrotas += 1;
    if (activos.length === 2) perdedor.eliminado = true;
    resultados.push(`${ganador.nombre} venció a ${perdedor.nombre}`);
  }
  t.resultados.push({ ronda: t.ronda + 1, resultados });
  t.ronda += 1;
  // Recalcular activos tras la ronda; si queda 1, terminó.
  const activosDespues = t.jugadores.filter((j) => !j.eliminado);
  if (activosDespues.length === 1) {
    t.estado = 'terminado';
    t.campeon = activosDespues[0].nombre;
    saveSettingsLocal(settings);
    return { terminado: true, campeon: activosDespues[0].nombre, texto: `🏆 ¡Torneo terminado! Campeón: *${activosDespues[0].nombre}*\n${resultados.join('\n')}` };
  }
  saveSettingsLocal(settings);
  return { terminado: false, resultados, texto: `⚔️ Ronda ${t.ronda} del torneo:\n${resultados.join('\n')}` };
};

// ---------------------------------------------------------------------------
// Jefe mundial (grupo)
// ---------------------------------------------------------------------------
const jefeMundialEnsured = (settings, jid) => {
  settings.jefesMundiales = settings.jefesMundiales || {};
  const ahora = Date.now();
  if (!settings.jefesMundiales[jid] || settings.jefesMundiales[jid].estado === 'terminado' || ahora - (settings.jefesMundiales[jid].lastAct || 0) > JEFEMUNDIAL.expiracionMs) {
    settings.jefesMundiales[jid] = {
      jefe: { nombre: '👹 Señor del Mundo', hp: 0, hpMax: 0 },
      daño: {},
      participantes: [],
      iniciado: ahora,
      lastAct: ahora,
      estado: 'inactivo',
    };
  }
  return settings.jefesMundiales[jid];
};

const jefeMundialIniciar = (jid, settings, cantMiembros) => {
  const j = jefeMundialEnsured(settings, jid);
  if (j.estado === 'activo') return { error: 'Ya hay un jefe mundial activo en este grupo.' };
  j.estado = 'activo';
  j.iniciado = Date.now();
  j.lastAct = Date.now();
  j.daño = {};
  j.participantes = [];
  const hp = JEFEMUNDIAL.hpBase + JEFEMUNDIAL.hpPorMiembro * Math.max(1, cantMiembros);
  j.jefe = { nombre: '👹 Señor del Mundo', hp, hpMax: hp };
  saveSettingsLocal(settings);
  return { exito: true, texto: `🌍 ¡Jefe Mundial apareció! *${j.jefe.nombre}* (HP: ${money(hp)}). Todos acumuláis daño con #jefemundial atacar.` };
};

const jefeMundialDaño = (u, jid, settings, daño) => {
  const j = jefeMundialEnsured(settings, jid);
  if (j.estado !== 'activo') return { error: 'No hay jefe mundial activo.' };
  const dmg = Math.max(1, Math.floor(Number(daño || 0)));
  j.daño[u.id] = (j.daño[u.id] || 0) + dmg;
  if (!j.participantes.includes(u.id)) j.participantes.push(u.id);
  j.jefe.hp = Math.max(0, j.jefe.hp - dmg);
  j.lastAct = Date.now();
  let texto = `⚔️ Infligiste ${dmg} de daño al jefe mundial.\nJefe: ${j.jefe.hp}/${j.jefe.hpMax}`;
  let terminado = false;
  let recompensas = null;
  if (j.jefe.hp <= 0) {
    j.estado = 'terminado';
    terminado = true;
    const totalDaño = Object.values(j.daño).reduce((a, b) => a + b, 0);
    const recom = {};
    for (const [id, d] of Object.entries(j.daño)) {
      const pct = d / totalDaño;
      recom[id] = Math.round(JEFEMUNDIAL.oroBase * pct);
    }
    recompensas = recom;
    texto += `\n🏆 ¡Jefe mundial derrotado!\nRecompensas por daño: ${Object.entries(recom).map(([id, oro]) => `${id}: ${money(oro)}`).join(', ')}`;
  }
  saveSettingsLocal(settings);
  return { exito: true, terminado, recompensas, texto };
};

const jefeMundialEstado = (jid, settings) => {
  const j = jefeMundialEnsured(settings, jid);
  let txt = `🌍 *Jefe Mundial* — ${j.estado}\n${j.jefe.nombre}: ${j.jefe.hp}/${j.jefe.hpMax}\nDaño por participante:\n`;
  for (const [id, d] of Object.entries(j.daño)) {
    txt += `• ${id}: ${d}\n`;
  }
  return txt;
};

// ---------------------------------------------------------------------------
// Helpers locales (sin dependencia circular con index.js)
// ---------------------------------------------------------------------------
let markEconDirtyLocal = () => {};
let saveSettingsLocal = () => {};
const setEconomiaHooks = (markEconDirtyFn, saveSettingsFn) => {
  markEconDirtyLocal = markEconDirtyFn;
  saveSettingsLocal = saveSettingsFn;
};

module.exports = {
  DUELO,
  TORNEO,
  JEFEMUNDIAL,
  TORNEO_SEMANA,
  statsNormalizadas,
  crearEnemigoDuelo,
  dueloIniciar,
  dueloAceptar,
  dueloEstado,
  dueloTurno,
  dueloRendirse,
  torneoEnsured,
  torneoInscribir,
  torneoEstado,
  torneoRonda,
  jefeMundialEnsured,
  jefeMundialIniciar,
  jefeMundialDaño,
  jefeMundialEstado,
  setEconomiaHooks,
};
