// Smoke test FASE 10 — Compañeros y vínculos.
// Uso: node tools/smoke-fase10.js

const assert = require('assert');
const rpg = require('../lib/rpg');
const { COMPANIONES, ESPIRITUS, VINCULO } = require('../lib/rpg/data/companions');
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
  const u = { cash: 50000, bank: 0, ...extra };
  rpg.ensureRPG(u);
  return u;
};

// --- 1. DATA ------------------------------------------------------------------
console.log('DATA de compañeros:');
check('5 compañeros y 3 espíritus definidos', () => {
  assert.strictEqual(Object.keys(COMPANIONES).length, 5);
  assert.strictEqual(Object.keys(ESPIRITUS).length, 3);
});
check('cada compañero tiene rol, costo, requisitoNivel, arcoDesbloqueo, statsBase, banner', () => {
  for (const [key, c] of Object.entries(COMPANIONES)) {
    assert.ok(c.nombre && c.rol && typeof c.costo === 'number' && typeof c.requisitoNivel === 'number');
    assert.ok(c.arcoDesbloqueo);
    assert.ok(c.statsBase && typeof c.statsBase.atk === 'number');
    assert.ok(c.banner);
    assert.ok(['tanque', 'curandero', 'daño'].includes(c.rol));
  }
  for (const [key, e] of Object.entries(ESPIRITUS)) {
    assert.ok(e.nombre && e.rol && e.banner);
  }
});
check('reglas de vínculo: max 5, ataque combinado cada 4 turnos, min vínculo 2', () => {
  assert.strictEqual(VINCULO.max, 5);
  assert.strictEqual(VINCULO.ataqueCombinadoCadaTurnos, 4);
  assert.strictEqual(VINCULO.ataqueCombinadoMinVinculo, 2);
});

// --- 2. Reclutar --------------------------------------------------------------
console.log('Reclutar:');
check('reclutar zorro (compañero) requiere nivel 10 y arco sakura', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  const res = rpg.reclutarCompañero(u, 'zorro');
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.exito, true);
  assert.strictEqual(res.costo, COMPANIONES.zorro.costo);
  assert.ok(u.cash < 50000);
  assert.ok(u.rpg.compañeros.reclutas.includes('zorro'));
});
check('reclutar falla sin nivel suficiente', () => {
  const u = nuevo();
  u.rpg.nivel = 5;
  const res = rpg.reclutarCompañero(u, 'zorro');
  assert.ok(res.error && /nivel 10/.test(res.error));
});
check('reclutar falla sin arco desbloqueado', () => {
  const u = nuevo();
  u.rpg.nivel = 50;
  u.rpg.arco = { id: 'sakura', capitulo: 0 }; // zorro requiere sakura (ok), oni requiere trueno (no)
  const res = rpg.reclutarCompañero(u, 'oni');
  assert.ok(res.error && /arco/.test(res.error));
});
check('reclutar falla sin suficiente oro', () => {
  const u = nuevo();
  u.cash = 100;
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  const res = rpg.reclutarCompañero(u, 'zorro');
  assert.ok(res.error && /oro/.test(res.error));
});
check('reclutar falla si ya está reclutado', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  rpg.reclutarCompañero(u, 'zorro');
  const res = rpg.reclutarCompañero(u, 'zorro');
  assert.ok(res.error && /Ya reclutas/.test(res.error));
});
check('reclutar espíritu (shikigami) funciona', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  const res = rpg.reclutarCompañero(u, 'kodama', 'espíritu');
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.compañeros.reclutas.includes('kodama'), true);
});

// --- 3. Activar / desactivar --------------------------------------------------
console.log('Activar / desactivar:');
check('activar compañero reclutado', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  rpg.reclutarCompañero(u, 'zorro');
  const res = rpg.activarCompañero(u, 'zorro');
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.compañeros.activo, 'zorro');
  assert.ok(/activo/.test(res.texto));
});
check('activar falla si no reclutado', () => {
  const u = nuevo();
  const res = rpg.activarCompañero(u, 'zorro');
  assert.ok(res.error);
});
check('desactivar compañero activo', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  rpg.reclutarCompañero(u, 'zorro');
  rpg.activarCompañero(u, 'zorro');
  const res = rpg.desactivarCompañero(u);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.compañeros.activo, null);
});
check('compañeroActivo devuelve datos del activo', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  rpg.reclutarCompañero(u, 'zorro');
  rpg.activarCompañero(u, 'zorro');
  const ca = rpg.compañeroActivo(u);
  assert.ok(ca);
  assert.strictEqual(ca.clave, 'zorro');
  assert.strictEqual(ca.nombre, '🦊 Zorro de las Sombras');
  assert.strictEqual(ca.rol, 'daño');
});
check('compañeroActivo es null si no hay activo', () => {
  const u = nuevo();
  assert.strictEqual(rpg.compañeroActivo(u), null);
});

// --- 4. Vínculo ---------------------------------------------------------------
console.log('Vínculo:');
check('sumarPuntoVínculo sube nivel y puntos', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], vínculos: { zorro: { nivel: 1, puntos: 0 } } };
  const res = rpg.sumarPuntoVínculo(u, 'zorro');
  assert.strictEqual(res.subió, false);
  assert.strictEqual(res.puntos, VINCULO.puntosPorCombate);
  assert.strictEqual(res.nivel, 1);
});
check('vínculo sube de nivel al acumular puntos', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], vínculos: { zorro: { nivel: 1, puntos: 0 } } };
  for (let i = 0; i < 6; i++) rpg.sumarPuntoVínculo(u, 'zorro'); // 6*2=12 >= 10*1 -> sube a nv2
  const v = u.rpg.compañeros.vínculos.zorro;
  assert.strictEqual(v.nivel, 2);
  assert.ok(v.puntos < 10);
});
check('vínculo no supera el max 5', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], vínculos: { zorro: { nivel: 5, puntos: 0 } } };
  const res = rpg.sumarPuntoVínculo(u, 'zorro');
  assert.strictEqual(res.subió, false);
  assert.strictEqual(res.nivel, 5);
});

// --- 5. Ataque combinado ------------------------------------------------------
console.log('Ataque combinado:');
check('ataqueCombinado es null sin compañero activo', () => {
  const u = nuevo();
  assert.strictEqual(rpg.ataqueCombinado(u, 4), null);
});
check('ataqueCombinado es null si vínculo < 2', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], tipoActivo: 'compañero', vínculos: { zorro: { nivel: 1, puntos: 0 } } };
  assert.strictEqual(rpg.ataqueCombinado(u, 4), null);
});
check('ataqueCombinado se activa cada 4 turnos con vínculo ≥ 2', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], tipoActivo: 'compañero', vínculos: { zorro: { nivel: 2, puntos: 0 } } };
  const res = rpg.ataqueCombinado(u, 4);
  assert.ok(res);
  assert.strictEqual(res.daño > 0, true);
  assert.ok(res.banner);
  assert.strictEqual(res.rol, 'daño');
});
check('ataqueCombinado no se activa en turnos no múltiplo de 4', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], tipoActivo: 'compañero', vínculos: { zorro: { nivel: 2, puntos: 0 } } };
  assert.strictEqual(rpg.ataqueCombinado(u, 5), null);
  assert.strictEqual(rpg.ataqueCombinado(u, 3), null);
});
check('curandero cura al jugador en aplicarCombateCompañero', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  u.rpg.hp = 50;
  rpg.getStats(u);
  const hpMax = rpg.getStats(u).hp;
  u.rpg.compañeros = { activo: 'grulla', reclutas: ['grulla'], tipoActivo: 'compañero', vínculos: { grulla: { nivel: 2, puntos: 0 } } };
  const res = rpg.aplicarCombateCompañero(u, 4);
  assert.ok(res && res.cura > 0);
  assert.ok(u.rpg.hp > 50);
  assert.ok(u.rpg.hp <= hpMax);
});
check('daño combinado de tanque es menor (0.5x)', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'lince', reclutas: ['lince'], tipoActivo: 'compañero', vínculos: { lince: { nivel: 2, puntos: 0 } } };
  const res = rpg.ataqueCombinado(u, 4);
  const esperado = Math.max(1, Math.round(COMPANIONES.lince.statsBase.atk * 0.5));
  assert.strictEqual(res.daño, esperado);
});

// --- 6. listar ----------------------------------------------------------------
console.log('Listar:');
check('listarCompañeros muestra los reclutados y activos', () => {
  const u = nuevo();
  u.rpg.nivel = 10;
  u.rpg.arco = { id: 'sakura', capitulo: 0 };
  rpg.reclutarCompañero(u, 'zorro');
  rpg.activarCompañero(u, 'zorro');
  const txt = rpg.listarCompañeros(u);
  assert.ok(/Compañeros y espíritus/.test(txt));
  assert.ok(/Zorro de las Sombras/.test(txt));
});

// --- 7. Integración: post-combate sube vínculo --------------------------------
console.log('Integración post-combate:');
check('sumarPuntoVínculo se puede llamar tras victoria (simulado)', () => {
  const u = nuevo();
  u.rpg.compañeros = { activo: 'zorro', reclutas: ['zorro'], tipoActivo: 'compañero', vínculos: { zorro: { nivel: 1, puntos: 0 } } };
  const antes = u.rpg.compañeros.vínculos.zorro.puntos;
  const res = rpg.sumarPuntoVínculo(u, 'zorro');
  assert.ok(res.puntos > antes);
});

console.log(`\n${ok} comprobaciones correctas${process.exitCode ? ' (CON FALLOS)' : ''}`);
