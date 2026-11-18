// Smoke test FASE 6 — mundo: zonas, escalado por nivel, caza y viaje.
// Uso: node tools/smoke-fase6.js

const assert = require('assert');
const rpg = require('../lib/rpg');
const { ZONAS, ZONA_INICIAL, ESCALADO } = require('../lib/rpg/data/world');

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

// --- 1. Datos: 6 zonas con 7 enemigos cada una --------------------------------
console.log('Zonas:');
check('6 zonas con niveles según el prompt', () => {
  const claves = Object.keys(ZONAS);
  assert.deepStrictEqual(claves, ['sakura', 'torii', 'luna', 'cristal', 'trueno', 'abismo']);
  assert.strictEqual(ZONAS.sakura.nivelMin, 1);
  assert.strictEqual(ZONAS.sakura.nivelMax, 9);
  assert.strictEqual(ZONAS.torii.nivelMin, 8);
  assert.strictEqual(ZONAS.torii.nivelMax, 18);
  assert.strictEqual(ZONAS.luna.nivelMin, 16);
  assert.strictEqual(ZONAS.luna.nivelMax, 28);
  assert.strictEqual(ZONAS.cristal.nivelMin, 26);
  assert.strictEqual(ZONAS.cristal.nivelMax, 38);
  assert.strictEqual(ZONAS.trueno.nivelMin, 36);
  assert.strictEqual(ZONAS.trueno.nivelMax, 48);
  assert.strictEqual(ZONAS.abismo.nivelMin, 46);
  assert.strictEqual(ZONAS.abismo.nivelMax, 60);
});
check('cada zona: 5 normales + 1 élite + 1 jefe, con elemento y arquetipo', () => {
  for (const [zKey, zona] of Object.entries(ZONAS)) {
    const enemigos = Object.entries(zona.enemigos);
    assert.strictEqual(enemigos.length, 7, `${zKey} debe tener 7 enemigos`);
    const normales = enemigos.filter(([, e]) => e.tipo === 'normal');
    const elites = enemigos.filter(([, e]) => e.tipo === 'elite');
    const jefes = enemigos.filter(([, e]) => e.tipo === 'jefe');
    assert.strictEqual(normales.length, 5, `${zKey}: 5 normales`);
    assert.strictEqual(elites.length, 1, `${zKey}: 1 élite`);
    assert.strictEqual(jefes.length, 1, `${zKey}: 1 jefe`);
    for (const [eKey, e] of enemigos) {
      assert.ok(e.nombre, `${zKey}.${eKey} sin nombre`);
      assert.ok(e.elemento, `${zKey}.${eKey} sin elemento`);
      assert.ok(e.arquetipo, `${zKey}.${eKey} sin arquetipo`);
      assert.ok(e.nivel >= zona.nivelMin && e.nivel <= zona.nivelMax,
        `${zKey}.${eKey} nv${e.nivel} fuera de ${zona.nivelMin}-${zona.nivelMax}`);
      if (e.tipo === 'jefe') assert.strictEqual(e.arquetipo, 'jefe', `${zKey}.${eKey}: jefe usa arquetipo jefe`);
    }
  }
});
check('claves de enemigo únicas entre zonas (getEnemy sin ambigüedad)', () => {
  const vistas = new Set();
  for (const zona of Object.values(ZONAS)) {
    for (const eKey of Object.keys(zona.enemigos)) {
      assert.ok(!vistas.has(eKey), `clave duplicada entre zonas: ${eKey}`);
      vistas.add(eKey);
    }
  }
  assert.strictEqual(vistas.size, 42);
});
check('rango requerido solo en las 3 zonas altas', () => {
  assert.strictEqual(ZONAS.sakura.rangoReq, null);
  assert.strictEqual(ZONAS.torii.rangoReq, null);
  assert.strictEqual(ZONAS.luna.rangoReq, null);
  assert.strictEqual(ZONAS.cristal.rangoReq, 'C');
  assert.strictEqual(ZONAS.trueno.rangoReq, 'B');
  assert.strictEqual(ZONAS.abismo.rangoReq, 'A');
});
check('ZONA_INICIAL es sakura', () => {
  assert.strictEqual(ZONA_INICIAL, 'sakura');
});

// --- 2. Escalado y recompensas --------------------------------------------------
console.log('Escalado:');
check('HP = 45+22*Lv, ATK = 8+2.6*Lv, DEF = 3+1.2*Lv', () => {
  const s = rpg.statsEscala(10, 'normal');
  assert.strictEqual(s.hp, 45 + 22 * 10);
  assert.strictEqual(s.atk, Math.round(8 + 2.6 * 10));
  assert.strictEqual(s.def, Math.round(3 + 1.2 * 10));
});
check('élite: HP x1.6 y ATK x1.25', () => {
  const base = rpg.statsEscala(10, 'normal');
  const elite = rpg.statsEscala(10, 'elite');
  assert.strictEqual(elite.hp, Math.round(base.hp * ESCALADO.elite.hpMult));
  assert.strictEqual(elite.atk, Math.round(base.atk * ESCALADO.elite.atkMult));
  assert.strictEqual(elite.def, base.def);
});
check('jefe: HP x6 y ATK x1.5 (ESCALADO.jefe)', () => {
  const base = rpg.statsEscala(10, 'normal');
  const jefe = rpg.statsEscala(10, 'jefe');
  assert.strictEqual(jefe.hp, Math.round(base.hp * ESCALADO.jefe.hpMult));
  assert.strictEqual(jefe.atk, Math.round(base.atk * ESCALADO.jefe.atkMult));
  assert.strictEqual(ESCALADO.jefe.hpMult, 6);
  assert.strictEqual(ESCALADO.jefe.atkMult, 1.5);
});
check('EXP = ceil(expToNext(Lv)/(10+0.25*Lv))', () => {
  for (const lv of [1, 9, 30, 60]) {
    const esperado = Math.ceil(rpg.expToNext(lv) / (ESCALADO.exp.divisorBase + ESCALADO.exp.divisorPorNivel * lv));
    assert.strictEqual(rpg.recompensas(lv).exp, esperado, `nv${lv}`);
  }
});
check('Oro = 20+6*Lv con ±20% de variación', () => {
  for (let i = 0; i < 50; i++) {
    const { oro } = rpg.recompensas(20);
    const base = ESCALADO.oro.base + ESCALADO.oro.porNivel * 20;
    assert.ok(oro >= Math.round(base * 0.8) && oro <= Math.round(base * 1.2),
      `oro ${oro} fuera de rango para nv20 (base ${base})`);
  }
});

// --- 3. enemigoZona normalizado al motor ---------------------------------------
console.log('enemigoZona:');
check('devuelve el esquema del motor (hp/atk/def/vel/arquetipo/esJefe)', () => {
  const e = rpg.enemigoZona('oni_puente');
  assert.strictEqual(e.key, 'oni_puente');
  assert.strictEqual(e.zona, 'sakura');
  assert.strictEqual(e.nivel, 9);
  assert.strictEqual(e.tipo, 'jefe');
  assert.strictEqual(e.esJefe, true);
  assert.strictEqual(e.arquetipo, 'jefe');
  assert.strictEqual(e.elemento, 'sombra');
  assert.strictEqual(e.hp, Math.round((45 + 22 * 9) * 6));
  assert.ok(e.atk > 0 && e.def >= 0 && e.vel > 0);
  assert.ok(e.exp > 0 && e.oro > 0);
});
check('clave desconocida devuelve null', () => {
  assert.strictEqual(rpg.enemigoZona('no_existe'), null);
  assert.strictEqual(rpg.enemigoZona(''), null);
  assert.strictEqual(rpg.enemigoZona(null), null);
});
check('getEnemy resuelve enemigos de zona (integración con el motor FASE 5)', () => {
  const e = rpg.getEnemy('zorro_anciano');
  assert.ok(e, 'getEnemy debe resolver enemigos de zona');
  assert.strictEqual(e.esJefe, true);
  assert.strictEqual(e.zona, 'torii');
  // y sigue resolviendo los enemigos legados y de examen
  assert.ok(rpg.getEnemy('jabali'));
  assert.ok(rpg.getEnemy('examen_d'));
});

// --- 4. Zona actual y viaje ------------------------------------------------------
console.log('Viaje:');
check('zonaActual arranca en sakura y es perezoso/idempotente', () => {
  const u = nuevo();
  assert.strictEqual(u.rpg.zona, undefined, 'ensureRPG no debe escribir zona todavía');
  assert.strictEqual(rpg.zonaActual(u), 'sakura');
  assert.strictEqual(u.rpg.zona, 'sakura');
  assert.strictEqual(rpg.zonaActual(u), 'sakura');
});
check('zona inválida en el save vuelve a la inicial', () => {
  const u = nuevo();
  u.rpg.zona = 'zona_fantasma';
  assert.strictEqual(rpg.zonaActual(u), 'sakura');
});
check('viajar bloquea por nivel', () => {
  const u = nuevo();
  u.rpg.nivel = 5;
  const res = rpg.viajar(u, 'luna');
  assert.ok(res.error, 'nv5 no puede viajar a luna');
  assert.ok(/nivel 16/.test(res.error), res.error);
  assert.strictEqual(rpg.zonaActual(u), 'sakura', 'la zona no cambia si falla');
});
check('viajar bloquea por rango', () => {
  const u = nuevo();
  u.rpg.nivel = 30;
  u.rpg.rango = 'E';
  const res = rpg.viajar(u, 'cristal');
  assert.ok(res.error, 'rango E no puede entrar a cristal');
  assert.ok(/rango de Cazador C/.test(res.error), res.error);
  u.rpg.rango = 'C';
  assert.ok(!rpg.viajar(u, 'cristal').error, 'con rango C debería poder');
  assert.strictEqual(u.rpg.zona, 'cristal');
});
check('viajar acepta zonas por nivel sin rango (torii desde nv8)', () => {
  const u = nuevo();
  u.rpg.nivel = 8;
  const res = rpg.viajar(u, 'torii');
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.zona, 'torii');
  assert.ok(/Torii/.test(res.mensaje));
});
check('viajar bloqueado en combate', () => {
  const u = nuevo();
  u.rpg.nivel = 9; // suficiente para torii (nv8)
  rpg.startCombat(u, 'jabali_joven');
  assert.ok(u.rpg.combate, 'debería haber combate');
  const res = rpg.viajar(u, 'torii');
  assert.ok(res.error && /combate/.test(res.error), res.error);
  assert.strictEqual(rpg.zonaActual(u), 'sakura');
});
check('zona desconocida da error con las disponibles', () => {
  const u = nuevo();
  const res = rpg.viajar(u, 'atlantida');
  assert.ok(res.error);
  assert.ok(/sakura/.test(res.error), res.error);
});
check('listaZonas marca 📍 actual, 🔒 bloqueada y ✅ disponible', () => {
  const u = nuevo();
  u.rpg.nivel = 30;
  u.rpg.rango = 'B';
  const txt = rpg.listaZonas(u);
  assert.ok(/📍/.test(txt) && /🔒/.test(txt) && /✅/.test(txt), txt);
  assert.strictEqual((txt.match(/📍/g) || []).length, 1, 'una sola zona actual');
  assert.ok(!/🔒/.test(txt.split('\n')[0]), 'sakura siempre accesible');
});

// --- 5. Caza ----------------------------------------------------------------------
console.log('Caza:');
check('cazar sin referencia: normal o élite de la zona actual (nunca jefe)', () => {
  const u = nuevo();
  const tipos = new Set();
  for (let i = 0; i < 200; i++) {
    const res = rpg.cazar(u);
    assert.ok(res.enemy, 'siempre devuelve enemigo');
    assert.strictEqual(res.zona, 'sakura');
    tipos.add(res.enemy.tipo);
    assert.notStrictEqual(res.enemy.tipo, 'jefe', 'el jefe no sale al azar');
  }
  assert.ok(tipos.has('normal'), 'debería salir normales');
  assert.ok(tipos.has('elite'), 'debería salir élites (20% de peso)');
});
check('cazar jefe: devuelve el jefe de la zona', () => {
  const u = nuevo();
  const res = rpg.cazar(u, 'jefe');
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.clave, 'oni_puente');
  assert.strictEqual(res.enemy.esJefe, true);
});
check('cazar por clave exacta funciona', () => {
  const u = nuevo();
  const res = rpg.cazar(u, 'serpiente_bamboo');
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.clave, 'serpiente_bamboo');
  assert.strictEqual(res.enemy.tipo, 'normal');
});
check('cazar clave inexistente da error con las disponibles', () => {
  const u = nuevo();
  const res = rpg.cazar(u, 'dragon');
  assert.ok(res.error);
  assert.ok(/jabali_joven/.test(res.error), res.error);
});
check('la caza respeta la zona actual', () => {
  const u = nuevo();
  u.rpg.nivel = 20;
  rpg.viajar(u, 'luna');
  const res = rpg.cazar(u);
  assert.strictEqual(res.zona, 'luna');
  assert.ok(res.enemy.zona === 'luna', 'enemigo debe ser de la zona actual');
});

// --- 6. Integración con el motor -------------------------------------------------
console.log('Integración motor:');
check('startCombat acepta un enemigo de zona', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  const enemy = rpg.startCombat(u, 'capitan_bandido');
  assert.ok(enemy, 'startCombat debería iniciar');
  assert.ok(u.rpg.combate);
  assert.strictEqual(u.rpg.combate.enemyKey, 'capitan_bandido');
  assert.strictEqual(u.rpg.combate.esJefe, false);
  assert.strictEqual(u.rpg.combate.enemyHp, enemy.hp);
});
check('startCombat marca esJefe y fase para el jefe de zona', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  rpg.startCombat(u, 'oni_puente');
  assert.strictEqual(u.rpg.combate.esJefe, true);
  assert.strictEqual(u.rpg.combate.enemy.arquetipo, 'jefe');
  // el jefe tiene fases de IA (70/40/15)
  const { ARQUETIPOS } = rpg;
  assert.deepStrictEqual(ARQUETIPOS.jefe.fases.map((f) => f.pct), [0.7, 0.4, 0.15]);
});
check('un combate de zona se puede jugar hasta el final', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 9;
  u.rpg.atributos = { atk: 8, hp: 4, def: 2, ki: 2, vel: 0 };
  u.rpg.arma = 'espada_hierro';
  u.rpg.equipo.arma = 'espada_hierro';
  rpg.getStats(u);
  rpg.startCombat(u, 'jabali_joven');
  let turnos = 0;
  while (u.rpg.combate && turnos < 30) {
    rpg.combatTurn(u, 'atacar');
    turnos++;
  }
  assert.ok(!u.rpg.combate, 'el combate debe terminar');
  assert.ok(turnos > 0 && turnos < 30, `terminó en ${turnos} turnos`);
});
check('límite de turnos es 25 (FASE 6: jefes de 12-20 turnos)', () => {
  assert.strictEqual(rpg.BATALLA.limite.turnos, 25);
});

console.log(`\n${ok} comprobaciones correctas${process.exitCode ? ' (CON FALLOS)' : ''}`);
