// Smoke test FASE 4 — clases renombradas estilo anime, evoluciones y pasivas.
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

// --- 1. Clases y ramas ---------------------------------------------------------
console.log('Clases anime:');
check('6 clases: 4 primarias + 2 secundarias', () => {
  assert.deepStrictEqual(Object.keys(rpg.CLASSES), ['kensei', 'onmyoji', 'hayate', 'shinobi']);
  assert.deepStrictEqual(Object.keys(rpg.NUEVAS_CLASES), ['shikigami', 'medium_yurei']);
});
check('cada clase tiene 2 ramas de evolución (12 en total)', () => {
  let total = 0;
  for (const [key, ramas] of Object.entries(rpg.EVOLUCIONES_CLASE)) {
    assert.strictEqual(ramas.length, 2, `${key} no tiene 2 ramas`);
    assert.ok(rpg.CLASSES[key] || rpg.NUEVAS_CLASES[key], `${key} no es clase real`);
    for (const rama of ramas) {
      assert.ok(rpg.CLASES_EVOLUCION[rama.nombre], `falta destino ${rama.nombre}`);
      assert.strictEqual(rama.requisito, 15);
      total++;
    }
  }
  assert.strictEqual(total, 12);
});
check('CLASE_BASE cubre las 12 ramas y getClass las resuelve', () => {
  for (const [rama, base] of Object.entries(rpg.CLASE_BASE)) {
    assert.ok(rpg.CLASES_EVOLUCION[rama], `rama desconocida ${rama}`);
    assert.ok(rpg.CLASSES[base] || rpg.NUEVAS_CLASES[base], `base desconocida ${base}`);
    assert.strictEqual(rpg.baseClassKey(rama), base);
    assert.ok(rpg.getClass(rama), `getClass no resuelve ${rama}`);
  }
});
check('classLabel resuelve ramas (sombra_carmesi con nombre y emoji)', () => {
  assert.strictEqual(rpg.classLabel('sombra_carmesi'), '🗡️ Sombra Carmesí');
  assert.strictEqual(rpg.classLabel('guerrero'), 'Sin clase'); // clase vieja ya no existe
});

// --- 2. Prueba de Ascenso y Despertar Mayor ------------------------------------
console.log('Evoluciones:');
check('Prueba de Ascenso: bloquea bajo nv15 y evoluciona a la rama', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  u.rpg.nivel = 14;
  assert.ok(rpg.evolucionarClase(u, 'shogun_carmesi').error, 'nv14 no debería evolucionar');
  assert.ok(rpg.evolucionarClase(u, 'hoja_celestial').error, 'rama ajena debería fallar');
  u.rpg.nivel = 15;
  const res = rpg.evolucionarClase(u, 'shogun_carmesi');
  assert.ok(res.exito, res.error);
  assert.strictEqual(u.rpg.clase, 'shogun_carmesi');
  assert.strictEqual(u.rpg.claseEvolucionada, true);
  assert.ok(rpg.evolucionarClase(u, 'hoja_celestial').error, 'doble evolución debería fallar');
});
check('la rama hereda stats de combate (crecimiento y ki de kensei)', () => {
  const u = nuevo();
  u.rpg.clase = 'shogun_carmesi';
  u.rpg.nivel = 10;
  const s = rpg.getStats(u);
  // hpBase 165 + crec kensei 14*9; ki heredado 60 + 3*9
  assert.strictEqual(s.hp, Math.round(165 + 14 * 9));
  assert.strictEqual(s.kiMax, Math.round(60 + 3 * 9));
});
check('Despertar Mayor: requiere evolución + nivel 35', () => {
  const u = nuevo();
  u.rpg.clase = 'kensei';
  assert.ok(rpg.evolucionarClase(u, 'mayor').error, 'sin evolución debería fallar');
  u.rpg.nivel = 15;
  rpg.evolucionarClase(u, 'shogun_carmesi');
  u.rpg.nivel = 34;
  assert.ok(rpg.evolucionarClase(u, 'mayor').error, 'nv34 debería fallar');
  u.rpg.nivel = 35;
  const res = rpg.evolucionarClase(u, 'mayor');
  assert.ok(res.exito, res.error);
  assert.strictEqual(u.rpg.despertarMayor, true);
  assert.ok(rpg.evolucionarClase(u, 'mayor').error, 'doble despertar debería fallar');
});

// --- 3. Pasivas -----------------------------------------------------------------
console.log('Pasivas:');
check('pasivaDe: efecto base y efecto mayor (kensei)', () => {
  const p = rpg.pasivaDe('kensei');
  assert.strictEqual(p.efecto.umbralHp, 0.3);
  assert.strictEqual(p.efecto.defPct, 0.25);
  const pm = rpg.pasivaDe('kensei', true);
  assert.strictEqual(pm.mayor, true);
  assert.strictEqual(pm.efecto.umbralHp, 0.4);
  assert.strictEqual(rpg.pasivaDe('hoja_celestial').clave, 'voluntad_acero'); // rama hereda
  assert.strictEqual(rpg.pasivaDe('medium_yurei').efecto.roboHpPct, 0.1);
});
check('pasiva Kensei: +DEF bajo 30% de HP reduce el daño recibido', () => {
  const orig = Math.random;
  Math.random = () => 0.5; // determinista: sin críticos ni cargas de IA
  const correr = (hpPct) => {
    const u = nuevo();
    u.rpg.clase = 'kensei';
    rpg.getStats(u);
    rpg.startCombat(u, 'dragon'); // atk 35: el daño no se satura en DEF
    const c = u.rpg.combate;
    c.enemyHp = 999999; // sin victoria en el turno 1
    // HP controlado para medir solo la reducción de DEF (sin muerte accidental)
    c.hpMaxJugador = 1000;
    c.hpJugador = hpPct === 1 ? 1000 : 200; // 20% < umbral 30% de la pasiva
    const hpAntes = c.hpJugador;
    rpg.combatTurn(u, 'atacar');
    return hpAntes - c.hpJugador; // daño recibido
  };
  try {
    const danoFull = correr(1);
    const danoBajo = correr(0.2);
    assert.ok(danoBajo > 0, 'no recibió daño (test inválido)');
    // DEF base -> +25% bajo el umbral: recibe menos daño con el mismo ataque
    assert.ok(danoBajo < danoFull, `bajo 30% HP no redujo daño: ${danoBajo} vs ${danoFull}`);
  } finally {
    Math.random = orig;
  }
});
check('pasiva Médium: roba vida al atacar (texto + curación)', () => {
  const orig = Math.random;
  Math.random = () => 0; // el jabali telegrafia (no ataca) y el golpe es crítico
  try {
    const u = nuevo();
    u.rpg.clase = 'medium_yurei';
    u.rpg.nivel = 12;
    rpg.getStats(u);
    u.rpg.hp = 10; // muy dañada: hay margen para curar
    rpg.startCombat(u, 'jabali');
    const c = u.rpg.combate;
    c.enemyHp = 999999;
    c.hpJugador = 10;
    const hpAntes = c.hpJugador;
    const res = rpg.combatTurn(u, 'atacar');
    assert.ok(res && !res.terminado, 'combate terminó antes de medir');
    assert.ok(res.resultado.includes('Robaste'), 'sin texto de robo de vida');
    assert.ok(c.hpJugador > hpAntes, `no curó: ${hpAntes} -> ${c.hpJugador}`);
  } finally {
    Math.random = orig;
  }
});

// --- 4. Kits de habilidades (data para la FASE 5) -------------------------------
console.log('Kits de habilidades:');
check('SKILLS_V2: 24 skills con el esquema obligatorio', () => {
  const lista = Object.values(rpg.SKILLS_V2);
  assert.strictEqual(lista.length, 24);
  for (const s of lista) {
    for (const campo of ['id', 'nombre', 'clase', 'nivelReq', 'costoKi', 'cooldown', 'objetivo', 'efectos', 'frase']) {
      assert.ok(campo in s, `${s.id} falta ${campo}`);
    }
    assert.ok(Array.isArray(s.efectos) && s.efectos.length > 0, `${s.id} sin efectos`);
    assert.ok(s.id.startsWith('ougi_') === !!s.banner, `${s.id}: banner solo en ougi`);
    assert.ok(rpg.CLASSES[s.clase] || rpg.NUEVAS_CLASES[s.clase], `${s.id} clase inválida`);
  }
  for (const key of Object.keys(rpg.CLASSES)) {
    assert.strictEqual((rpg.KITS_POR_CLASE[key] || []).length, 4, `${key} sin kit de 4`);
  }
});

// --- 5. Mapeo de nombres viejos --------------------------------------------------
console.log('Aliases legacy:');
check('CLASS_MAP cubre clases y evoluciones viejas', () => {
  for (const [vieja, nueva] of Object.entries(rpg.CLASS_MAP)) {
    assert.ok(rpg.getClass(nueva), `${vieja} -> ${nueva} sin destino`);
    assert.ok(!rpg.getClass(vieja), `${vieja} aún resuelve como clase`);
  }
});
check('SKILLS legacy re-claveado a nombres nuevos', () => {
  for (const key of Object.keys(rpg.CLASSES)) {
    assert.ok(rpg.SKILLS[key] && typeof rpg.SKILLS[key] === 'object', `SKILLS sin clave ${key}`);
    assert.ok(Array.isArray(rpg.HABILIDADES_POR_NIVEL[key]), `HABILIDADES_POR_NIVEL sin clave ${key}`);
  }
});

console.log(`\n${ok} comprobaciones OK${process.exitCode ? ' (HUBO FALLOS)' : ''}`);
