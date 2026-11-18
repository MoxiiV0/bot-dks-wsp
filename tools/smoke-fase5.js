// Smoke test FASE 5 — motor de combate unificado.
// Uso: node tools/smoke-fase5.js
// Todo es determinista: se stubbea Math.random por test.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rpg = require('../lib/rpg');

const { BATALLA, ELEMENTOS, ARQUETIPOS } = rpg;
const { STATUSES } = rpg;
const { OBJETOS_COMBATE } = rpg;

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
  const u = { cash: 10000, bank: 0, ...extra };
  rpg.ensureRPG(u);
  return u;
};

const conKensei = (nivel = 1) => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = nivel;
  rpg.getStats(u);
  return u;
};

// Enemigo de prueba controlado (sin morir ni matar por accidente).
const enemigoPrueba = (extra = {}) => ({
  key: 'prueba',
  nombre: '🧟 Prueba',
  hp: 99999, atk: 0, def: 0, vel: 1,
  arquetipo: 'agresivo', elemento: null,
  esJefe: false, oro: 0, exp: 0, rango: null,
  ...extra,
});

const stub = (valor, fn) => {
  const orig = Math.random;
  Math.random = () => valor;
  try { fn(); } finally { Math.random = orig; }
};

// --- 1. DATA -------------------------------------------------------------------
console.log('DATA del motor:');
check('BATALLA: fórmula, crítico, defensa, telegrafía, Despertar y derrota', () => {
  assert.strictEqual(BATALLA.critico.probBase, 0.05);
  assert.strictEqual(BATALLA.critico.mult, 1.5);
  assert.strictEqual(BATALLA.esquiva.tope, 0.4);
  assert.strictEqual(BATALLA.defensa.reduccion, 0.5);
  assert.strictEqual(BATALLA.defensa.kiDevuelto, 8);
  assert.strictEqual(BATALLA.telegrafia.reduccionConDefensa, 0.7);
  assert.strictEqual(BATALLA.telegrafia.multAtaque, 3);
  assert.strictEqual(BATALLA.elementos.ventaja, 1.25);
  assert.strictEqual(BATALLA.elementos.desventaja, 0.8);
  assert.strictEqual(BATALLA.despertar.max, 100);
  assert.strictEqual(BATALLA.despertar.turnosModo, 3);
  assert.strictEqual(BATALLA.despertar.turnosCansancio, 1);
  assert.strictEqual(BATALLA.derrota.pierdePct, 0.1);
  assert.strictEqual(BATALLA.derrota.hpRestantePct, 0.3);
  assert.strictEqual(BATALLA.limite.turnos, 15);
  assert.strictEqual(BATALLA.expiracionMs, 10 * 60 * 1000);
});
check('8 estados con duración, acumulación y textos', () => {
  const esperados = ['sangrado', 'quemadura', 'veneno', 'aturdido', 'congelado', 'escudo', 'furia', 'marca'];
  assert.deepStrictEqual(Object.keys(STATUSES).sort(), esperados.sort());
  for (const st of Object.values(STATUSES)) {
    assert.ok(st.duracionTurnos > 0, `${st.id} sin duración`);
    assert.ok(st.maxPila >= 1, `${st.id} sin maxPila`);
    assert.ok(st.textos && st.textos.aplicar, `${st.id} sin texto`);
  }
});
check('objetos de combate: 5 con efecto', () => {
  assert.deepStrictEqual(
    Object.keys(OBJETOS_COMBATE).sort(),
    ['antidoto', 'elixir', 'pocion_hp', 'pocion_ki', 'talisman'].sort()
  );
  for (const o of Object.values(OBJETOS_COMBATE)) assert.ok(o.efecto && o.efecto.tipo, `${o.id} sin efecto`);
});
check('arquetipos: 4 y jefe con fases 70/40/15%', () => {
  assert.deepStrictEqual(Object.keys(ARQUETIPOS).sort(), ['agresivo', 'defensivo', 'erratico', 'jefe'].sort());
  assert.deepStrictEqual(ARQUETIPOS.jefe.fases.map((f) => f.pct), [0.7, 0.4, 0.15]);
});
check('elementos: ciclo fuego>viento>rayo>agua y luz>sombra', () => {
  assert.strictEqual(rpg.factorElemental('fuego', 'viento'), 1.25);
  assert.strictEqual(rpg.factorElemental('viento', 'rayo'), 1.25);
  assert.strictEqual(rpg.factorElemental('rayo', 'agua'), 1.25);
  assert.strictEqual(rpg.factorElemental('agua', 'fuego'), 1.25);
  assert.strictEqual(rpg.factorElemental('fuego', 'agua'), 0.8);
  assert.strictEqual(rpg.factorElemental('fuego', 'fuego'), 1);
  assert.strictEqual(rpg.factorElemental('luz', 'sombra'), 1.25);
  assert.strictEqual(rpg.factorElemental('sombra', 'luz'), 0.8);
  assert.strictEqual(rpg.factorElemental(null, 'fuego'), 1);
});
check('getEnemy: común, jefe y examen normalizados', () => {
  const comun = rpg.getEnemy('jabali');
  assert.strictEqual(comun.esJefe, false);
  assert.strictEqual(comun.arquetipo, 'agresivo');
  const jefe = rpg.getEnemy('slime');
  assert.strictEqual(jefe.esJefe, true);
  assert.strictEqual(jefe.arquetipo, 'jefe');
  const examen = rpg.getEnemy('examen_d');
  assert.strictEqual(examen.esJefe, false); // examen no penaliza por límite
  assert.strictEqual(examen.arquetipo, 'jefe');
});

// --- 2. Fórmula de daño --------------------------------------------------------
console.log('Fórmula de daño:');
check('bruto = ATK * mult * varianza; final = bruto * 100/(100+DEF)', () => {
  stub(0.999999, () => { // varianza ≈ max, sin crítico
    const u = conKensei();
    const s = rpg.getStats(u);
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ def: 100 }) });
    rpg.combatTurn(u, 'atacar');
    const infligido = 99999 - u.rpg.combate.enemyHp;
    const esperado = Math.max(1, Math.round(
      s.atk * BATALLA.varianza.max * BATALLA.divisorDef / (BATALLA.divisorDef + 100)
    ));
    assert.strictEqual(infligido, esperado);
  });
});
check('crítico: 5% base aplica x1.5 (stub 0 = crítico siempre)', () => {
  stub(0, () => {
    const u = conKensei();
    const s = rpg.getStats(u);
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ def: 0 }) });
    rpg.combatTurn(u, 'atacar');
    const infligido = 99999 - u.rpg.combate.enemyHp;
    const esperado = Math.max(1, Math.round(s.atk * BATALLA.varianza.min * BATALLA.critico.mult));
    assert.strictEqual(infligido, esperado, `${infligido} vs ${esperado}`);
  });
});
check('acción inválida no gasta turno', () => {
  const u = conKensei();
  rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba() });
  const res = rpg.combatTurn(u, 'bailar');
  assert.strictEqual(res.terminado, false);
  assert.strictEqual(res.tipo, null);
  assert.ok(res.resultado.includes('no válida'));
  assert.strictEqual(u.rpg.combate.turnos, 0);
});
check('iniciativa por VEL: el más rápido actúa primero', () => {
  const rapido = conKensei(); // VEL 8
  rpg.startCombat(rapido, 'prueba', { enemy: enemigoPrueba({ vel: 99, atk: 40 }) });
  stub(0.5, () => {
    const res = rpg.combatTurn(rapido, 'atacar');
    const iEnemigo = res.resultado.indexOf('👹');
    const iJugador = res.resultado.indexOf('🗡️');
    assert.ok(iEnemigo >= 0 && iJugador >= 0 && iEnemigo < iJugador, 'el enemigo vel 99 no actuó primero');
  });
  const lento = conKensei();
  rpg.startCombat(lento, 'prueba', { enemy: enemigoPrueba({ vel: 1, atk: 0 }) });
  stub(0.5, () => {
    const res = rpg.combatTurn(lento, 'atacar');
    const iEnemigo = res.resultado.indexOf('👹');
    const iJugador = res.resultado.indexOf('🗡️');
    assert.ok(iJugador < iEnemigo, 'el jugador vel 8 no actuó primero');
  });
});

// --- 3. Defender ---------------------------------------------------------------
console.log('Defender (#def):');
check('reduce 50% el daño y da +8 Ki una sola vez por golpe', () => {
  stub(0.5, () => { // varianza 1.0, sin crítico, IA ataca siempre
    const u = conKensei();
    u.rpg.ki = 0;
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ atk: 40, vel: 1 }) });
    const s = rpg.getStats(u);
    const hp0 = u.rpg.combate.hpJugador;
    const varianza = BATALLA.varianza.min + 0.5 * (BATALLA.varianza.max - BATALLA.varianza.min);
    const base = 40 * ARQUETIPOS.agresivo.multAtaque * varianza
      * BATALLA.divisorDef / (BATALLA.divisorDef + s.def);

    const r1 = rpg.combatTurn(u, 'defender');
    assert.ok(r1.resultado.includes('defendiste'), 'sin texto de defensa');
    assert.strictEqual(u.rpg.ki, 8, 'no recibió +8 Ki');
    const danoDefendido = hp0 - u.rpg.combate.hpJugador;
    assert.strictEqual(danoDefendido, Math.round(base * (1 - BATALLA.defensa.reduccion)));

    rpg.combatTurn(u, 'atacar'); // el escudo ya se consumió
    const danoTotal = hp0 - u.rpg.combate.hpJugador;
    assert.strictEqual(danoTotal, danoDefendido + Math.round(base));
  });
});
check('defender dos veces seguidas no repite el Ki', () => {
  stub(0.12, () => { // IA defensiva: se pone en guardia y no golpea
    const u = conKensei();
    u.rpg.ki = 0;
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ arquetipo: 'defensivo', atk: 0, vel: 1 }) });
    rpg.combatTurn(u, 'defender');
    assert.strictEqual(u.rpg.ki, 8);
    const res = rpg.combatTurn(u, 'defender');
    assert.ok(res.resultado.includes('Sigues en guardia'));
    assert.strictEqual(u.rpg.ki, 8, 'repitió el Ki');
  });
});

// --- 4. Estados ----------------------------------------------------------------
console.log('Estados alterados:');
check('aplicarEstado: acumula hasta maxPila y refresca duración', () => {
  const lista = [];
  rpg.aplicarEstado(lista, 'sangrado');
  rpg.aplicarEstado(lista, 'sangrado');
  rpg.aplicarEstado(lista, 'sangrado');
  assert.strictEqual(lista[0].capas, 3);
  assert.strictEqual(lista[0].turnos, 3);
  rpg.aplicarEstado(lista, 'sangrado'); // tope
  assert.strictEqual(lista[0].capas, 3);
  rpg.aplicarEstado(lista, 'furia');
  rpg.aplicarEstado(lista, 'furia'); // maxPila 1: solo refresca
  assert.strictEqual(lista.filter((e) => e.id === 'furia').length, 1);
  assert.strictEqual(lista.find((e) => e.id === 'furia').capas, 1);
});
check('DOT: el sangrado baja HP al iniciar el turno y se texto', () => {
  stub(0.5, () => {
    const u = conKensei();
    const s = rpg.getStats(u);
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ atk: 40, vel: 1 }) });
    u.rpg.combate.estados.jugador.push({ id: 'sangrado', turnos: 2, capas: 1 });
    const res = rpg.combatTurn(u, 'atacar');
    assert.ok(res.resultado.includes('Sangrado:'), 'sin texto de DOT');
    const varianza = BATALLA.varianza.min + 0.5 * (BATALLA.varianza.max - BATALLA.varianza.min);
    const danoEnemigo = Math.max(1, Math.round(
      40 * ARQUETIPOS.agresivo.multAtaque * varianza * BATALLA.divisorDef / (BATALLA.divisorDef + s.def)
    ));
    const dot = Math.max(1, Math.round(s.hp * STATUSES.sangrado.dot.pct));
    assert.strictEqual(u.rpg.combate.hpJugador, s.hp - dot - danoEnemigo);
  });
});

// --- 5. Habilidades (#hab) -----------------------------------------------------
console.log('Habilidades (#hab):');
check('resolveHabilidad: número, id y alias del legado', () => {
  const u = conKensei();
  rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba() });
  const c = u.rpg.combate;
  u.rpg.ki = 100;
  assert.strictEqual(rpg.resolveHabilidad(u, '1', c).habilidad.id, 'corte_relampago');
  assert.strictEqual(rpg.resolveHabilidad(u, 'corte_relampago', c).habilidad.id, 'corte_relampago');
  assert.strictEqual(rpg.resolveHabilidad(u, 'golpe_fuerte', c).habilidad.id, 'corte_relampago'); // alias #skill
});
check('resolveHabilidad: sin combate, sin nivel, sin Ki y en cooldown', () => {
  const u = conKensei(); // nivel 1
  rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba() });
  const c = u.rpg.combate;
  assert.ok(rpg.resolveHabilidad(u, '1', null).error.includes('combate'));
  u.rpg.ki = 100;
  assert.ok(rpg.resolveHabilidad(u, '3', c).error.includes('nivel 10')); // tajo_carmesi nv10
  u.rpg.ki = 5;
  assert.ok(rpg.resolveHabilidad(u, '1', c).error.includes('Ki insuficiente'));
  u.rpg.ki = 100;
  c.cooldowns['corte_relampago'] = c.turnos + 3;
  assert.ok(rpg.resolveHabilidad(u, '1', c).error.includes('cooldown'));
});
check('Ougi: requiere modo Despertar', () => {
  const u = conKensei(25);
  rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba() });
  u.rpg.ki = 100;
  assert.ok(rpg.resolveHabilidad(u, '4', u.rpg.combate).error.includes('Ougi'));
  u.rpg.combate.despertarTurnos = 2;
  assert.strictEqual(rpg.resolveHabilidad(u, '4', u.rpg.combate).habilidad.banner != null, true);
});

// --- 6. Despertar --------------------------------------------------------------
console.log('Despertar:');
check('activa 3 turnos, gasta el medidor y habilidades sin Ki', () => {
  stub(0.5, () => {
    const u = conKensei();
    u.rpg.despertar = 100;
    u.rpg.ki = 0;
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba() });
    const res = rpg.activarDespertar(u);
    assert.ok(res.exito, res.error);
    assert.strictEqual(u.rpg.combate.despertarTurnos, 3);
    assert.strictEqual(u.rpg.despertar, 0);

    const r1 = rpg.combatTurn(u, 'habilidad', '1');
    assert.ok(r1.resultado.includes('Corte Relámpago'), 'habilidad no lanzada');
    assert.strictEqual(u.rpg.ki, 0, 'gastó Ki en modo Despertar');
    rpg.combatTurn(u, 'atacar'); // turno 2
    rpg.combatTurn(u, 'atacar'); // turno 3: termina el modo
    assert.strictEqual(u.rpg.combate.despertarTurnos, 0);
    assert.strictEqual(u.rpg.combate.cansancioTurnos, 1);
    const r4 = rpg.combatTurn(u, 'atacar');
    assert.ok(r4.resultado.includes('cansancio'), 'no aplicó el cansancio');
  });
});
check('el medidor sube al golpear y al recibir daño fuerte', () => {
  stub(0.5, () => {
    const u = conKensei();
    u.rpg.despertar = 0;
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ atk: 40, vel: 1 }) });
    rpg.combatTurn(u, 'atacar'); // +5 por golpear, +8 por recibir 40 de daño
    assert.strictEqual(u.rpg.despertar, BATALLA.despertar.alGolpear + BATALLA.despertar.alRecibirGolpe);
  });
});

// --- 7. Derrota e inconsciencia ------------------------------------------------
console.log('Derrota:');
check('pierde 10% de oro, 2 min inconsciente y 30% de HP', () => {
  stub(0.5, () => {
    const u = conKensei();
    u.cash = 1000;
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ atk: 99999, vel: 1 }) });
    const res = rpg.combatTurn(u, 'atacar'); // sobrevive al ataque inicial y recibe el contraataque
    assert.strictEqual(res.tipo, 'derrota');
    assert.ok(res.resultado.includes('derrotado'));
    assert.strictEqual(u.cash, 900);
    assert.ok(u.rpg.inconscienteHasta > Date.now());
    const s = rpg.getStats(u);
    assert.strictEqual(u.rpg.hp, Math.ceil(s.hp * 0.3));
    assert.ok(rpg.puedeCombatir(u).error, 'sin bloqueo de inconsciencia');
    assert.strictEqual(rpg.startCombat(u, 'jabali'), null, 'empezó combate inconsciente');
  });
});

// --- 8. Huida ------------------------------------------------------------------
console.log('Huida:');
check('huir con VEL alta puede escapar; con mala suerte falla', () => {
  const u1 = conKensei();
  rpg.startCombat(u1, 'prueba', { enemy: enemigoPrueba() });
  stub(0, () => {
    const res = rpg.combatTurn(u1, 'huir');
    assert.strictEqual(res.tipo, 'escape');
    assert.strictEqual(u1.rpg.combate, null);
  });
  const u2 = conKensei();
  rpg.startCombat(u2, 'prueba', { enemy: enemigoPrueba() });
  stub(0.999999, () => {
    const res = rpg.combatTurn(u2, 'huir'); // prob tope 0.9 < 0.999999
    assert.strictEqual(res.terminado, false);
    assert.ok(res.resultado.includes('Fallaste'));
  });
});

// --- 9. Jefes: fases y telegrafía ----------------------------------------------
console.log('Jefes:');
check('fase al cruzar 70% de HP con aviso de cambio de patrón', () => {
  stub(0.5, () => {
    const u = conKensei();
    rpg.startCombat(u, 'slime');
    u.rpg.combate.enemyHp = Math.floor(u.rpg.combate.enemyMaxHp * 0.6);
    const res = rpg.combatTurn(u, 'atacar');
    assert.ok(res.resultado.includes('cambia de patrón'), 'sin aviso de fase');
    assert.strictEqual(u.rpg.combate.fase, 1);
  });
});
check('telegrafía: avisa 1 turno antes y #def recibe 70% menos', () => {
  stub(0.1, () => { // jefe carga (0.1 < 0.2), varianza 0.92, sin crítico
    const u = conKensei();
    const s = rpg.getStats(u);
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ arquetipo: 'jefe', atk: 40, vel: 1 }) });
    const hp0 = u.rpg.combate.hpJugador;

    const r1 = rpg.combatTurn(u, 'defender');
    assert.ok(r1.resultado.includes('carga un ataque enorme'), 'sin aviso de carga');
    assert.ok(r1.resultado.includes('#def'), 'sin hint de defensa');

    rpg.combatTurn(u, 'defender'); // mantiene la guardia
    const danoConDef = hp0 - u.rpg.combate.hpJugador;
    const varianza = BATALLA.varianza.min + 0.1 * (BATALLA.varianza.max - BATALLA.varianza.min);
    const base = 40 * ARQUETIPOS.jefe.multAtaque * BATALLA.telegrafia.multAtaque * varianza
      * BATALLA.divisorDef / (BATALLA.divisorDef + s.def);
    const esperado = Math.max(1, Math.round(base * (1 - BATALLA.telegrafia.reduccionConDefensa)));
    assert.strictEqual(danoConDef, esperado, `${danoConDef} vs ${esperado}`);
    assert.ok(u.rpg.combate.turnos >= 2);
  });
});
check('sin #def, el golpe cargado pega el triple', () => {
  stub(0.1, () => {
    const u = conKensei();
    const s = rpg.getStats(u);
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ arquetipo: 'jefe', atk: 40, vel: 1 }) });
    const hp0 = u.rpg.combate.hpJugador;
    rpg.combatTurn(u, 'atacar'); // el enemigo carga
    rpg.combatTurn(u, 'atacar'); // descarga sin defensa
    const dano = hp0 - u.rpg.combate.hpJugador;
    const varianza = BATALLA.varianza.min + 0.1 * (BATALLA.varianza.max - BATALLA.varianza.min);
    const esperado = Math.max(1, Math.round(
      40 * ARQUETIPOS.jefe.multAtaque * BATALLA.telegrafia.multAtaque * varianza
      * BATALLA.divisorDef / (BATALLA.divisorDef + s.def)
    ));
    assert.strictEqual(dano, esperado, `${dano} vs ${esperado}`);
  });
});

// --- 10. Objetos (#obj) --------------------------------------------------------
console.log('Objetos de combate:');
check('#obj pocion_hp cura 40% y consume el inventario', () => {
  stub(0.12, () => { // enemigo defensivo: no golpea durante la medición
    const u = conKensei();
    u.rpg.hp = 10;
    u.rpg.inventario = { pocion_hp: 1 };
    rpg.startCombat(u, 'prueba', { enemy: enemigoPrueba({ arquetipo: 'defensivo', vel: 1 }) });
    const res = rpg.combatTurn(u, 'objeto', 'pocion_hp');
    assert.ok(res.resultado.includes('Poción de Vida'));
    const s = rpg.getStats(u);
    assert.strictEqual(u.rpg.combate.hpJugador, 10 + Math.round(s.hp * 0.4));
    assert.strictEqual(u.rpg.inventario.pocion_hp, undefined);
  });
});
check('#obj sin inventario y #obj antidoto curan estados', () => {
  stub(0.5, () => {
    const u = conKensei();
    rpg.startCombat(u, 'jabali');
    const res = rpg.combatTurn(u, 'objeto', 'pocion_hp');
    assert.ok(res.resultado.includes('No tienes'), 'sin error de inventario');
    assert.strictEqual(res.terminado, false);

    u.rpg.inventario = { antidoto: 1 };
    u.rpg.combate.estados.jugador.push({ id: 'veneno', turnos: 2, capas: 1 });
    u.rpg.combate.estados.jugador.push({ id: 'escudo', turnos: 2, capas: 1 });
    const res2 = rpg.combatTurn(u, 'objeto', 'antidoto');
    assert.ok(res2.resultado.includes('Antídoto'));
    const ids = u.rpg.combate.estados.jugador.map((e) => e.id);
    assert.ok(!ids.includes('veneno'), 'no curó el veneno');
    assert.ok(ids.includes('escudo'), 'curó un estado positivo');
  });
});

// --- 11. Sin estado en globalThis ----------------------------------------------
console.log('Arquitectura:');
check('lib/rpg/** sin globalThis; index.js sin _mazmorraBoss ni skillPendiente', () => {
  const dir = path.join(__dirname, '..', 'lib', 'rpg');
  const pendientes = [dir];
  while (pendientes.length) {
    const d = pendientes.pop();
    for (const nombre of fs.readdirSync(d)) {
      const full = path.join(d, nombre);
      if (fs.statSync(full).isDirectory()) { pendientes.push(full); continue; }
      if (!full.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      assert.ok(!src.includes('globalThis'), `${full} usa globalThis`);
    }
  }
  const idx = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(!idx.includes('_mazmorraBoss'), 'index.js todavía referencia _mazmorraBoss');
  assert.ok(!idx.includes('skillPendiente'), 'index.js todavía referencia skillPendiente');
});
check('index.js registra atk/hab/def/obj/huir/despertar (help + públicos)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  for (const cmd of ['atk', 'hab', 'def', 'obj', 'huir', 'despertar']) {
    assert.ok(new RegExp(`\\n  ${cmd}: \\{`).test(src), `comando ${cmd} no definido`);
    assert.ok(src.includes(`'${cmd}'`), `${cmd} fuera de help/públicos`);
  }
  assert.ok(src.includes("accionCombate('atacar')"), '#pelear no es alias de #atk');
  assert.ok(src.includes('ejecutarHab'), '#skill no es alias de #hab');
});

console.log(`\n${ok} comprobaciones OK${process.exitCode ? ' (HUBO FALLOS)' : ''}`);
