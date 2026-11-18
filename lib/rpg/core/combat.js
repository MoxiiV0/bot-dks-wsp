// FASE 5 — Motor de combate unificado: caza, portales, jefes, rival y duelos.
// Un solo motor; el estado vive en u.rpg.combate. Acciones del jugador:
//   atacar (#atk) | habilidad (#hab n) | defender (#def) | objeto (#obj id) | huir (#huir)
//
// Reglas (DATA en data/battle.js, IA en core/ai.js, estados en data/statuses.js):
// - Iniciativa por VEL; daño = ATK * mult * varianza * 100/(100+DEF).
// - Crítico 5% + bonos (x1.5), esquiva con tope 40%, elementos x1.25/x0.8.
// - #def: −50% daño y +8 Ki (−70% si el golpe enemigo estaba telegrafiado).
// - Jefes con fases al 70/40/15% y telegrafía de golpes devastadores.
// - Medidor de Despertar (0-100): #despertar da 3 turnos de modo (+30% ATK/VEL,
//   skills sin Ki, ougi) y deja 1 turno de cansancio.
// - Derrota: −10% oro en mano, 2 min inconsciente, 30% HP al despertar.
// - Expira por timestamp a los 10 min; nunca avanza dos veces (lock FASE 1).

const { ENEMIES, BOSSSES } = require('../data/enemies');
const { EXAMENES } = require('../data/ranks');
const { BATALLA, ELEMENTOS } = require('../data/battle');
const { STATUSES } = require('../data/statuses');
const { OBJETOS_COMBATE } = require('../data/items');
const { pasivaDe, baseClassKey } = require('../data/classes');
const { enemigoZona } = require('./world');
const { getStats } = require('./stats');
const { addExp, checkTitles } = require('./progression');
const { ascenderRango } = require('./ranks');
const { rand, money, barra, pick } = require('./narrate');
const { confIANZA, faseActual, decidirIA } = require('./ai');
const { resolveHabilidad } = require('./effects');

const COMBATE_TIMEOUT_MS = BATALLA.expiracionMs;
const COMBATE_MAX_TURNOS = BATALLA.limite.turnos;
const DOMA_BESTIAS = { jabali: 'jabali', lobo: 'lobo', esqueleto: 'esqueleto' };

// ---------------------------------------------------------------------------
// Normalización de enemigos (comunes, jefes y exámenes en una sola fuente)
// ---------------------------------------------------------------------------
const getEnemy = (key) => {
  // FASE 6: los enemigos de zona ya vienen normalizados y escalados por nivel.
  const deZona = enemigoZona(key);
  if (deZona) return deZona;
  const e = ENEMIES[key] || BOSSSES[key] || EXAMENES[key];
  if (!e) return null;
  const esJefe = !!BOSSSES[key];
  const esExamen = !!EXAMENES[key];
  return {
    key,
    nombre: e.nombre,
    hp: e.hp,
    atk: e.atk,
    def: e.def || 0,
    vel: e.vel || BATALLA.velEnemigoDefecto,
    elemento: e.elemento || null,
    arquetipo: e.arquetipo || (esJefe || esExamen ? 'jefe' : BATALLA.arquetipoDefecto),
    esJefe,
    oro: e.oro || 0,
    exp: e.exp || 0,
    rango: e.rango || null,
  };
};

// ¿Puede empezar un combate? (inconsciencia de la FASE 5)
const puedeCombatir = (u) => {
  const r = u.rpg || {};
  if (r.inconscienteHasta && Date.now() < r.inconscienteHasta) {
    const seg = Math.ceil((r.inconscienteHasta - Date.now()) / 1000);
    return { error: `😵 Sigues inconsciente. Despiertas en ${seg}s.` };
  }
  return {};
};

const startCombat = (u, enemyKey, opts = {}) => {
  const enemy = opts.enemy || getEnemy(enemyKey);
  if (!enemy) return null;
  const r = u.rpg;
  if (puedeCombatir(u).error) return null;
  const s = getStats(u); // máximo real + regeneración por tiempo

  r.combate = {
    enemyKey,
    esJefe: !!enemy.esJefe,
    examen: EXAMENES[enemyKey] ? enemyKey : null,
    enemy,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    // FASE 3: el combate empieza con el HP actual (persistido), no lleno
    hpJugador: Math.max(1, Math.min(s.hp, r.hp || s.hp)),
    hpMaxJugador: s.hp,
    turnos: 0,
    iniciado: Date.now(),
    // FASE 5: estados, cooldowns (turnos absolutos), fases de jefe y Despertar
    estados: { jugador: [], enemigo: [] },
    cooldowns: {},
    fase: 0,
    faseConf: null,
    cargando: false,
    defendiendo: false,
    enemyDefiende: false,
    golpePostEsquiva: false,
    cadenaElementos: [],
    despertarTurnos: 0,
    cansancioTurnos: 0,
    despertadoYa: false,
  };
  return enemy;
};

// ---------------------------------------------------------------------------
// Helpers de cálculo (sin números mágicos: todo sale de data/battle.js)
// ---------------------------------------------------------------------------
const randFloat = (min, max) => min + Math.random() * (max - min);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Ventaja/desventaja elemental: x1.25 / x0.8
const factorElemental = (elementoAtacante, elementoDefensor) => {
  if (!elementoAtacante || !elementoDefensor) return 1;
  const e = ELEMENTOS[elementoAtacante];
  if (!e) return 1;
  if (e.ventaja.includes(elementoDefensor)) return BATALLA.elementos.ventaja;
  if (e.desventaja.includes(elementoDefensor)) return BATALLA.elementos.desventaja;
  return 1;
};

// Crítico: prob base + bonos de pasiva; multiplicador base + bonos.
const probCritico = (efecto) => BATALLA.critico.probBase + (efecto && efecto.critProb ? efecto.critProb : 0);
const multCritico = (efecto) => BATALLA.critico.mult + (efecto && efecto.critMult ? efecto.critMult : 0);

const sumarDespertar = (r, cantidad) => {
  r.despertar = clamp((r.despertar || 0) + cantidad, 0, BATALLA.despertar.max);
};

const fmt = (txt, nombre, dano) =>
  String(txt).replace(/\{nombre\}/g, nombre).replace(/\{dano\}/g, dano != null ? String(dano) : '');

// Pasiva Kensei (FASE 4): efecto bajo el umbral de HP del combate.
const pasivaBajoHp = (u, c) => {
  const p = pasivaDe(u.rpg.clase, u.rpg.despertarMayor);
  const efecto = p ? p.efecto : {};
  const pct = c.hpMaxJugador > 0 ? c.hpJugador / c.hpMaxJugador : 1;
  const activa = efecto.umbralHp != null && pct < efecto.umbralHp;
  return { efecto, activa };
};

// Pasiva Onmyōji (FASE 5): encadenar fuego→viento→rayo→agua da +20%.
const aplicarCadena = (c, elemento, efecto) => {
  const sec = efecto.secuencia;
  if (!sec || !elemento) return 1;
  const hist = c.cadenaElementos;
  hist.push(elemento);
  if (hist.length > sec.length) hist.splice(0, hist.length - sec.length);
  if (hist.length === sec.length && hist.every((e, i) => e === sec[i])) {
    hist.length = 0;
    return 1 + efecto.bonusPct;
  }
  return 1;
};

// Estados: aplicar con reglas de acumulación (duración se refresca, capas).
const aplicarEstado = (lista, id, turnos) => {
  const st = STATUSES[id];
  if (!st) return false;
  const dur = turnos || st.duracionTurnos;
  const actual = lista.find((x) => x.id === id);
  if (actual) {
    if ((actual.capas || 1) < (st.maxPila || 1)) actual.capas = (actual.capas || 1) + 1;
    actual.turnos = Math.max(actual.turnos, dur);
    return true;
  }
  lista.push({ id, turnos: dur, capas: 1 });
  return true;
};

// Estados al iniciar el turno de un actor: daño por turno, saltos y expiración.
const procesarEstados = (lista, hpMax, etiqueta) => {
  const textos = [];
  let skip = false;
  let dano = 0;
  for (const e of lista) {
    const st = STATUSES[e.id];
    if (!st) continue;
    const capas = e.capas || 1;
    if (st.dot) {
      const d = st.dot.tipo === 'pctHp'
        ? Math.max(BATALLA.golpeMinimo, Math.round(hpMax * st.dot.pct * capas))
        : st.dot.valor * capas;
      dano += d;
      textos.push(fmt(st.textos.tick, etiqueta, d));
    }
    if (st.saltarTurno) {
      skip = true;
      textos.push(fmt(st.textos.tick, etiqueta));
    }
    e.turnos -= 1;
  }
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].turnos <= 0) {
      const st = STATUSES[lista[i].id];
      if (st) textos.push(fmt(st.textos.fin, etiqueta));
      lista.splice(i, 1);
    }
  }
  return { textos, skip, dano };
};

// Al recibir daño directo, el congelado se rompe (data: rompeAlDanar).
const romperCongelado = (lista) => {
  const i = lista.findIndex((e) => e.id === 'congelado');
  if (i >= 0) lista.splice(i, 1);
};

// Golpe del jugador: ATK con bonos * mult * varianza * elemento / DEF enemiga.
const golpeJugador = (u, c, stats, ctx) => {
  const r = u.rpg;
  const enemigo = c.enemy;
  const p = pasivaDe(r.clase, r.despertarMayor);
  const efecto = p ? p.efecto : {};

  let atk = stats.atk;
  if (c.despertarTurnos > 0) atk *= 1 + BATALLA.despertar.bonusAtk;
  const furia = c.estados.jugador.find((e) => e.id === 'furia');
  if (furia) atk *= 1 + STATUSES.furia.bonusAtk;
  const baja = pasivaBajoHp(u, c);
  if (baja.activa && efecto.atkPct) atk *= 1 + efecto.atkPct; // Kensei (FASE 4/5)

  let bonusPostEsquiva = 1;
  if (c.golpePostEsquiva) {
    bonusPostEsquiva = 1 + (efecto.golpePostEsquiva || 0); // Shinobi (FASE 5)
    c.golpePostEsquiva = false;
  }

  let bruto = atk * (ctx.mult || 1) * randFloat(BATALLA.varianza.min, BATALLA.varianza.max)
    * factorElemental(ctx.elemento, enemigo.elemento) * bonusPostEsquiva;

  const bonusCadena = aplicarCadena(c, ctx.elemento, efecto); // Onmyōji (FASE 5)

  let final = bruto * BATALLA.divisorDef / (BATALLA.divisorDef + Math.max(0, enemigo.def || 0));
  const critico = Math.random() < probCritico(efecto);
  if (critico) final *= multCritico(efecto);
  if (c.enemyDefiende) {
    final *= 0.5;
    c.enemyDefiende = false;
  }
  const marca = c.estados.enemigo.find((e) => e.id === 'marca');
  if (marca) final *= 1 + STATUSES.marca.danioExtraPct;
  const escudo = c.estados.enemigo.find((e) => e.id === 'escudo');
  if (escudo) final *= 1 - STATUSES.escudo.reduccionDanio;
  final *= bonusCadena;

  return { dano: Math.max(BATALLA.golpeMinimo, Math.round(final)), critico, cadena: bonusCadena > 1 };
};

// Golpe del enemigo: arquetipo * fase * telegrafía sobre ATK; DEF del jugador
// con pasiva Kensei, #def, escudo, marca y esquiva propias.
const golpeEnemigo = (u, c, stats, conf, ctx) => {
  const r = u.rpg;
  const enemigo = c.enemy;
  const p = pasivaDe(r.clase, r.despertarMayor);
  const efecto = p ? p.efecto : {};

  let atk = enemigo.atk * (conf.multAtaque || 1)
    * (1 + (c.faseConf && c.faseConf.bonusAtk ? c.faseConf.bonusAtk : 0))
    * (ctx.mult || 1);
  const furiaE = c.estados.enemigo.find((e) => e.id === 'furia');
  if (furiaE) atk *= 1 + STATUSES.furia.bonusAtk;

  const bruto = atk * randFloat(BATALLA.varianza.min, BATALLA.varianza.max);

  let def = stats.def;
  const baja = pasivaBajoHp(u, c);
  if (baja.activa && efecto.defPct) def = Math.round(def * (1 + efecto.defPct)); // Kensei

  let final = bruto * BATALLA.divisorDef / (BATALLA.divisorDef + Math.max(0, def));
  const critico = Math.random() < BATALLA.critico.probBase; // enemigo: solo prob base
  if (critico) final *= BATALLA.critico.mult;

  const escudo = c.estados.jugador.find((e) => e.id === 'escudo');
  if (escudo) final *= 1 - STATUSES.escudo.reduccionDanio;
  const marca = c.estados.jugador.find((e) => e.id === 'marca');
  if (marca) final *= 1 + STATUSES.marca.danioExtraPct;

  if (ctx.defendio) {
    final *= ctx.telegrafiado
      ? (1 - BATALLA.telegrafia.reduccionConDefensa) // 70% menos con #def
      : (1 - BATALLA.defensa.reduccion);
  }

  // Esquiva del jugador (pasiva Shinobi, tope duro 40%)
  const esquivaMax = efecto.esquiva ? Math.min(BATALLA.esquiva.tope, efecto.esquiva) : 0;
  const esquivo = esquivaMax > 0 && Math.random() < esquivaMax;

  return { dano: esquivo ? 0 : Math.max(BATALLA.golpeMinimo, Math.round(final)), critico, esquivo };
};

// Pasiva Médium (FASE 4/5): roba un % del daño infligido como vida.
const robarVida = (u, c, dano) => {
  const p = pasivaDe(u.rpg.clase, u.rpg.despertarMayor);
  const pct = p && p.efecto.roboHpPct ? p.efecto.roboHpPct : 0;
  if (!pct || dano <= 0) return null;
  const curado = Math.min(c.hpMaxJugador - c.hpJugador, Math.ceil(dano * pct));
  if (curado <= 0) return null;
  c.hpJugador += curado;
  return `🩸 Robaste ${curado} de vida.`;
};

// Acciones válidas (con alias en español e inglés del prompt).
const normalizarAccion = (a) => {
  const mapa = {
    atacar: 'atacar', atk: 'atacar', ataque: 'atacar',
    habilidad: 'habilidad', hab: 'habilidad', skill: 'habilidad',
    defender: 'defender', def: 'defender',
    objeto: 'objeto', obj: 'objeto',
    huir: 'huir', escapar: 'huir',
  };
  return mapa[String(a || '').toLowerCase()] || null;
};

const inventarioTexto = (r) => {
  const inv = r.inventario || {};
  const items = Object.entries(inv).filter(([, n]) => n > 0);
  if (!items.length) return 'vacío (ganás objetos con #cofre o al vencer)';
  return items.map(([id, n]) => `${OBJETOS_COMBATE[id] ? OBJETOS_COMBATE[id].nombre : id} x${n}`).join(', ');
};

// ---------------------------------------------------------------------------
// Motor: una ronda completa por llamada
// ---------------------------------------------------------------------------
const combatTurn = (u, action = 'atacar', param) => {
  const r = u.rpg;
  const c = r.combate;
  if (!c) return null;
  const enemy = c.enemy;
  const stats = getStats(u); // stats + regeneración (FASE 3)

  // Expiración por timestamp (10 minutos sin actividad, sin setTimeout)
  if (c.iniciado && Date.now() - c.iniciado > COMBATE_TIMEOUT_MS) {
    return cerrarCombate(u, c, stats, ['⏰ El combate expiró por inactividad (10 min). Escapaste.'], 'escape');
  }

  // --- Validar la acción ANTES de gastar turno ------------------------------
  const accion = normalizarAccion(action);
  if (!accion) {
    return { resultado: 'Acción no válida. Usá #atk, #hab, #def, #obj o #huir.', terminado: false, tipo: null };
  }

  let habilidad = null;
  if (accion === 'habilidad') {
    const res = resolveHabilidad(u, param, c);
    if (res.error) return { resultado: res.error, terminado: false, tipo: null };
    habilidad = res.habilidad;
  }

  let objeto = null;
  if (accion === 'objeto') {
    objeto = OBJETOS_COMBATE[String(param || '').toLowerCase()];
    if (!objeto) {
      return { resultado: `Objeto no encontrado. Tenés: ${inventarioTexto(r)}`, terminado: false, tipo: null };
    }
    if (!r.inventario || (r.inventario[objeto.id] || 0) <= 0) {
      return { resultado: `No tienes *${objeto.nombre}*. Tenés: ${inventarioTexto(r)}`, terminado: false, tipo: null };
    }
  }

  c.turnos += 1;
  const partes = [];
  let fin = null;

  // --- Cierres (victoria/derrota/huida/límite) ------------------------------
  const cerrarVictoria = () => {
    const oro = enemy.oro;
    const exp = enemy.exp;
    u.cash += oro;
    // FASE 3: el daño sufrido persiste en r.hp (la regeneración lo cura)
    r.hp = Math.max(1, Math.min(stats.hp, c.hpJugador));
    r.combate = null;
    if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
    r.stats.kills = (r.stats.kills || 0) + 1;
    r.statsEnemigosDerrotados = r.stats.kills;
    const subida = addExp(u, exp);
    const nuevos = checkTitles(u);
    partes.push(`\n💀 *¡Derrotaste a ${enemy.nombre}*!\n💰 Ganaste ${money(oro)} y ${exp} EXP.`);
    if (subida) partes.push(subida);
    if (nuevos.length) partes.push(`🏆 ¡Título desbloqueado: ${nuevos.join(', ')}!`);

    // Examen de ascenso aprobado (FASE 3)
    if (c.examen && EXAMENES[c.examen]) {
      const nuevo = ascenderRango(u, EXAMENES[c.examen].rango);
      if (nuevo) partes.push(`🎖️ *¡Examen aprobado!* Ascendiste a *${nuevo.nombre}*.`);
    }

    // Shikigami doma bestias al vencer (FASE 4/5)
    if (baseClassKey(r.clase) === 'shikigami') {
      const bestiaClave = DOMA_BESTIAS[c.enemyKey];
      if (bestiaClave && Math.random() < BATALLA.domaProb) {
        if (!r.bestiasDomadas) r.bestiasDomadas = [];
        if (!r.bestiasDomadas.includes(bestiaClave)) {
          r.bestiasDomadas.push(bestiaClave);
          partes.push(`🐺 ¡Domaste a ${enemy.nombre}! Invocala con #invocar ${bestiaClave}.`);
        }
      }
    }

    // Botín ocasional de objetos de combate (FASE 5)
    if (Math.random() * 100 < BATALLA.dropObjetosProb) {
      const id = pick(BATALLA.dropObjetos);
      const obj = OBJETOS_COMBATE[id];
      if (obj) {
        if (!r.inventario) r.inventario = {};
        r.inventario[id] = (r.inventario[id] || 0) + 1;
        partes.push(`🎁 Botín: *${obj.nombre}* (usá #obj ${id})`);
      }
    }

    return { resultado: partes.join('\n'), terminado: true, tipo: 'victoria' };
  };

  const cerrarDerrota = () => {
    const perdida = Math.floor(u.cash * BATALLA.derrota.pierdePct);
    u.cash = Math.max(0, u.cash - perdida);
    c.hpJugador = Math.ceil(c.hpMaxJugador * BATALLA.derrota.hpRestantePct);
    r.hp = Math.max(1, c.hpJugador);
    r.inconscienteHasta = Date.now() + BATALLA.derrota.inconscienteMs;
    r.combate = null;
    if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
    r.stats.muertes = (r.stats.muertes || 0) + 1;
    const min = Math.round(BATALLA.derrota.inconscienteMs / 60000);
    partes.push(`\n💀 *¡Fuiste derrotado!* Perdiste ${money(perdida)}.`);
    partes.push(`😵 Quedas inconsciente ${min} min y despiertas con ${c.hpJugador}/${c.hpMaxJugador} de vida.`);
    if (c.examen) partes.push('📕 No aprobaste el examen de rango. Volvé a intentar con #examen.');
    return { resultado: partes.join('\n'), terminado: true, tipo: 'derrota' };
  };

  // cierra sin combate (escape/límite): persiste el HP y, si era jefe y se
  // llegó al tope de turnos, aplica la penalización de oro.
  function cerrarCombate(uu, cc, ss, textos, tipo) {
    uu.rpg.hp = Math.max(1, Math.min(ss.hp, cc.hpJugador));
    uu.rpg.combate = null;
    const salida = [...textos];
    if (tipo === 'limite' && cc.esJefe) {
      const perdida = Math.floor(uu.cash * BATALLA.limite.jefePierdePct);
      uu.cash = Math.max(0, uu.cash - perdida);
      salida.push(`💸 El jefe te venció tras ${BATALLA.limite.turnos} turnos: perdiste ${money(perdida)}.`);
    }
    return { resultado: salida.join('\n'), terminado: true, tipo };
  }

  // --- Pasos de la ronda ----------------------------------------------------
  const pasoJugador = () => {
    const est = procesarEstados(c.estados.jugador, c.hpMaxJugador, 'tú');
    partes.push(...est.textos);
    if (est.dano > 0) {
      c.hpJugador -= est.dano;
      romperCongelado(c.estados.jugador);
      if (c.hpJugador <= 0) { fin = cerrarDerrota(); return; }
    }
    if (est.skip) { partes.push('💫 No puedes actuar este turno.'); return; }
    if (c.cansancioTurnos > 0) {
      c.cansancioTurnos -= 1;
      partes.push('😮‍💨 Estás en cansancio tras el Despertar: no puedes actuar.');
      return;
    }

    if (accion === 'atacar') {
      const g = golpeJugador(u, c, stats, { mult: 1, elemento: null });
      c.enemyHp -= g.dano;
      romperCongelado(c.estados.enemigo);
      let linea = `🗡️ Atacaste a *${enemy.nombre}* e infligiste *${g.dano}* de daño.`;
      if (g.critico) linea += ' ¡CRÍTICO!';
      if (g.cadena) linea += ` ⛓️ ¡Cadena elemental +${Math.round((pasivaDe(r.clase, r.despertarMayor).efecto.bonusPct || 0) * 100)}%!`;
      partes.push(linea);
      const robo = robarVida(u, c, g.dano);
      if (robo) partes.push(robo);
      sumarDespertar(r, BATALLA.despertar.alGolpear + (g.critico ? BATALLA.despertar.alCritico : 0));
      if (c.enemyHp <= 0) { fin = cerrarVictoria(); return; }
    } else if (accion === 'habilidad') {
      const modo = c.despertarTurnos > 0;
      if (habilidad.banner) partes.push(habilidad.banner);
      if (!modo) r.ki = Math.max(0, r.ki - habilidad.costoKi);
      if (habilidad.cooldown > 0) c.cooldowns[habilidad.id] = c.turnos + habilidad.cooldown + 1;
      partes.push(`✨ *${habilidad.nombre}*: ${habilidad.frase}`);
      if (!modo && habilidad.costoKi > 0) partes.push(`🌀 −${habilidad.costoKi} Ki (quedan ${r.ki}).`);

      for (const ef of habilidad.efectos) {
        if (ef.tipo === 'dano') {
          const g = golpeJugador(u, c, stats, { mult: ef.mult, elemento: ef.elemento || null });
          c.enemyHp -= g.dano;
          romperCongelado(c.estados.enemigo);
          let linea = `➡️ ${g.dano} de daño a *${enemy.nombre}*.`;
          if (g.critico) linea += ' ¡CRÍTICO!';
          if (g.cadena) linea += ' ⛓️ ¡Cadena elemental!';
          partes.push(linea);
          const roboHab = robarVida(u, c, g.dano);
          if (roboHab) partes.push(roboHab);
          sumarDespertar(r, BATALLA.despertar.alGolpear + (g.critico ? BATALLA.despertar.alCritico : 0));
          if (c.enemyHp <= 0) { fin = cerrarVictoria(); return; }
        } else if (ef.tipo === 'estado') {
          const esSelf = habilidad.objetivo === 'self';
          const lista = esSelf ? c.estados.jugador : c.estados.enemigo;
          const nombre = esSelf ? 'tú' : enemy.nombre;
          if (Math.random() < (ef.prob != null ? ef.prob : 1) && aplicarEstado(lista, ef.id, ef.turnos)) {
            partes.push(fmt(STATUSES[ef.id].textos.aplicar, nombre));
          } else {
            partes.push(`Falló el efecto sobre ${nombre}.`);
          }
        }
      }
    } else if (accion === 'defender') {
      const ya = c.defendiendo;
      c.defendiendo = true;
      if (ya) {
        partes.push('🛡️ Sigues en guardia.');
      } else {
        const ganado = Math.min(BATALLA.defensa.kiDevuelto, Math.max(0, stats.kiMax - (r.ki || 0)));
        r.ki = Math.min(stats.kiMax, (r.ki || 0) + BATALLA.defensa.kiDevuelto);
        partes.push(`🛡️ Te defendiste: −${Math.round(BATALLA.defensa.reduccion * 100)}% de daño y +${ganado} Ki.`);
      }
    } else if (accion === 'objeto') {
      r.inventario[objeto.id] -= 1;
      if (r.inventario[objeto.id] <= 0) delete r.inventario[objeto.id];
      partes.push(usarObjeto(u, c, stats, objeto));
    } else if (accion === 'huir') {
      const velJugador = Math.round(stats.vel * (c.despertarTurnos > 0 ? 1 + BATALLA.despertar.bonusVel : 1));
      const prob = clamp(
        BATALLA.huida.probBase + (velJugador - enemy.vel) * BATALLA.huida.bonusPorVel,
        BATALLA.huida.piso,
        BATALLA.huida.tope
      );
      if (Math.random() < prob) {
        partes.push(`🏃 ¡Lograste huir de *${enemy.nombre}*!`);
        fin = cerrarCombate(u, c, stats, partes, 'escape');
        return;
      }
      partes.push('🏃 ¡Fallaste al huir!');
    }

    // Fin del turno del jugador: el modo Despertar gasta 1 turno por ronda
    if (c.despertarTurnos > 0) {
      c.despertarTurnos -= 1;
      if (c.despertarTurnos === 0) {
        c.cansancioTurnos = BATALLA.despertar.turnosCansancio;
        partes.push('🌟 El modo Despertar terminó: 1 turno de cansancio.');
      }
    }
  };

  const pasoEnemigo = () => {
    if (fin) return;
    const est = procesarEstados(c.estados.enemigo, c.enemyMaxHp, enemy.nombre);
    partes.push(...est.textos);
    if (est.dano > 0) {
      c.enemyHp -= est.dano;
      romperCongelado(c.estados.enemigo);
      if (c.enemyHp <= 0) { fin = cerrarVictoria(); return; }
    }
    if (est.skip) { partes.push(`💫 ${enemy.nombre} pierde su turno.`); return; }

    const conf = confIANZA(enemy);

    // Fases del jefe (70% / 40% / 15%)
    const nuevaFase = faseActual(c, conf);
    if (nuevaFase != null && nuevaFase > (c.fase || 0)) {
      c.fase = nuevaFase;
      c.faseConf = conf.fases[nuevaFase - 1];
      partes.push(`🔥 *¡${enemy.nombre} cambia de patrón!* (fase ${nuevaFase}/${conf.fases.length})`);
    }

    const acc = decidirIA(c, conf);
    if (acc.tipo === 'cargar') {
      c.cargando = true;
      partes.push(`⚠️ *${enemy.nombre} ${BATALLA.telegrafia.textoCarga}*... ¡Usá #def para recibir 70% menos!`);
      return;
    }
    if (acc.tipo === 'defender') {
      c.enemyDefiende = true;
      partes.push(`🛡️ ${enemy.nombre} se pone en guardia.`);
      return;
    }

    const telegrafiado = !!acc.cargado;
    if (telegrafiado) c.cargando = false;
    const g = golpeEnemigo(u, c, stats, conf, { mult: telegrafiado ? BATALLA.telegrafia.multAtaque : 1, defendio: c.defendiendo, telegrafiado });
    c.defendiendo = false; // el escudo se consume al llegar el golpe

    if (g.esquivo) {
      partes.push(`🌀 Esquivaste el ataque de ${enemy.nombre}.`);
      c.golpePostEsquiva = true; // Pasiva Shinobi: +daño en el siguiente golpe
    } else {
      if (telegrafiado) partes.push(`💥 ${enemy.nombre} descarga su golpe cargado!`);
      c.hpJugador -= g.dano;
      romperCongelado(c.estados.jugador);
      let linea = `👹 ${enemy.nombre} te atacó e infligió *${g.dano}* de daño.`;
      if (g.critico) linea += ' ¡CRÍTICO!';
      partes.push(linea);
      partes.push(`❤️ ${barra(c.hpJugador, c.hpMaxJugador)} ${c.hpJugador}/${c.hpMaxJugador}`);
      if (g.dano >= c.hpMaxJugador * BATALLA.despertar.umbralGolpeFuerte) {
        sumarDespertar(r, BATALLA.despertar.alRecibirGolpe);
      }
      if (c.hpJugador <= 0) { fin = cerrarDerrota(); return; }
    }
  };

  // Iniciativa por VEL (el modo Despertar da +30% VEL)
  const velJugador = Math.round(stats.vel * (c.despertarTurnos > 0 ? 1 + BATALLA.despertar.bonusVel : 1));
  const velEnemigo = enemy.vel || BATALLA.velEnemigoDefecto;
  const orden = velJugador >= velEnemigo ? [pasoJugador, pasoEnemigo] : [pasoEnemigo, pasoJugador];
  for (const paso of orden) {
    paso();
    if (fin) break;
  }
  if (fin) return fin;

  if (c.turnos >= COMBATE_MAX_TURNOS) {
    partes.push(`⏰ El combate terminó por tiempo (${BATALLA.limite.turnos} turnos). Escapaste.`);
    return cerrarCombate(u, c, stats, partes, 'limite');
  }

  return { resultado: partes.join('\n'), terminado: false, tipo: null };
};

// Objeto de combate (#obj): efectos de data/items.js.
const usarObjeto = (u, c, stats, objeto) => {
  const r = u.rpg;
  const ef = objeto.efecto;
  if (ef.tipo === 'curaHp') {
    const curado = Math.min(c.hpMaxJugador - c.hpJugador, Math.round(c.hpMaxJugador * ef.pct));
    c.hpJugador += curado;
    return `🧪 Usaste *${objeto.nombre}*: +${curado} HP.`;
  }
  if (ef.tipo === 'curaKi') {
    const curado = Math.min(stats.kiMax - (r.ki || 0), Math.round(stats.kiMax * ef.pct));
    r.ki = (r.ki || 0) + curado;
    return `🌀 Usaste *${objeto.nombre}*: +${curado} Ki.`;
  }
  if (ef.tipo === 'curaAmbos') {
    const hp = Math.min(c.hpMaxJugador - c.hpJugador, Math.round(c.hpMaxJugador * ef.pct));
    const ki = Math.min(stats.kiMax - (r.ki || 0), Math.round(stats.kiMax * ef.pct));
    c.hpJugador += hp;
    r.ki = (r.ki || 0) + ki;
    return `🍹 Usaste *${objeto.nombre}*: +${hp} HP y +${ki} Ki.`;
  }
  if (ef.tipo === 'curaEstados') {
    const antes = c.estados.jugador.length;
    c.estados.jugador = c.estados.jugador.filter((e) => !ef.negativos.includes(e.id));
    const curados = antes - c.estados.jugador.length;
    return curados > 0
      ? `🌿 Usaste *${objeto.nombre}*: curaste ${curados} estado/s.`
      : `🌿 Usaste *${objeto.nombre}*: no había estados que curar.`;
  }
  if (ef.tipo === 'estado') {
    aplicarEstado(c.estados.jugador, ef.id, ef.turnos);
    return `📜 Usaste *${objeto.nombre}*: ${fmt(STATUSES[ef.id].textos.aplicar, 'tú')}`;
  }
  return `Usaste *${objeto.nombre}*.`;
};

// Medidor de Despertar: activa 3 turnos de modo (#despertar, instante).
const activarDespertar = (u) => {
  const r = u.rpg;
  const c = r.combate;
  if (!c) return { error: 'Solo puedes despertarte durante un combate.' };
  if (c.despertadoYa) return { error: 'Ya despertaste en este combate.' };
  if ((r.despertar || 0) < BATALLA.despertar.max) {
    return { error: `Medidor de Despertar: ${r.despertar || 0}/${BATALLA.despertar.max}. ¡Seguí golpeando!` };
  }
  r.despertar = 0;
  c.despertarTurnos = BATALLA.despertar.turnosModo;
  c.despertadoYa = true;
  return {
    exito: true,
    mensaje: `🌟✨ *¡DESPERTAR!*\nDespiertas tu poder oculto por ${BATALLA.despertar.turnosModo} turnos:\n`
      + `• +${Math.round(BATALLA.despertar.bonusAtk * 100)}% ATK y +${Math.round(BATALLA.despertar.bonusVel * 100)}% VEL\n`
      + '• Habilidades sin costo de Ki y acceso a los Ougi.\n'
      + `• Al terminar: ${BATALLA.despertar.turnosCansancio} turno de cansancio.`,
  };
};

// Bloqueo de inicio de combate (inconsciencia) reutilizable por los comandos.
const bloqueoInicio = (u) => puedeCombatir(u);

module.exports = {
  startCombat,
  combatTurn,
  getEnemy,
  puedeCombatir,
  bloqueoInicio,
  activarDespertar,
  aplicarEstado,
  factorElemental,
  COMBATE_TIMEOUT_MS,
  COMBATE_MAX_TURNOS,
};
