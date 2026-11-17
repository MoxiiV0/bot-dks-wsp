// Smoke test FASE 3 — progresión y stats.
// Uso: node tools/smoke-fase3.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rpg = require('../lib/rpg');

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

// --- 1. Fórmula de stats: base + crecimiento*(L-1) + atributos ---------------
console.log('Fórmula de stats:');
check('guerrero nv1: hp 120, atk 15, def 8, ki 60, vel 8', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  const s = rpg.getStats(u);
  assert.strictEqual(s.hp, 120);
  assert.strictEqual(s.atk, 15);
  assert.strictEqual(s.def, 8);
  assert.strictEqual(s.kiMax, 60);
  assert.strictEqual(s.vel, 8);
});
check('guerrero nv10: crecimiento x9 (hp 246, atk 35, def 22, ki 87)', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.nivel = 10;
  const s = rpg.getStats(u);
  assert.strictEqual(s.hp, Math.round(120 + 14 * 9));
  assert.strictEqual(s.atk, Math.round(15 + 2.2 * 9));
  assert.strictEqual(s.def, Math.round(8 + 1.6 * 9));
  assert.strictEqual(s.kiMax, Math.round(60 + 3 * 9));
});
check('mago nv1: kiBase 120, vel 9', () => {
  const u = nuevo();
  u.rpg.clase = 'mago';
  const s = rpg.getStats(u);
  assert.strictEqual(s.kiMax, 120);
  assert.strictEqual(s.vel, 9);
});
check('sin clase: ki por defecto 100, vel 5, sin crecimiento', () => {
  const u = nuevo();
  const s = rpg.getStats(u);
  assert.strictEqual(s.kiMax, rpg.KI_SIN_CLASE);
  assert.strictEqual(s.vel, rpg.VEL_SIN_CLASE);
  u.rpg.nivel = 20;
  const s2 = rpg.getStats(u);
  assert.strictEqual(s2.hp, 0); // sin clase no crece
});
check('evolución hereda crecimiento de la base (asesino <- pícaro)', () => {
  const crec = rpg.getGrowth('asesino');
  assert.deepStrictEqual(crec, rpg.getGrowth('pícaro'));
  const u = nuevo();
  u.rpg.clase = 'asesino';
  u.rpg.nivel = 20;
  const s = rpg.getStats(u);
  // asesino: hpBase 100 + crec pícaro hp 9 * 19
  assert.strictEqual(s.hp, Math.round(100 + 9 * 19));
});
check('clases secundarias tienen kiBase/vel propios (invocador 100/11)', () => {
  assert.strictEqual(rpg.kiBaseDe('invocador'), 100);
  assert.strictEqual(rpg.velBaseDe('invocador'), 11);
  assert.strictEqual(rpg.kiBaseDe('nigromante'), 110);
});

// --- 2. addExp: puntos por nivel + curación 20% + cap 60 --------------------
console.log('addExp (FASE 3):');
check('subir N niveles otorga 2*N puntos', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  const txt = rpg.addExp(u, 2000); // niveles 1 -> 7 aprox
  assert.ok(txt && txt.includes('puntos de atributo'), 'texto sin puntos');
  assert.strictEqual(u.rpg.puntos, (u.rpg.nivel - 1) * 2);
});
check('subir cura 20% del máximo', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.hp = 1; // muy dañado
  u.rpg.ki = 0;
  rpg.addExp(u, 40); // un nivel
  const s = rpg.getStats(u);
  const esperado = Math.min(s.hp, 1 + Math.ceil(s.hp * 0.2));
  assert.strictEqual(u.rpg.hp, esperado);
  assert.ok(u.rpg.ki > 0, 'ki no curó');
});
check('tope MAX_LEVEL = 60 sin bucle infinito', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.nivel = 59;
  rpg.addExp(u, 1000000);
  assert.strictEqual(u.rpg.nivel, 60);
  assert.ok(u.rpg.exp < rpg.expToNext(60));
});

// --- 3. Pago retroactivo (back-pay) ------------------------------------------
console.log('Puntos retroactivos:');
check('usuario legado nv12 recibe (12-1)*2 = 22 puntos, una sola vez', () => {
  const leg = { cash: 1000, bank: 0 };
  leg.rpg = { clase: 'guerrero', nivel: 12, exp: 45, statsEnemigosDerrotados: 5 };
  rpg.ensureRPG(leg);
  assert.strictEqual(leg.rpg.puntos, 22);
  assert.strictEqual(leg.rpg.puntosOtorgados, true);
  rpg.ensureRPG(leg);
  assert.strictEqual(leg.rpg.puntos, 22); // idempotente
});
check('usuario nuevo nv1 recibe 0 y queda marcado', () => {
  const u = nuevo();
  assert.strictEqual(u.rpg.puntos, 0);
  assert.strictEqual(u.rpg.puntosOtorgados, true);
});

// --- 4. #entrenar / #reiniciar -----------------------------------------------
console.log('Atributos:');
check('invertirPunto aplica bonus por punto y descuenta', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.puntos = 5;
  const res = rpg.invertirPunto(u, 'atk', 3);
  assert.ok(res.exito, res.error);
  assert.strictEqual(u.rpg.puntos, 2);
  assert.strictEqual(u.rpg.atributos.atk, 3);
  const s = rpg.getStats(u);
  assert.strictEqual(s.atk, 15 + 3 * 2); // +2 atk por punto
});
check('errores: atributo inválido, sin puntos, cantidad no entera', () => {
  const u = nuevo();
  u.rpg.puntos = 1;
  assert.ok(rpg.invertirPunto(u, 'suerte', 1).error);
  assert.ok(rpg.invertirPunto(u, 'atk', 99).error);
  assert.ok(rpg.invertirPunto(u, 'atk', -5).error);
  assert.strictEqual(u.rpg.puntos, 1); // nada tocado
});
check('reiniciarPuntos devuelve los puntos y cuesta oro', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.puntos = 4;
  u.rpg.oro = 5000;
  rpg.invertirPunto(u, 'hp', 4);
  const costo = 500 + 100 * u.rpg.nivel; // base + porNivel * nivel
  const res = rpg.reiniciarPuntos(u);
  assert.ok(res.exito, res.error);
  assert.strictEqual(res.costo, costo);
  assert.strictEqual(u.rpg.oro, 5000 - costo);
  assert.strictEqual(u.rpg.puntos, 4);
  assert.deepStrictEqual(u.rpg.atributos, { atk: 0, def: 0, hp: 0, ki: 0, vel: 0 });
});
check('reiniciar sin oro suficiente falla', () => {
  const u = nuevo();
  u.rpg.oro = 10;
  rpg.invertirPunto(u, 'def', 1);
  assert.ok(rpg.reiniciarPuntos(u).error);
  assert.strictEqual(u.rpg.oro, 10);
});

// --- 5. Regeneración por tiempo ----------------------------------------------
console.log('Regeneración:');
check('HP +1%/min y Ki +2%/min al consultar, con resto conservado', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.nivel = 10;
  const s = rpg.getStats(u);
  u.rpg.hp = 100;
  u.rpg.ki = 0;
  u.rpg.ultimaRegen = Date.now() - 10 * 60 * 1000;
  rpg.getStats(u);
  assert.strictEqual(u.rpg.hp, 100 + Math.floor(s.hp * 0.01 * 10));
  assert.strictEqual(u.rpg.ki, Math.floor(s.kiMax * 0.02 * 10));
  assert.ok(Date.now() - u.rpg.ultimaRegen < 60 * 1000, 'resto no conservado');
});
check('sin tiempo suficiente no regenera (no pierde minutos)', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  rpg.getStats(u);
  u.rpg.hp = 50;
  const antes = u.rpg.ultimaRegen;
  rpg.getStats(u); // instantánea
  assert.strictEqual(u.rpg.hp, 50);
  assert.strictEqual(u.rpg.ultimaRegen, antes);
});

// --- 6. #descansar ------------------------------------------------------------
console.log('Descanso:');
check('cura todo, cuesta oro y queda en cooldown', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  rpg.getStats(u);
  u.rpg.hp = 10;
  u.rpg.ki = 0;
  const antes = u.cash;
  const res = rpg.descansar(u);
  assert.ok(res.exito, res.error);
  const s = rpg.getStats(u);
  assert.strictEqual(u.rpg.hp, s.hp);
  assert.strictEqual(u.rpg.ki, s.kiMax);
  assert.strictEqual(u.cash, antes - rpg.DESCANSO.costo);
  assert.ok(rpg.descansar(u).error, 'segundo descanso debería fallar');
});
check('no se puede descansar en combate ni sin oro', () => {
  const u = nuevo();
  u.rpg.combate = { enemyKey: 'jabali' };
  assert.ok(rpg.descansar(u).error);
  u.rpg.combate = null;
  const pobre = nuevo({ cash: 10 });
  assert.ok(rpg.descansar(pobre).error);
});

// --- 7. Rangos de Cazador y examen --------------------------------------------
console.log('Rangos de Cazador:');
check('E -> D requiere nivel 10; S es el tope', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  assert.strictEqual(rpg.getRango(u).key, 'E');
  let info = rpg.examenActual(u);
  assert.strictEqual(info.siguiente.key, 'D');
  assert.strictEqual(info.requisito, 10);
  assert.strictEqual(info.puede, false);
  u.rpg.nivel = 10;
  assert.strictEqual(rpg.examenActual(u).puede, true);
  u.rpg.rango = 'S';
  assert.strictEqual(rpg.examenActual(u).siguiente, null);
});
check('victoria en el examen asciende de rango', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.nivel = 10;
  const info = rpg.examenActual(u);
  const enemy = rpg.startCombat(u, info.examenKey);
  assert.ok(enemy, 'examen no arrancó');
  assert.strictEqual(u.rpg.combate.examen, 'examen_d');
  u.rpg.combate.enemyHp = 1; // forzar victoria rápida
  const res = rpg.combatTurn(u, 'atacar');
  assert.strictEqual(res.tipo, 'victoria');
  assert.ok(res.resultado.includes('Examen aprobado'), 'sin texto de ascenso');
  assert.strictEqual(u.rpg.rango, 'D');
});
check('derrota en el examen NO asciende y conserva HP a 30%', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  u.rpg.nivel = 10;
  rpg.startCombat(u, 'examen_d');
  u.rpg.combate.hpJugador = 1; // el contraataque lo tumbará
  const res = rpg.combatTurn(u, 'atacar');
  assert.strictEqual(res.tipo, 'derrota');
  assert.ok(res.resultado.includes('No aprobaste'));
  assert.strictEqual(u.rpg.rango, 'E');
  const s = rpg.getStats(u);
  assert.strictEqual(u.rpg.hp, Math.ceil(s.hp * 0.3));
});

// --- 8. HP persistente post-combate --------------------------------------------
console.log('HP persistente:');
check('el combate arranca con el HP actual (no lleno)', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  rpg.getStats(u);
  u.rpg.hp = 40;
  rpg.startCombat(u, 'jabali');
  assert.strictEqual(u.rpg.combate.hpJugador, 40);
});
check('victoria persiste el daño sufrido en r.hp', () => {
  const u = nuevo();
  u.rpg.clase = 'guerrero';
  rpg.getStats(u);
  u.rpg.hp = 100;
  rpg.startCombat(u, 'jabali');
  let res = null;
  let i = 0;
  while (u.rpg.combate && i < 20) { res = rpg.combatTurn(u, 'atacar'); i++; }
  assert.strictEqual(res.tipo, 'victoria');
  assert.ok(u.rpg.hp < 100, `hp=${u.rpg.hp} no refleja daño`);
  assert.ok(u.rpg.hp >= 1);
});

// --- 9. Balance aproximado del examen D (informativo) ---------------------------
console.log('Balance examen D (guerrero nv10):');
check('winrate >= 50% en 20 intentos', () => {
  let victorias = 0;
  for (let n = 0; n < 20; n++) {
    const u = nuevo();
    u.rpg.clase = 'guerrero';
    u.rpg.nivel = 10;
    rpg.getStats(u);
    u.rpg.hp = u.rpg.hp; // lleno
    rpg.startCombat(u, 'examen_d');
    let i = 0;
    while (u.rpg.combate && i < 15) { rpg.combatTurn(u, 'atacar'); i++; }
    if (u.rpg.rango === 'D') victorias++;
  }
  assert.ok(victorias >= 10, `solo ${victorias}/20 victorias`);
  console.log(`      (winrate observado: ${victorias}/20)`);
});

// --- 10. Comandos y exports ------------------------------------------------------
console.log('Comandos y exports:');
check('exports nuevos presentes en la fachada', () => {
  for (const k of ['RANGOS', 'EXAMENES', 'DESCANSO', 'REGEN', 'ENTRENAMIENTO',
    'invertirPunto', 'reiniciarPuntos', 'descansar', 'getRango', 'examenActual',
    'ascenderRango', 'getGrowth', 'kiBaseDe', 'velBaseDe', 'getEnemy']) {
    assert.ok(k in rpg, `falta export ${k}`);
  }
});
check('index.js registra entrenar/reiniciar/descansar/examen (help + públicos)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  for (const cmd of ['entrenar', 'reiniciar', 'descansar', 'examen']) {
    assert.ok(new RegExp(`\\n  ${cmd}: \\{`).test(src), `comando ${cmd} no definido`);
    assert.ok(src.includes(`'${cmd}'`), `${cmd} fuera de help/públicos`);
  }
  assert.ok(!src.includes('u.rpg.nivel * 100'), 'fórmula vieja de EXP en #estado');
});

console.log(`\n${ok} comprobaciones OK${process.exitCode ? ' (HUBO FALLOS)' : ''}`);
