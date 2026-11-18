// Smoke test FASE 7 — portales: llaves, pisos, eventos, botín, ranking.
// Uso: node tools/smoke-fase7.js

const assert = require('assert');
const rpg = require('../lib/rpg');
const { PORTAL, EVENTOS_PORTAL } = require('../lib/rpg/data/portals');
const fs = require('fs');
const path = require('path');

let ok = 0;
const check = (nombre, fn) => {
  try {
    fn();
    ok++;
    console.log(`  ✔ ${nombre}`);
  } catch (e) {
    console.error(`  ✘ ${nombre}: ${e.message}`);
    process.exitCode = 1;
  }
};

const nuevo = (extra = {}) => {
  const u = { cash: 100000, bank: 0, ...extra };
  rpg.ensureRPG(u);
  return u;
};

// Jugador capaz de barrer portales del rango E.
const jugador = (nivel = 30) => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = nivel;
  u.rpg.atributos = { atk: 20, hp: 10, def: 6, ki: 4, vel: 0 };
  u.rpg.arma = 'espada_hierro';
  u.rpg.equipo.arma = 'espada_hierro';
  rpg.getStats(u);
  return u;
};

// Ejecuta fn con Math.random fijado a un valor (0..1) y lo restaura.
const conRandom = (valor, fn) => {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; };
};

// --- 1. DATA ------------------------------------------------------------------
console.log('DATA del portal:');
check('pisos: 55% combate, 25% evento, 10% tesoro, 10% santuario (suma 100)', () => {
  assert.deepStrictEqual(Object.keys(PORTAL.pisos), ['combate', 'evento', 'tesoro', 'santuario']);
  assert.strictEqual(PORTAL.pisos.combate, 55);
  assert.strictEqual(PORTAL.pisos.evento, 25);
  assert.strictEqual(PORTAL.pisos.tesoro, 10);
  assert.strictEqual(PORTAL.pisos.santuario, 10);
  const suma = Object.values(PORTAL.pisos).reduce((a, b) => a + b, 0);
  assert.strictEqual(suma, 100);
});
check('constantes: llaves 3/día, dificultad +4%, jefe cada 10, muerte −50%', () => {
  assert.strictEqual(PORTAL.llavesPorDia, 3);
  assert.ok(PORTAL.costoOro > 0);
  assert.strictEqual(PORTAL.dificultadPorPiso, 0.04);
  assert.strictEqual(PORTAL.jefeCadaPisos, 10);
  assert.strictEqual(PORTAL.botinMuertePct, 0.5);
  assert.ok(PORTAL.expiracionMs > 0, 'expiración por timestamp (sin timers)');
});
check('6 rangos de portal E..S con nivelBase según el prompt', () => {
  assert.deepStrictEqual(Object.keys(PORTAL.rangos), ['E', 'D', 'C', 'B', 'A', 'S']);
  assert.deepStrictEqual(Object.values(PORTAL.rangos).map((r) => r.nivelBase), [1, 10, 20, 32, 45, 58]);
});
check('los 5 eventos viejos reescritos con efectos reales (suma 100)', () => {
  const esperados = ['cofre_oculto', 'trampa_sombras', 'pozo_sanador', 'altar_sacrificio', 'encuentro_mistico'];
  assert.deepStrictEqual(Object.keys(EVENTOS_PORTAL), esperados);
  const suma = Object.values(EVENTOS_PORTAL).reduce((a, e) => a + e.prob, 0);
  assert.strictEqual(suma, 100);
  const tipos = Object.values(EVENTOS_PORTAL).map((e) => e.tipo).sort();
  assert.deepStrictEqual(tipos, ['bono', 'curar', 'dano', 'exp', 'oro']);
  // efectos reales sobre HP/Ki/oro/bonos
  assert.ok(EVENTOS_PORTAL.trampa_sombras.hpPct > 0 && EVENTOS_PORTAL.trampa_sombras.kiPct > 0);
  assert.ok(EVENTOS_PORTAL.pozo_sanador.hpPct > 0 && EVENTOS_PORTAL.pozo_sanador.kiPct > 0);
  assert.ok(EVENTOS_PORTAL.cofre_oculto.oroBase > 0);
  assert.ok(EVENTOS_PORTAL.encuentro_mistico.expBase > 0);
  assert.strictEqual(EVENTOS_PORTAL.altar_sacrificio.tipo, 'bono');
});

// --- 2. Llaves -----------------------------------------------------------------
console.log('Llaves:');
check('3 llaves al día; abrir gasta 1', () => {
  const u = jugador();
  assert.strictEqual(rpg.llavesDisponibles(u), 3);
  const res = rpg.abrirPortal(u, 'E');
  assert.ok(!res.error, res.error);
  assert.strictEqual(rpg.llavesDisponibles(u), 2);
  assert.ok(/quedan 2\/3/.test(res.texto), res.texto);
});
check('sin llaves se paga en oro (nunca ambas)', () => {
  const u = jugador();
  u.rpg.portalLlaves = { fecha: new Date().toISOString().slice(0, 10), gastadas: 3 };
  const cashAntes = u.cash;
  // piso 1 fijado a santuario (sin oro) para medir solo el pago de entrada
  const res = conRandom(0.99, () => rpg.abrirPortal(u, 'E'));
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.cash, cashAntes - PORTAL.costoOro);
  assert.strictEqual(rpg.llavesDisponibles(u), 0, 'las llaves no se gastan si se pagó');
});
check('sin llaves y sin oro: error (nunca saldo negativo)', () => {
  const u = jugador();
  u.cash = 10;
  u.rpg.portalLlaves = { fecha: new Date().toISOString().slice(0, 10), gastadas: 3 };
  const res = rpg.abrirPortal(u, 'E');
  assert.ok(res.error);
  assert.strictEqual(u.cash, 10, 'no se descuenta nada');
  assert.ok(/llaves/.test(res.error) && /oro/.test(res.error), res.error);
});
check('las llaves se reinician al cambiar de fecha', () => {
  const u = jugador();
  u.rpg.portalLlaves = { fecha: '2000-01-01', gastadas: 3 };
  assert.strictEqual(rpg.llavesDisponibles(u), 3);
  assert.strictEqual(u.rpg.portalLlaves.gastadas, 0);
});

// --- 3. Apertura ---------------------------------------------------------------
console.log('Apertura:');
check('rango inválido y rango insuficiente dan error', () => {
  const u = jugador();
  assert.ok(rpg.abrirPortal(u, '1000').error, 'número viejo de la apuesta no abre portal');
  assert.ok(rpg.abrirPortal(u).error, 'sin rango da error con usos');
  u.rpg.rango = 'E';
  const res = rpg.abrirPortal(u, 'C');
  assert.ok(res.error && /rango de Cazador C/.test(res.error), res.error);
  assert.ok(!u.rpg.portal, 'no crea portal si falla');
});
check('bloqueado en combate y con portal activo', () => {
  const u = jugador();
  rpg.startCombat(u, 'jabali_joven');
  assert.ok(rpg.abrirPortal(u, 'E').error, 'en combate no abre');
  u.rpg.combate = null;
  assert.ok(!rpg.abrirPortal(u, 'E').error);
  assert.ok(/Ya tenés un portal/.test(rpg.abrirPortal(u, 'E').error), 'portal activo no duplica');
});
check('al abrir resuelve el piso 1 y guarda estado en u.rpg.portal', () => {
  const u = jugador();
  const res = rpg.abrirPortal(u, 'E');
  assert.ok(!res.error, res.error);
  const p = u.rpg.portal;
  assert.strictEqual(p.rango, 'E');
  assert.strictEqual(p.piso, 1);
  assert.ok(p.pisosVencidos >= 1 || p.enCombate, 'el piso 1 queda resuelto o en combate');
  assert.ok(typeof p.botin === 'number' && p.botin >= 0);
});

// --- 4. enemigoPortal ----------------------------------------------------------
console.log('Enemigos del portal:');
check('dificultad +4% por piso (compuesta)', () => {
  const e1 = rpg.enemigoPortal({ rango: 'E', piso: 1 });
  const e11 = rpg.enemigoPortal({ rango: 'E', piso: 11, });
  const esperado = Math.round(e1.hp * Math.pow(1.04, 10));
  assert.ok(Math.abs(e11.hp - esperado) <= 2, `hp piso11 ${e11.hp} vs esperado ~${esperado}`);
  assert.ok(e11.hp > e1.hp, 'el HP crece con el piso');
});
check('piso 10: jefe de portal con arquetipo jefe y botín extra', () => {
  const e10 = rpg.enemigoPortal({ rango: 'E', piso: 10 });
  const e9 = rpg.enemigoPortal({ rango: 'E', piso: 9 });
  assert.strictEqual(e10.esJefe, true);
  assert.strictEqual(e10.arquetipo, 'jefe');
  assert.strictEqual(e9.esJefe, false);
  assert.ok(e10.oro > e9.oro, 'el jefe paga más');
  assert.strictEqual(e10.tipo, 'jefe');
});
check('nivel = nivelBase del rango, zona coherente y stats por fórmula', () => {
  const e = rpg.enemigoPortal({ rango: 'C', piso: 3 });
  assert.strictEqual(e.nivel, 20);
  const zona = rpg.ZONAS[e.zona];
  assert.ok(zona && e.nivel >= zona.nivelMin && e.nivel <= zona.nivelMax, `zona ${e.zona} vs nv${e.nivel}`);
  const s = rpg.statsEscala(20, e.tipo);
  assert.strictEqual(e.def, s.def);
  assert.ok(e.hp >= s.hp, 'la dificultad del piso solo puede sumar HP');
});

// --- 5. Pisos (avanzar) ---------------------------------------------------------
console.log('Pisos:');
check('avanzar sin portal da error; con combate pendiente también', () => {
  const u = jugador();
  assert.ok(/No tenés un portal/.test(rpg.avanzarPortal(u).error));
  const v = conRandom(0.1, () => rpg.abrirPortal(u, 'E')); // 10% → combate
  assert.ok(!v.error, v.error);
  if (u.rpg.portal.enCombate) {
    assert.ok(/combate/.test(rpg.avanzarPortal(u).error), 'no avanza con combate en curso');
    u.rpg.combate = null;
    u.rpg.portal.enCombate = false;
  }
});
check('santuario (99%) restaura HP y Ki al 100%', () => {
  const u = jugador();
  u.rpg.hp = 5;
  u.rpg.ki = 1;
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.piso = 1;
  u.rpg.portal.pisosVencidos = 0;
  u.rpg.portal.enCombate = false;
  u.rpg.combate = null;
  const res = conRandom(0.99, () => rpg.avanzarPortal(u));
  assert.strictEqual(res.tipo, 'santuario', res.texto);
  const s = rpg.getStats(u);
  assert.strictEqual(u.rpg.hp, s.hp, 'HP completo');
  assert.strictEqual(u.rpg.ki, s.kiMax, 'Ki completo');
  assert.strictEqual(u.rpg.portal.pisosVencidos, 1, 'piso superado al instante');
});
check('evento altar (70%): cobra HP y aplica el bono temporal', () => {
  const u = jugador();
  u.rpg.ki = 0;
  const expAntes = u.rpg.exp;
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.piso = 1;
  u.rpg.portal.pisosVencidos = 0;
  u.rpg.portal.enCombate = false;
  u.rpg.combate = null;
  const res = conRandom(0.7, () => rpg.avanzarPortal(u)); // evento → altar (70)
  assert.strictEqual(res.tipo, 'evento', res.texto);
  assert.ok(/Altar del Sacrificio/.test(res.texto), res.texto);
  assert.ok(u.rpg.hp < rpg.getStats(u).hp, 'el altar cobra HP');
  assert.strictEqual(u.rpg.portal.bonoAtk, PORTAL.bonoAltar.atkPct, 'bono temporal aplicado');
  assert.strictEqual(u.rpg.portal.bonoPisos, PORTAL.bonoAltar.combates);
});
check('tesoro (85%): suma oro al efectivo y al botín', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.piso = 1;
  u.rpg.portal.pisosVencidos = 0;
  u.rpg.portal.enCombate = false;
  u.rpg.combate = null;
  const cashAntes = u.cash;
  const res = conRandom(0.85, () => rpg.avanzarPortal(u));
  assert.strictEqual(res.tipo, 'tesoro', res.texto);
  assert.ok(u.cash > cashAntes, 'el oro entra al efectivo');
  assert.ok(u.rpg.portal.botin > 0, 'el oro también cuenta como botín');
  assert.strictEqual(u.rpg.portal.pisosVencidos, 1);
});
check('combate (10%): inicia el motor con el bono del portal', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.piso = 1;
  u.rpg.portal.pisosVencidos = 0;
  u.rpg.portal.enCombate = false;
  u.rpg.combate = null;
  u.rpg.portal.bonoAtk = PORTAL.bonoAltar.atkPct;
  u.rpg.portal.bonoPisos = 2;
  const res = conRandom(0.1, () => rpg.avanzarPortal(u));
  assert.strictEqual(res.tipo, 'combate', res.texto);
  assert.ok(u.rpg.combate, 'motor de combate iniciado');
  assert.strictEqual(u.rpg.portal.enCombate, true);
  assert.strictEqual(u.rpg.combate.bonoAtk, PORTAL.bonoAltar.atkPct, 'bono pasado al combate');
  assert.strictEqual(u.rpg.portal.bonoPisos, 1, 'el bono se consume al entrar');
});

// --- 6. Post-combate y botín ----------------------------------------------------
console.log('Post-combate:');
check('victoria: suma piso y botín (oro ya pagado por el motor)', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.piso = 4;
  u.rpg.portal.pisosVencidos = 0;
  u.rpg.portal.enCombate = true;
  u.rpg.portal.pisoEnemy = { oro: 77, nombre: '🧪 Enemigo', esJefe: false };
  const botinAntes = u.rpg.portal.botin;
  const post = rpg.portalPostCombate(u, { terminado: true, tipo: 'victoria' });
  assert.ok(post && post.tipo === 'victoria');
  assert.strictEqual(u.rpg.portal.botin, botinAntes + 77);
  assert.strictEqual(u.rpg.portal.pisosVencidos, 1);
  assert.strictEqual(u.rpg.portal.enCombate, false);
  assert.ok(/avanzar/.test(post.texto));
});
check('derrota: pierde 50% del botín desde el efectivo (tope 0) y cierra', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.cash = 400; // efectivo posterior al piso 1 (determinista)
  u.rpg.portal.botin = 500; // botín acumulado
  u.rpg.portal.pisosVencidos = 3;
  u.rpg.portal.enCombate = true;
  const post = rpg.portalPostCombate(u, { terminado: true, tipo: 'derrota' });
  assert.ok(post && post.muerte);
  assert.strictEqual(post.perdida, 250, '50% de 500');
  assert.strictEqual(u.cash, 150, 'nunca saldo negativo');
  assert.ok(!u.rpg.portal, 'el portal se cierra al morir');
  assert.strictEqual(post.pisos, 3, 'reporta los pisos para el ranking');
});
check('huida o límite: conserva todo el botín y cierra', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.botin = 300;
  u.rpg.portal.enCombate = true;
  const cashAntes = u.cash;
  const post = rpg.portalPostCombate(u, { terminado: true, tipo: 'escape' });
  assert.ok(post && post.cierre);
  assert.strictEqual(u.cash, cashAntes, 'no se pierde nada al huir');
  assert.ok(!u.rpg.portal);
  assert.ok(/300/.test(post.texto));
});
check('turno sin fin no cierra nada (solo actúa con terminado)', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  if (u.rpg.portal.enCombate) {
    assert.strictEqual(rpg.portalPostCombate(u, { terminado: false, tipo: null }), null);
    assert.ok(u.rpg.portal, 'sigue abierto');
    assert.strictEqual(u.rpg.portal.enCombate, true);
  }
  assert.strictEqual(rpg.portalPostCombate({ rpg: {} }, { terminado: true, tipo: 'victoria' }), null, 'sin portal no hace nada');
});

// --- 7. Retirada y expiración ----------------------------------------------------
console.log('Retirada:');
check('retirarse conserva el botín (ya acreditado) y limpia el portal', () => {
  const u = jugador();
  // forzar sorteo de piso no-combate (tesoro) para probar la retirada limpia
  const resAbrir = conRandom(0.85, () => rpg.abrirPortal(u, 'E'));
  assert.ok(!resAbrir.error, resAbrir.error);
  u.rpg.portal.botin = 420;
  u.rpg.portal.pisosVencidos = 5;
  const cashAntes = u.cash;
  const res = rpg.retirarPortal(u);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.cash, cashAntes, 'no se pierde nada al retirar');
  assert.strictEqual(res.pisos, 5);
  assert.strictEqual(res.botin, 420);
  assert.ok(!u.rpg.portal);
  assert.ok(/420/.test(res.texto));
});
check('retirarse bloqueado en combate; sin portal da error', () => {
  const u = jugador();
  assert.ok(/No tenés/.test(rpg.retirarPortal(u).error));
  conRandom(0.1, () => rpg.abrirPortal(u, 'E'));
  if (u.rpg.portal && u.rpg.portal.enCombate) {
    const res = rpg.retirarPortal(u);
    assert.ok(res.error && /combate/.test(res.error), res.error);
    assert.ok(u.rpg.portal, 'el portal sigue abierto');
  }
});
check('expiración por timestamp: cierra conservando el botín', () => {
  const u = jugador();
  rpg.abrirPortal(u, 'E');
  u.rpg.portal.botin = 99;
  u.rpg.portal.lastAct = Date.now() - PORTAL.expiracionMs - 1000;
  u.rpg.portal.enCombate = false;
  const res = rpg.avanzarPortal(u);
  assert.ok(res.expiro, res.texto);
  assert.ok(!u.rpg.portal, 'el portal vencido se limpia');
  assert.ok(/99/.test(res.texto), 'conserva el botín');
});

// --- 8. Ranking semanal ------------------------------------------------------------
console.log('Ranking:');
check('registra récords ordenados y solo mejora al jugador', () => {
  const chats = {};
  rpg.registrarRanking(chats, 'g1@g.us', { id: 'a', nombre: 'Ana' }, 5);
  rpg.registrarRanking(chats, 'g1@g.us', { id: 'b', nombre: 'Beto' }, 9);
  rpg.registrarRanking(chats, 'g1@g.us', { id: 'a', nombre: 'Ana' }, 3); // peor: ignora
  rpg.registrarRanking(chats, 'g1@g.us', { id: 'a', nombre: 'Ana' }, 12); // mejor: actualiza
  const top = chats['g1@g.us'].portalRanking.top;
  assert.strictEqual(top[0].id, 'a');
  assert.strictEqual(top[0].pisos, 12);
  assert.strictEqual(top[1].pisos, 9);
  assert.strictEqual(chats['g1@g.us'].portalRanking.semana, rpg.semanaClave());
  assert.strictEqual(rpg.registrarRanking(chats, 'g1@g.us', { id: 'z' }, 0), null, 'pisos 0 no cuenta');
});
check('resetea al cambiar de semana (y el ranking lo detecta)', () => {
  const chats = { g: { portalRanking: { semana: '2000-W01', top: [{ id: 'x', nombre: 'X', pisos: 40 }] } } };
  assert.strictEqual(rpg.rankingGrupo(chats, 'g'), null, 'semana vieja → reset perezoso');
  assert.strictEqual(chats.g.portalRanking.semana, rpg.semanaClave());
  assert.deepStrictEqual(chats.g.portalRanking.top, []);
  assert.strictEqual(rpg.rankingGrupo(chats, 'g'), null, 'vacío tras el reset');
});
check('rankingGrupo formatea el top con medallas', () => {
  const chats = {};
  rpg.registrarRanking(chats, 'g', { id: 'a', nombre: 'Ana' }, 7);
  rpg.registrarRanking(chats, 'g', { id: 'b', nombre: 'Beto' }, 4);
  const txt = rpg.rankingGrupo(chats, 'g');
  assert.ok(/🏆/.test(txt) && /🥇 Ana — 7 pisos/.test(txt) && /🥈 Beto — 4 pisos/.test(txt), txt);
  assert.strictEqual(rpg.rankingGrupo(chats, 'otro'), null, 'grupo sin datos');
});

// --- 9. Integración: recorrido real ------------------------------------------------
console.log('Integración:');
check('recorrido completo: abrir → pisos → combates reales → retirar', () => {
  const u = jugador(30);
  u.cash = 50000;
  const res = rpg.abrirPortal(u, 'E');
  assert.ok(!res.error, res.error);
  let pasos = 0;
  while (u.rpg.portal && u.rpg.portal.pisosVencidos < 9 && pasos < 60) {
    pasos++;
    if (u.rpg.portal.enCombate) {
      let turnos = 0;
      while (u.rpg.combate && turnos < 30) {
        const r = rpg.combatTurn(u, 'atacar');
        turnos++;
        rpg.portalPostCombate(u, r);
        if (!u.rpg.combate) break;
      }
      if (u.rpg.combate) { u.rpg.combate = null; u.rpg.portal.enCombate = false; } // limpieza defensiva
    } else {
      const r = rpg.avanzarPortal(u);
      assert.ok(!r.error, r.error);
    }
    assert.ok(u.cash >= 0, 'saldo nunca negativo');
  }
  assert.ok(u.rpg.portal, 'el portal sigue abierto');
  u.rpg.portal.enCombate = false;
  u.rpg.combate = null;
  const ret = rpg.retirarPortal(u);
  assert.ok(!ret.error, ret.error);
  assert.ok(ret.pisos >= 9, `pisos superados: ${ret.pisos}`);
  assert.ok(!u.rpg.portal);
});
check('estadoPortal muestra llaves, rango activo y ayuda', () => {
  const u = jugador();
  const libre = rpg.estadoPortal(u);
  assert.ok(/Llaves: 3\/3/.test(libre) && /Portal E/.test(libre) && /ranking/.test(libre), libre);
  rpg.abrirPortal(u, 'E');
  const activo = rpg.estadoPortal(u);
  assert.ok(/Piso 1/.test(activo) && /Botín/.test(activo), activo);
});
check('index.js: portal cableado y sin globalThis._mazmorra', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(!idx.includes('globalThis._mazmorra'), 'la mazmorra vieja en globalThis sigue viva');
  assert.ok(/portal:\s*\{/.test(idx), 'comando #portal');
  assert.ok(/portalPostCombate/.test(idx), 'hook de post-combate');
  assert.ok(/registrarRanking/.test(idx), 'registro de ranking');
  assert.ok(/'portal'/.test(idx), 'portal en help/públicos');
});

console.log(`\n${ok} comprobaciones correctas${process.exitCode ? ' (CON FALLOS)' : ''}`);
