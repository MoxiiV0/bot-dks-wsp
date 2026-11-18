// Smoke test FASE 2 — esquema v2 y migración.
// Uso: node tools/smoke-fase2.js

const assert = require('assert');
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

// --- 1. Usuario nuevo ---
console.log('Usuario nuevo:');
const nuevo = { cash: 100, bank: 0 };
rpg.ensureRPG(nuevo);
const rn = nuevo.rpg;
check('v = 2', () => assert.strictEqual(rn.v, 2));
check('campos v2 presentes', () => {
  for (const k of ['evolucion', 'hp', 'ki', 'kiMax', 'despertar', 'puntos', 'atributos', 'equipo',
    'inventario', 'habilidades', 'cooldowns', 'estados', 'portal', 'compañeros', 'vinculos',
    'rival', 'arco', 'rango', 'titulos', 'stats', 'ultimaRegen', 'inconscienteHasta']) {
    assert.ok(k in rn, `falta ${k}`);
  }
});
check('ki lleno (100)', () => assert.strictEqual(rn.ki, 100));
check('sin mana residual', () => assert.strictEqual(rn.mana, undefined));
check('stats anidados', () => assert.deepStrictEqual(rn.stats, { kills: 0, pisos: 0, muertes: 0, duelos: 0 }));
check('equipo.arma es null para usuario nuevo (sin arma por defecto)', () => {
  assert.strictEqual(rn.equipo.arma, null);
  assert.strictEqual(rn.arma, null);
});
check('titulos === titulosDesbloqueados', () => assert.strictEqual(rn.titulos, rn.titulosDesbloqueados));
check('cooldowns === cd (helper legacy)', () => assert.strictEqual(rn.cooldowns, rn.cd));
check('hp llena (0 sin clase -> se llena al tener clase)', () => {
  nuevo.rpg.clase = 'espadachin';
  const s = rpg.getStats(nuevo);
  assert.strictEqual(nuevo.rpg.hp, s.hp);
});

// --- 2. Usuario legado v1 ---
console.log('Usuario legado v1:');
const legacy = { cash: 5000, bank: 0 };
legacy.rpg = {
  clase: 'guerrero', arma: 'espada_acero', armas: ['nada', 'espada_acero'],
  nivel: 12, exp: 45, // v1: 45/1200 (3.75%)
  oro: 900, pescado: 3, minerales: 1,
  mana: 37, manaMax: 100,
  entrenamiento: { atk: 5, def: 3, hp: 2 },
  statsEnemigosDerrotados: 12, statsPisos: 8,
  statsTrabajos: 10, statsCrimenes: 5, maxBank: 120000,
  titulosDesbloqueados: ['trabajador'], tituloEquipado: 'trabajador',
  misiones: {}, misionesCompletadas: [], combate: null,
};
const antes = JSON.parse(JSON.stringify(legacy.rpg));
const res = rpg.migrate(legacy, { dryRun: true });
check('dry-run no muta (v sigue 1)', () => assert.strictEqual(legacy.rpg.v, undefined));
check('dry-run reporta anadidas', () => assert.ok(res.anadidas.includes('atributos') && res.anadidas.includes('stats')));
check('dry-run reporta modificadas', () => assert.ok(res.modificadas.includes('exp')));

rpg.ensureRPG(legacy);
const rl = legacy.rpg;
check('migrado a v2', () => assert.strictEqual(rl.v, 2));
check('mana convertido a ki (barra llena, máximo por clase)', () => {
  assert.strictEqual(rl.mana, undefined);
  // FASE B: 'guerrero' se renombró a 'espadachin' (kiBase 60, crec.ki 3)
  assert.strictEqual(rl.clase, 'espadachin');
  assert.strictEqual(rl.kiMax, 60 + 3 * 11); // kensei nivel 12
  assert.strictEqual(rl.ki, rl.kiMax);
});
check('exp escalada sin bajar de nivel (3.75% de la curva nueva)', () => {
  const max = rpg.expToNext(12); // ceil(40*12^1.65) = 2414
  assert.strictEqual(max, 2414);
  assert.ok(rl.nivel === 12, 'nivel conservado');
  assert.ok(rl.exp >= 0 && rl.exp < max, `exp ${rl.exp} fuera de rango`);
  const esperado = Math.floor((45 / 1200) * max); // 90
  assert.strictEqual(rl.exp, esperado);
});
check('entrenamiento -> atributos', () => assert.deepStrictEqual(rl.atributos, { atk: 5, def: 3, hp: 2, ki: 0, vel: 0 }));
check('stats anidados desde planos', () => assert.deepStrictEqual(rl.stats, { kills: 12, pisos: 8, muertes: 0, duelos: 0 }));
check('espejo legacy (flat = stats)', () => {
  assert.strictEqual(rl.statsEnemigosDerrotados, 12);
  assert.strictEqual(rl.statsPisos, 8);
});
check('hp llena (120 base + título)', () => assert.ok(rl.hp >= 120, `hp=${rl.hp}`));
check('títulos conservados', () => {
  assert.deepStrictEqual(rl.titulosDesbloqueados, ['trabajador']);
  assert.strictEqual(rl.tituloEquipado, 'trabajador');
});
check('equipo.arma es un item FASE 9 (migración de espada_acero)', () => {
  assert.ok(rl.equipo.arma && rl.equipo.arma.clave, 'debe tener arma equipada');
  assert.strictEqual(rl.equipo.arma.slot, 'arma');
  assert.strictEqual(rl.equipo.arma.rareza, 'Epico', 'espada_acero es Épico');
});
check('trabajos/crimenes/maxBank intactos (siguen planos)', () => {
  assert.strictEqual(rl.statsTrabajos, 10);
  assert.strictEqual(rl.statsCrimenes, 5);
  assert.strictEqual(rl.maxBank, 120000);
});

// --- 3. Idempotencia ---
console.log('Idempotencia:');
const snap = JSON.stringify(legacy.rpg);
rpg.ensureRPG(legacy);
rpg.ensureRPG(legacy);
check('segunda y tercera llamada no cambian nada', () => assert.strictEqual(JSON.stringify(legacy.rpg), snap));
check('migrate() sobre v2 dice ya-v2', () => assert.strictEqual(rpg.migrate(legacy).razon, 'ya-v2'));

// --- 4. Curva / addExp ---
console.log('Curva de EXP:');
check('expToNext(1)=40, expToNext(2)=126', () => {
  assert.strictEqual(rpg.expToNext(1), 40);
  assert.strictEqual(rpg.expToNext(2), 126);
});
check('addExp sube con la curva nueva', () => {
  const u = { cash: 0, bank: 0 };
  rpg.ensureRPG(u);
  const txt = rpg.addExp(u, 40);
  assert.ok(txt && u.rpg.nivel === 2, `nivel=${u.rpg.nivel}`);
  assert.strictEqual(u.rpg.exp, 0);
});
check('MAX_LEVEL = 60', () => assert.strictEqual(rpg.MAX_LEVEL, 60));

// --- 5. Mapeo perezoso FASE 4 (activo: los destinos existen en data/) ---
console.log('Mapeo perezoso de clases (FASE 4):');
const u4 = { cash: 0, bank: 0 };
rpg.ensureRPG(u4);
u4.rpg.clase = 'guerrero';
rpg.ensureRPG(u4);
check('guerrero -> espadachin (activo)', () => assert.strictEqual(u4.rpg.clase, 'espadachin'));
u4.rpg.clase = 'invocador';
rpg.ensureRPG(u4);
check('invocador -> invocador', () => assert.strictEqual(u4.rpg.clase, 'invocador'));
u4.rpg.clase = 'caballero';
rpg.ensureRPG(u4);
check('evolución vieja caballero -> samurai', () => assert.strictEqual(u4.rpg.clase, 'samurai'));
// Sin destino en data: no rompe ni renombra
const espadachinTmp = rpg.CLASSES.espadachin;
delete rpg.CLASSES.espadachin;
u4.rpg.clase = 'guerrero';
rpg.ensureRPG(u4);
check('sin destino en data: no rompe ni renombra', () => assert.strictEqual(u4.rpg.clase, 'guerrero'));
rpg.CLASSES.espadachin = espadachinTmp;

// --- 6. Combate escribe stats v2 ---
console.log('Combate y stats:');
const uc = { cash: 1000, bank: 0 };
rpg.ensureRPG(uc);
uc.rpg.clase = 'espadachin';
rpg.startCombat(uc, 'jabali');
let resC = null;
let i = 0;
while (uc.rpg.combate && i < 20) { resC = rpg.combatTurn(uc, 'atacar'); i++; }
check('victoria registra stats.kills + espejo', () => {
  assert.strictEqual(resC.tipo, 'victoria');
  assert.strictEqual(uc.rpg.stats.kills, 1);
  assert.strictEqual(uc.rpg.statsEnemigosDerrotados, 1);
});

// --- 7. Helper legacy rcd ---
console.log('Cooldowns:');
check('rpgSet/rpgLeft legado funciona con la referencia compartida', () => {
  rn.cd['pescar'] = Date.now();
  assert.strictEqual(rn.cooldowns['pescar'], rn.cd['pescar']);
});

console.log(`\n${ok} comprobaciones OK${process.exitCode ? ' (HUBO FALLOS)' : ''}`);
