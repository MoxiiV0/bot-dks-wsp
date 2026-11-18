// Smoke test FASE 11 — PvP y social: duelos, torneos, jefe mundial.
// Uso: node tools/smoke-fase11.js

const assert = require('assert');
const rpg = require('../lib/rpg');
const { DUELO, TORNEO, JEFEMUNDIAL } = require('../lib/rpg/data/duels');

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
  const u = { cash: 50000, bank: 0, id: 'u_' + Math.floor(Math.random()*100000), ...extra };
  rpg.ensureRPG(u);
  return u;
};

const settings = {};

// --- 1. DATA ------------------------------------------------------------------
console.log('DATA de duelos:');
check('DUELO, TORNEO, JEFEMUNDIAL definidos', () => {
  assert.ok(DUELO && DUELO.turnoSegundos === 60);
  assert.ok(TORNEO && TORNEO.maxJugadores === 8);
  assert.ok(JEFEMUNDIAL && JEFEMUNDIAL.hpBase === 50000);
});
check('reglas de duelo: comisión, apuesta min/máx, 60s por turno', () => {
  assert.strictEqual(DUELO.comisionApuesta, 0.1);
  assert.strictEqual(DUELO.apuestaMin, 1000);
  assert.strictEqual(DUELO.apuestaMax, 100000);
  assert.strictEqual(DUELO.turnoSegundos, 60);
});

// --- 2. Duelos -----------------------------------------------------------------
console.log('Duelos:');
check('dueloIniciar crea sesión y valida apuesta', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  rpg.getStats(u);
  const oponente = { id: 'oponente_test', cash: 50000, bank: 0, rpg: { clase: 'kensei', nivel: 10 } };
  rpg.ensureRPG(oponente);
  rpg.getStats(oponente);
  const res = rpg.dueloIniciar(u, oponente, 5000);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.exito, true);
  assert.strictEqual(u.rpg.duelo.oponente, oponente.id);
  assert.strictEqual(u.rpg.duelo.estado, 'esperando');
  assert.strictEqual(u.rpg.duelo.apuesta, 5000);
});
check('dueloIniciar falla sin suficiente oro', () => {
  const u = nuevo();
  u.cash = 100;
  const res = rpg.dueloIniciar(u, 'oponente_1', 5000);
  assert.ok(res.error);
});
check('dueloAceptar cambia estado a activo', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  rpg.getStats(u);
  const iniciador = nuevo();
  iniciador.rpg.clase = 'kensei';
  iniciador.rpg.nivel = 10;
  rpg.getStats(iniciador);
  const resIni = rpg.dueloIniciar(iniciador, u, 5000);
  assert.ok(!resIni.error, resIni.error);
  const res = rpg.dueloAceptar(u);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.duelo.estado, 'activo');
});
check('dueloEstado muestra estado', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  rpg.getStats(u);
  const iniciador = nuevo();
  iniciador.rpg.clase = 'kensei';
  iniciador.rpg.nivel = 10;
  rpg.getStats(iniciador);
  rpg.dueloIniciar(iniciador, u, 5000);
  rpg.dueloAceptar(u);
  assert.strictEqual(u.rpg.duelo.estado, 'activo');
  assert.strictEqual(u.rpg.duelo.oponente, iniciador.id);
});
check('dueloRendirse termina con derrota', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  rpg.getStats(u);
  const iniciador = nuevo();
  iniciador.rpg.clase = 'kensei';
  iniciador.rpg.nivel = 10;
  rpg.getStats(iniciador);
  rpg.dueloIniciar(iniciador, u, 5000);
  rpg.dueloAceptar(u);
  const res = rpg.dueloRendirse(u);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.duelo.estado, 'terminado');
  assert.strictEqual(u.rpg.duelo.resultado, 'rendido');
});

// --- 3. Torneo -----------------------------------------------------------------
console.log('Torneo:');
check('torneoInscribir agrega jugador y descuenta inscripción', () => {
  const u = nuevo();
  u.cash = 5000;
  const res = rpg.torneoInscribir(u, 'grupo_1', settings);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.cash, 4000);
  const t = rpg.torneoEstado('grupo_1', settings);
  assert.ok(/Jugadores: 1\/8/.test(t));
});
check('torneoInscribir falla si ya inscrito o lleno', () => {
  const u = nuevo();
  u.cash = 5000;
  rpg.torneoInscribir(u, 'grupo_1', settings);
  const res = rpg.torneoInscribir(u, 'grupo_1', settings);
  assert.ok(res.error);
  // llenar hasta 8
  for (let i = 0; i < 7; i++) {
    const ui = nuevo();
    ui.cash = 5000;
    rpg.torneoInscribir(ui, 'grupo_1', settings);
  }
  const res2 = rpg.torneoInscribir(nuevo(), 'grupo_1', settings);
  assert.ok(res2.error && /lleno/.test(res2.error));
});
check('torneoRonda avanza y declara campeón', () => {
  const s = {};
  // crear torneo con 2 jugadores
  const u1 = nuevo(); u1.cash = 5000;
  const u2 = nuevo(); u2.cash = 5000;
  rpg.torneoInscribir(u1, 'g2', s);
  rpg.torneoInscribir(u2, 'g2', s);
  const t = rpg.torneoEstado('g2', s);
  assert.ok(/inscripcion/.test(t));
  const res = rpg.torneoRonda('g2', s);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.terminado, true);
  assert.ok(res.campeon, 'debe haber campeón');
  const t2 = rpg.torneoEstado('g2', s);
  assert.ok(/Campeón/.test(t2));
});

// --- 4. Jefe mundial ------------------------------------------------------------
console.log('Jefe mundial:');
check('jefeMundialIniciar crea jefe con HP según miembros', () => {
  const res = rpg.jefeMundialIniciar('grupo_jefe', settings, 3);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.exito, true);
  const j = rpg.jefeMundialEstado('grupo_jefe', settings);
  assert.ok(/Señor del Mundo/.test(j));
  assert.ok(/50000/.test(j) || /80000/.test(j)); // 50000 + 3*10000
});
check('jefeMundialDaño acumula y termina al morir', () => {
  const s = {};
  rpg.jefeMundialIniciar('g3', s, 1);
  const u = nuevo();
  const res1 = rpg.jefeMundialDaño(u, 'g3', s, 35000);
  assert.ok(!res1.error, res1.error);
  assert.ok(!res1.terminado);
  const res2 = rpg.jefeMundialDaño(u, 'g3', s, 30000); // total 65000 > 60000
  assert.ok(res2.terminado, 'debe terminar al morir');
  assert.ok(res2.recompensas);
  assert.ok(res2.recompensas[u.id] > 0, 'debe haber recompensa proporcional');
});
check('jefeMundialEstado muestra daño por participante', () => {
  const s = {};
  rpg.jefeMundialIniciar('g4', s, 1);
  const u = nuevo();
  rpg.jefeMundialDaño(u, 'g4', s, 5000);
  const est = rpg.jefeMundialEstado('g4', s);
  assert.ok(/5000/.test(est));
});

// --- 5. Integración: setEconomiaHooks -------------------------------------------
console.log('Integración:');
check('setEconomiaHooks registra callbacks', () => {
  let marcado = false;
  let guardado = false;
  rpg.setEconomiaHooks(() => { marcado = true; }, () => { guardado = true; });
  const u = nuevo();
  const res = rpg.torneoInscribir(u, 'g5', settings);
  assert.ok(!res.error, res.error);
  assert.ok(marcado, 'markEconDirty debió llamarse');
  assert.ok(guardado, 'saveSettings debió llamarse');
});

console.log(`\n${ok} comprobaciones correctas${process.exitCode ? ' (CON FALLOS)' : ''}`);
