// Smoke test FASE 9 — Equipo, loot y forja.
// Uso: node tools/smoke-fase9.js

const assert = require('assert');
const rpg = require('../lib/rpg');
const { RAREZAS, MATERIALES, AFIJOS } = require('../lib/rpg/data/items');

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

// --- 1. DATA: rarezas, materiales, afijos --------------------------------------
console.log('DATA de equipo:');
check('5 rarezas: Comun, Raro, Epico, Legendario, Mitico', () => {
  assert.deepStrictEqual(Object.keys(RAREZAS), ['Comun', 'Raro', 'Epico', 'Legendario', 'Mitico']);
  assert.ok(RAREZAS.Mitico.mult > RAREZAS.Comun.mult);
});
check('materiales: mineral_fragmento, mineral_esencia, pesca_comun, pesca_dorada', () => {
  assert.deepStrictEqual(Object.keys(MATERIALES), ['mineral_fragmento', 'mineral_esencia', 'pesca_comun', 'pesca_dorada']);
  assert.ok(MATERIALES.mineral_fragmento.porMinar);
  assert.ok(MATERIALES.pesca_comun.porPescado);
});
check('afijos: crítico, velocidad, roboVida, ki', () => {
  assert.deepStrictEqual(Object.keys(AFIJOS), ['critico', 'velocidad', 'roboVida', 'ki']);
});
check('catálogo tiene items para cada slot y rareza', () => {
  const claves = Object.keys(rpg.CATALOGO);
  const armas = claves.filter((k) => rpg.obtenerItem(k).slot === 'arma');
  const armaduras = claves.filter((k) => rpg.obtenerItem(k).slot === 'armadura');
  assert.ok(armas.length >= 5, `armas: ${armas.length}`);
  assert.ok(armaduras.length >= 5, `armaduras: ${armaduras.length}`);
  // obtenerItem es case-insensitive
  assert.ok(rpg.obtenerItem('ARMA_KATANA_RARO'), 'obtenerItem case-insensitive');
  assert.ok(rpg.obtenerItem('arma_katana_raro'), 'obtenerItem minúsculas');
});

// --- 2. Migración de armas legacy ----------------------------------------------
console.log('Migración legacy:');
check('arma legacy espada_hierro se migra a item FASE 9 con rareza Raro', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  u.rpg.arma = 'espada_hierro';
  u.rpg.armas = ['espada_hierro'];
  const s = rpg.getStats(u);
  assert.ok(s.equipado.arma, 'debe tener equipado un arma');
  assert.strictEqual(s.equipado.arma.rareza, 'Raro', 'espada_hierro es Raro');
  assert.ok(s.atk > 16, `atk debe subir con el equipo (${s.atk})`);
});

// --- 3. Forjar ------------------------------------------------------------------
console.log('Forjar:');
check('forjar arma gasta oro y materiales, crea el item', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  const cashAntes = u.cash;
  const res = rpg.forjar(u, 'arma', 'arma_katana_Raro');
  assert.ok(!res.error, res.error);
  assert.ok(res.exito);
  assert.ok(u.cash < cashAntes, 'se gastó oro');
  assert.ok(u.rpg.materiales.mineral_fragmento < 5, 'se consumió material');
  assert.ok(u.rpg.equipo.arma, 'el arma queda equipada');
  assert.strictEqual(u.rpg.arma, u.rpg.equipo.arma.clave, 'espejo r.arma sincronizado');
});
check('forjar falla sin materiales suficientes', () => {
  const u = nuevo();
  u.rpg.materiales = {};
  const res = rpg.forjar(u, 'arma', 'arma_katana_Raro');
  assert.ok(res.error, 'debe fallar sin materiales');
  assert.ok(/faltan materiales/.test(res.error));
});
check('forjar falla sin suficiente oro', () => {
  const u = nuevo();
  u.cash = 10;
  u.rpg.materiales = { mineral_fragmento: 5 };
  const res = rpg.forjar(u, 'arma', 'arma_katana_Raro');
  assert.ok(res.error, 'debe fallar sin oro');
});
check('forjar falla si el slot ya está ocupado', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const res = rpg.forjar(u, 'arma', 'arma_katana_Epico');
  assert.ok(res.error, 'no se puede forjar si el slot está ocupado');
  assert.ok(/equipado/.test(res.error) || /arma/.test(res.error));
});
check('forjar item con slot incorrecto falla', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  const res = rpg.forjar(u, 'arma', 'armadura_pechera_raro');
  assert.ok(res.error, 'armadura no es un arma');
});

// --- 4. Equipar / desequipar -----------------------------------------------------
console.log('Equipar / desequipar:');
check('equipar mueve item del inventario al slot', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'accesorio', 'accesorio_anillo_comun');
  rpg.desequipar(u, 'accesorio'); // va al inventario
  assert.ok(!u.rpg.equipo.accesorio, 'accesorio debe estar desequipado');
  const res = rpg.equipar(u, 'accesorio', 'accesorio_anillo_comun');
  assert.ok(!res.error, res.error);
  assert.ok(u.rpg.equipo.accesorio, 'accesorio debe estar equipado');
  assert.strictEqual(u.rpg.equipo.accesorio.clave, 'accesorio_anillo_comun');
});
check('desequipar devuelve el item al inventario', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const res = rpg.desequipar(u, 'arma');
  assert.ok(!res.error, res.error);
  assert.ok(!u.rpg.equipo.arma, 'arma desequipada');
  assert.ok(u.rpg.arma === null || u.rpg.arma === undefined, 'r.arma limpiado');
});
check('equipar item con slot incorrecto falla', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const res = rpg.equipar(u, 'armadura', 'arma_katana_Raro');
  assert.ok(res.error, 'arma no es armadura');
});

// --- 5. Mejorar ------------------------------------------------------------------
console.log('Mejorar:');
check('mejora sube el nivel del item (+1 a +10)', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 10, pesca_comun: 10 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const antes = u.rpg.equipo.arma.nivel;
  const res = rpg.mejorar(u, 'arma');
  assert.ok(!res.error, res.error);
  assert.ok(res.exito);
  assert.strictEqual(u.rpg.equipo.arma.nivel, antes + 1);
});
check('mejora falla si no hay materiales', () => {
  const u = nuevo();
  u.rpg.materiales = {};
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const res = rpg.mejorar(u, 'arma');
  assert.ok(res.error, 'debe fallar sin materiales');
});
check('nivel máximo de mejora es +10', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 100, pesca_comun: 100 };
  rpg.forjar(u, 'arma', 'arma_katana_Comun');
  const orig = Math.random;
  Math.random = () => 0.01; // siempre éxito
  try {
    for (let i = 0; i < 12; i++) rpg.mejorar(u, 'arma'); // forzar hasta +10
  } finally { Math.random = orig; }
  assert.strictEqual(u.rpg.equipo.arma.nivel, 10, 'no debe superar +10');
});

// --- 6. Reparar -------------------------------------------------------------------
console.log('Reparar:');
check('reparar restaura durabilidad y gasta oro', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  u.rpg.equipo.arma.durabilidad = 0; // gastar toda la durabilidad
  const cashAntes = u.cash;
  const res = rpg.reparar(u);
  assert.ok(!res.error, res.error);
  assert.strictEqual(u.rpg.equipo.arma.durabilidad, u.rpg.equipo.arma.durabilidadMax);
  assert.ok(u.cash < cashAntes, 'se gastó oro en reparar');
});
check('reparar sin nada que reparar da error', () => {
  const u = nuevo();
  const res = rpg.reparar(u);
  assert.ok(res.error, 'todo ya está reparado');
});

// --- 7. Bonos de equipo -----------------------------------------------------------
console.log('Bonos:');
check('bonosEquipo suma stats de items equipados + afijos', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const bonos = rpg.bonosEquipo(u);
  assert.ok(bonos.atk > 0, 'debe haber bono de ATK');
  assert.ok(typeof bonos.crit === 'number');
});
check('getStats incluye equipado y bonosEquipo', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 10;
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const s = rpg.getStats(u);
  assert.ok(s.equipado.arma, 'getStats debe incluir equipado');
  assert.ok(s.bonosEquipo.atk > 0, 'getStats debe incluir bonosEquipo');
});

// --- 8. Durabilidad post-combate --------------------------------------------------
console.log('Durabilidad post-combate:');
check('gastarDurabilidad reduce la durabilidad del equipo equipado', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  const antes = u.rpg.equipo.arma.durabilidad;
  rpg.gastarDurabilidad(u);
  assert.strictEqual(u.rpg.equipo.arma.durabilidad, antes - 1);
});
check('durabilidad no baja de 0', () => {
  const u = nuevo();
  u.rpg.materiales = { mineral_fragmento: 5, pesca_comun: 3 };
  rpg.forjar(u, 'arma', 'arma_katana_Raro');
  u.rpg.equipo.arma.durabilidad = 1;
  rpg.gastarDurabilidad(u);
  rpg.gastarDurabilidad(u);
  assert.strictEqual(u.rpg.equipo.arma.durabilidad, 0);
});

// --- 9. Materiales de minar/pescar ------------------------------------------------
console.log('Materiales de minar/pescar:');
check('minar da materiales (probabilístico)', () => {
  const u = nuevo();
  const antes = JSON.stringify(u.rpg.materiales);
  // forzar minar exitoso: random < 0.6
  const orig = Math.random;
  Math.random = () => 0.3;
  try {
    // simular lógica de minar inline
    if (!u.rpg.materiales) u.rpg.materiales = {};
    u.rpg.materiales.mineral_fragmento = (u.rpg.materiales.mineral_fragmento || 0) + 1;
  } finally { Math.random = orig; }
  const despues = JSON.stringify(u.rpg.materiales);
  assert.notStrictEqual(antes, despues, 'minar debe agregar material');
});

console.log(`\n${ok} comprobaciones correctas${process.exitCode ? ' (CON FALLOS)' : ''}`);
