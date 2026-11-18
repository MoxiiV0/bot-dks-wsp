// Balance de exámenes de rango (FASE 3): winrate por clase en el nivel mínimo.
// Uso: node tools/examen-sim.js [intentos]  (default 20)

const rpg = require('../lib/rpg');

const intentos = parseInt(process.argv[2], 10) || 20;
const CLASES = ['kensei', 'onmyoji', 'hayate', 'shinobi']; // FASE 4
// Arma conservadora para todas las builds
const ARMA = 'espada_hierro';

const build = (clase, nivel) => {
  const u = { cash: 0, bank: 0 };
  rpg.ensureRPG(u);
  u.rpg.clase = clase;
  u.rpg.nivel = nivel;
  u.rpg.arma = ARMA;
  u.rpg.equipo.arma = ARMA;
  // Puntos de atributo disponibles a ese nivel, repartidos como un build mixto
  const pts = (nivel - 1) * 2;
  const reparto = { atk: Math.floor(pts * 0.4), hp: Math.floor(pts * 0.3), def: Math.floor(pts * 0.2), ki: Math.floor(pts * 0.1), vel: 0 };
  for (const [k, v] of Object.entries(reparto)) u.rpg.atributos[k] = v;
  rpg.getStats(u);
  u.rpg.hp = u.rpg.hp; // lleno
  return u;
};

console.log(`Exámenes — ${intentos} intentos por celda (build mixto 40% ATK / 30% HP / 20% DEF, ${ARMA})\n`);
console.log('clase     ' + rpg.RANGOS.filter((x) => x.examen).map((x) => `  ${x.key} (nv${x.nivel})`).join('     '));
console.log('-'.repeat(74));

for (const clase of CLASES) {
  const fila = [];
  for (const rango of rpg.RANGOS.filter((x) => x.examen)) {
    let wins = 0;
    let turnosTotal = 0;
    let hpMin = 100;
    let hpSum = 0;
    for (let n = 0; n < intentos; n++) {
      const u = build(clase, rango.nivel);
      const hpMax = rpg.getStats(u).hp;
      rpg.startCombat(u, rango.examen);
      let i = 0;
      while (u.rpg.combate && i < 15) { rpg.combatTurn(u, 'atacar'); i++; }
      if (u.rpg.rango === rango.key) {
        wins++;
        turnosTotal += i;
        const pct = Math.round((u.rpg.hp / hpMax) * 100);
        hpSum += pct;
        if (pct < hpMin) hpMin = pct;
      }
    }
    const t = ganados(wins, turnosTotal);
    fila.push(`${String(Math.round((wins / intentos) * 100)).padStart(3)}%/${t}t/${wins ? Math.round(hpSum / wins) : '?'}%hp`);
    void hpMin;
  }
  console.log(clase.padEnd(10) + fila.map((f) => f.padStart(13)).join('   '));
}
function ganados(wins, total) { return wins ? (total / wins).toFixed(1) : '-'; }
console.log('\n(win% / turnos promedio de victoria — objetivo: >70% con build mixto)');
