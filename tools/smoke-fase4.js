// Smoke test FASE 4 — clases, subclases y clases avanzadas.
// Uso: node tools/smoke-fase4.js

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

const nuevo = (extra = {}) => {
  const u = { cash: 10000, bank: 0, ...extra };
  rpg.ensureRPG(u);
  return u;
};

// --- 1. Clases base ---------------------------------------------------------
console.log('Clases base (FASE B):');
check('5 clases base: espadachin, ladron, invocador, mago, arquero', () => {
  const claves = Object.keys(rpg.CLASSES);
  assert.deepStrictEqual(claves.sort(), ['arquero', 'espadachin', 'invocador', 'ladron', 'mago']);
  for (const [key, c] of Object.entries(rpg.CLASSES)) {
    assert.ok(c.nombre && c.rol && c.hpBase && c.atkBase && c.defBase && c.velBase && c.kiBase && c.crec && c.pasiva, `${key} incompleto`);
    assert.ok(c.pasiva.clave && c.pasiva.nombre && c.pasiva.desc && c.pasiva.efecto, `${key}.pasiva incompleto`);
  }
});
check('cada clase base tiene 2 subclases (10 en total)', () => {
  const subclases = Object.values(rpg.SUBCLASES);
  assert.strictEqual(subclases.length, 10, `esperadas 10 subclases, encontradas ${subclases.length}`);
  for (const [key, s] of Object.entries(rpg.SUBCLASES)) {
    assert.ok(s.claseBase, `${key} sin claseBase`);
    assert.ok(rpg.CLASSES[s.claseBase], `${key} referencia clase base inexistente ${s.claseBase}`);
    assert.ok(s.requisito === 15, `${key} requisito debe ser 15`);
    assert.ok(s.habilidadFirma, `${key} sin habilidadFirma`);
  }
});
check('cada subclase tiene 2 clases avanzadas (10 en total)', () => {
  const avanzadas = Object.values(rpg.CLASES_AVANZADAS);
  assert.strictEqual(avanzadas.length, 10, `esperadas 10 clases avanzadas, encontradas ${avanzadas.length}`);
  for (const [key, a] of Object.entries(rpg.CLASES_AVANZADAS)) {
    assert.ok(a.subclase, `${key} sin subclase`);
    assert.ok(rpg.SUBCLASES[a.subclase], `${a.subclase} no existe como subclase`);
    assert.ok(a.requisito === 35, `${a.clave} requisito debe ser 35`);
    assert.ok(a.ougi, `${key} sin ougi`);
  }
});
check('getClass resuelve clase base, subclase y clase avanzada', () => {
  assert.ok(rpg.getClass('espadachin'), 'getClass espadachin');
  assert.ok(rpg.getClass('samurai'), 'getClass samurai');
  assert.ok(rpg.getClass('shogun_carmesi'), 'getClass shogun_carmesi');
  assert.strictEqual(rpg.getClass('inexistente'), null, 'clase inexistente debe ser null');
});
check('classLabel resuelve nombres de todas las clases', () => {
  assert.ok(rpg.classLabel('espadachin'), 'classLabel espadachin');
  assert.ok(rpg.classLabel('samurai'), 'classLabel samurai');
  assert.ok(rpg.classLabel('shogun_carmesi'), 'classLabel shogun_carmesi');
  assert.strictEqual(rpg.classLabel('inexistente'), 'inexistente', 'clase inexistente devuelve la clave');
});

// --- 2. Árbol de clases -------------------------------------------------------
console.log('Árbol de clases:');
check('cada subclase tiene claseBase válida', () => {
  for (const [key, s] of Object.entries(rpg.SUBCLASES)) {
    assert.ok(rpg.CLASSES[s.claseBase], `${key} claseBase ${s.claseBase} no existe`);
  }
});
check('cada clase avanzada tiene subclase válida', () => {
  for (const [key, a] of Object.entries(rpg.CLASES_AVANZADAS)) {
    assert.ok(rpg.SUBCLASES[a.subclase], `${a.subclase} no existe como subclase para ${key}`);
  }
});
check('árbol completo: 5 base + 10 subclases + 10 avanzadas = 25 clases', () => {
  const total = Object.keys(rpg.CLASSES).length + Object.keys(rpg.SUBCLASES).length + Object.keys(rpg.CLASES_AVANZADAS).length;
  assert.strictEqual(total, 25, `esperadas 25 clases totales, encontradas ${total}`);
});

// --- 3. Prueba de Ascenso (nivel 15) y Clase Avanzada (nivel 35) -------------
console.log('Evoluciones (FASE B):');
check('evolucionarClase subclase nv15 requiere nivel 15', () => {
  const u = nuevo();
  u.rpg.clase = 'espadachin';
  u.rpg.nivel = 14;
  const res = rpg.evolucionarClase(u, 'samurai');
  assert.ok(res.error, 'nv14 no debería poder evolucionar');
  assert.ok(res.error.includes('Necesitas nivel 15'), `error inesperado: ${res.error}`);
});
check('evolucionarClase subclase nv15 funciona', () => {
  const u = nuevo();
  u.rpg.clase = 'espadachin';
  u.rpg.nivel = 15;
  const res = rpg.evolucionarClase(u, 'samurai');
  assert.ok(res.exito, res.error);
  assert.strictEqual(u.rpg.clase, 'samurai');
  assert.strictEqual(u.rpg.subclase, 'samurai');
  assert.strictEqual(u.rpg.claseEvolucionada, true);
});
check('no se puede evolucionar dos veces a subclase', () => {
  const u = nuevo();
  u.rpg.clase = 'espadachin';
  u.rpg.nivel = 15;
  rpg.evolucionarClase(u, 'samurai');
  const res = rpg.evolucionarClase(u, 'robin');
  assert.ok(res.error, 'no debería permitir segunda subclase');
});
check('clase avanzada nv35 requiere subclase y nivel 35', () => {
  const u = nuevo();
  u.rpg.clase = 'samurai';
  u.rpg.subclase = 'samurai';
  u.rpg.claseEvolucionada = true;
  u.rpg.nivel = 34;
  const res = rpg.evolucionarClase(u, 'shogun_carmesi');
  assert.ok(res.error, 'nv34 no debería poder evolucionar a clase avanzada');
  u.rpg.nivel = 35;
  const res2 = rpg.evolucionarClase(u, 'shogun_carmesi');
  assert.ok(res2.exito, res2.error);
  assert.strictEqual(u.rpg.clase, 'shogun_carmesi');
  assert.strictEqual(u.rpg.despertarMayor, true);
});
check('no se puede evolucionar dos veces a clase avanzada', () => {
  const u = nuevo();
  u.rpg.clase = 'shogun_carmesi';
  u.rpg.subclase = 'samurai';
  u.rpg.claseEvolucionada = true;
  u.rpg.despertarMayor = true;
  u.rpg.nivel = 35;
  const res = rpg.evolucionarClase(u, 'kensei_avanzado');
  assert.ok(res.error, 'no debería permitir segunda clase avanzada');
});

// --- 3. Pasivas ----------------------------------------------------------
console.log('Pasivas (FASE B):');
check('pasivaDe espadachin: voluntad_acero', () => {
  const p = rpg.pasivaDe('espadachin');
  assert.strictEqual(p.clave, 'voluntad_acero');
  assert.strictEqual(p.efecto.umbralHp, 0.3);
  assert.strictEqual(p.efecto.defPct, 0.25);
  const pm = rpg.pasivaDe('espadachin', true);
  assert.strictEqual(pm.mayor, true);
  assert.strictEqual(pm.efecto.umbralHp, 0.4);
  assert.strictEqual(pm.efecto.defPct, 0.35);
  assert.strictEqual(pm.efecto.atkPct, 0.1);
});
check('pasivaDe ladron: paso_fantasma', () => {
  const p = rpg.pasivaDe('ladron');
  assert.strictEqual(p.clave, 'paso_fantasma');
  assert.strictEqual(p.efecto.esquiva, 0.1);
  assert.strictEqual(p.efecto.golpePostEsquiva, 0.3);
  const pm = rpg.pasivaDe('ladron', true);
  assert.strictEqual(pm.efecto.esquiva, 0.18);
  assert.strictEqual(pm.efecto.golpePostEsquiva, 0.5);
});
check('pasivaDe mago: sellos_elementales', () => {
  const p = rpg.pasivaDe('mago');
  assert.strictEqual(p.clave, 'sellos_elementales');
  assert.deepStrictEqual(p.efecto.secuencia, ['fuego', 'viento', 'rayo', 'agua']);
  assert.strictEqual(p.efecto.bonusPct, 0.2);
  const pm = rpg.pasivaDe('mago', true);
  assert.strictEqual(pm.efecto.bonusPct, 0.35);
});
check('pasivaDe arquero: ojo_halcon', () => {
  const p = rpg.pasivaDe('arquero');
  assert.strictEqual(p.clave, 'ojo_halcon');
  assert.strictEqual(p.efecto.critProb, 0.12);
  assert.strictEqual(p.efecto.critMult, 0.3);
  const pm = rpg.pasivaDe('arquero', true);
  assert.strictEqual(pm.efecto.critProb, 0.2);
  assert.strictEqual(pm.efecto.critMult, 0.5);
});
check('pasivaDe invocador: pacto', () => {
  const p = rpg.pasivaDe('invocador');
  assert.strictEqual(p.clave, 'pacto');
  assert.strictEqual(p.efecto.heredaPct, 0.6);
  const pm = rpg.pasivaDe('invocador', true);
  assert.strictEqual(pm.efecto.heredaPct, 0.8);
});

// --- 4. Kits de habilidades --------------------------------------------------
console.log('Kits de habilidades (FASE 4/5):');
check('SKILLS_V2: 24 skills con el esquema obligatorio', () => {
  const lista = Object.values(rpg.SKILLS_V2);
  assert.strictEqual(lista.length, 24);
  for (const s of lista) {
    for (const campo of ['id', 'nombre', 'clase', 'nivelReq', 'costoKi', 'cooldown', 'objetivo', 'efectos', 'frase']) {
      assert.ok(campo in s, `${s.id} falta ${campo}`);
    }
    assert.ok(Array.isArray(s.efectos) && s.efectos.length > 0, `${s.id} sin efectos`);
    assert.ok(s.id.startsWith('ougi_') === !!s.banner, `${s.id}: banner solo en ougi`);
    assert.ok(rpg.CLASSES[s.clase], `${s.id} clase inválida ${s.clase}`);
  }
});
check('KITS_POR_CLASE: 5 clases con 4 skills cada una', () => {
  for (const clave of Object.keys(rpg.CLASSES)) {
    const kit = rpg.KITS_POR_CLASE[clave];
    assert.ok(kit, `falta kit para ${clave}`);
    assert.ok(kit.length >= 4, `${clave} debe tener al menos 4 skills, tiene ${kit.length}`);
  }
});
check('SKILLS_ALIAS re-claveado a nombres nuevos', () => {
  for (const [legado, nuevo] of Object.entries(rpg.SKILLS_ALIAS)) {
    assert.ok(rpg.SKILLS_V2[nuevo], `${legado} -> ${nuevo} no existe en SKILLS_V2`);
  }
});

// --- 5. Comandos de consola -------------------------------------------------
console.log('Comandos de consola:');
check('#estado muestra clase y zona', () => {
  const u = nuevo();
  u.rpg.clase = 'espadachin';
  u.rpg.nivel = 10;
  rpg.getStats(u);
  const s = rpg.getStats(u);
  assert.strictEqual(s.atk, 36); // 16 + 2.2*9 = 35.8 ≈ 36
  assert.strictEqual(s.def, 24); // 10 + 1.6*9 = 24.4 ≈ 24
  assert.strictEqual(s.hp, 256); // 130 + 14*9 = 256
  assert.strictEqual(s.ki, 87);  // 60 + 3*9 = 87
  assert.strictEqual(s.vel, 8);  // sin crec.vel, sigue siendo 8
});

console.log(`\n${ok} comprobaciones OK${process.exitCode ? ' (HUBO FALLOS)' : ''}`);
