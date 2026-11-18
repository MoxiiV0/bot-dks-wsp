// Simulador de combate (base para la FASE 15 — balance).
// Uso:
//   node tools/simulate.js                      -> kensei vs jabali x100
//   node tools/simulate.js <clase> <enemigo> [n]
//   node tools/simulate.js --all [n]            -> todas las clases vs todos los enemigos

const rpg = require('../lib/rpg');

const CLASES_BASE = Object.keys(rpg.CLASSES); // FASE 4: kensei, onmyoji, hayate, shinobi

// Corre n combates limpios y devuelve métricas.
const simular = (claseKey, enemyKey, n) => {
  let victorias = 0;
  let derrotas = 0;
  let escapes = 0;
  let turnosTotales = 0;
  let hpAlVencer = 0; // suma de % HP al ganar

  for (let i = 0; i < n; i++) {
    const u = { cash: 1000, bank: 0 };
    rpg.ensureRPG(u);
    u.rpg.clase = claseKey;
    if (!rpg.startCombat(u, enemyKey)) return null;

    let res = null;
    let turnos = 0;
    while (u.rpg.combate && turnos < 50) {
      res = rpg.combatTurn(u, 'atacar');
      turnos++;
      if (!res || res.terminado) break;
    }
    turnosTotales += turnos;

    if (res && res.tipo === 'victoria') {
      victorias++;
      // Aproximación de HP al vencer: menos turnos usados = más HP restante
      hpAlVencer += Math.max(0, 1 - turnos / 15);
    } else if (res && res.tipo === 'derrota') {
      derrotas++;
    } else {
      escapes++;
    }
  }

  return {
    winRate: Math.round((victorias / n) * 100),
    derrotas,
    escapes,
    turnosProm: +(turnosTotales / n).toFixed(1),
    hpAprox: Math.round((hpAlVencer / Math.max(1, victorias)) * 100),
  };
};

const main = () => {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const nums = args.filter((a) => /^\d+$/.test(a));
  const n = nums.length ? parseInt(nums[0], 10) : 100;
  const pos = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

  const clases = all ? CLASES_BASE : [pos[0] || 'kensei'];
  const enemigos = all ? Object.keys(rpg.ENEMIES) : [pos[1] || 'jabali'];

  console.log(`⚔️  Simulación: ${n} combates por pareja\n`);
  console.log('clase       enemigo     win%  derrotas  escapes  turnos  hpAlVencer');
  console.log('---------------------------------------------------------------------');

  for (const c of clases) {
    if (!rpg.CLASSES[c]) { console.log(`clase desconocida: ${c}`); continue; }
    for (const e of enemigos) {
      const r = simular(c, e, n);
      if (!r) { console.log(`enemigo desconocido: ${e}`); continue; }
      console.log(
        `${c.padEnd(11)} ${e.padEnd(11)} ${String(r.winRate).padStart(3)}%  ${String(r.derrotas).padStart(7)}  ${String(r.escapes).padStart(7)}  ${String(r.turnosProm).padStart(5)}  ${String(r.hpAprox).padStart(8)}%`
      );
    }
  }
};

main();
