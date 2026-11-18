// FASE 15 — Simulador de balance.
// Simula combates por clase, nivel y zona con IA básica e imprime una tabla
// con winrate, turnos promedio, HP restante, Ki gastado y daño por turno.
// Uso: npm run sim [-- --all N]   (N combates por combinación; por defecto 60)

const rpg = require('../lib/rpg');
const { ZONAS } = require('../lib/rpg/data/world');
const { getStats } = require('../lib/rpg/core/stats');

const CLASES = ['kensei', 'onmyoji', 'hayate', 'shinobi'];
const NIVELES = [1, 10, 30, 60];
const ZONAS_ORDEN = ['sakura', 'torii', 'luna', 'cristal', 'trueno', 'abismo'];
const COMBATES_POR_COMBINACION = parseInt(process.argv[2]) || 60;
const TODO = process.argv.includes('--all');

// Crea un jugador de prueba con stats razonables para su nivel.
const crearJugador = (clase, nivel) => {
  const u = { cash: 50000, bank: 0 };
  rpg.ensureRPG(u);
  u.rpg.clase = clase;
  u.rpg.nivel = nivel;
  u.rpg.arma = 'espada_hierro';
  u.rpg.equipo.arma = 'espada_hierro';
  const puntos = Math.max(0, (nivel - 1) * 2);
  const porAtributo = Math.floor(puntos / 5);
  u.rpg.atributos = {
    atk: porAtributo,
    def: Math.floor(porAtributo * 0.7),
    hp: Math.floor(porAtributo * 0.8),
    ki: Math.floor(porAtributo * 0.6),
    vel: Math.floor(porAtributo * 0.9),
  };
  rpg.getStats(u);
  return u;
};

// Elige una acción para el jugador con IA básica (usa skills cuando hay Ki, defiende ante telegrafía).
const accionJugador = (u, c) => {
  try {
    const ki = u.rpg.ki || 0;
    // Si el enemigo está cargando (telegrafía), defender.
    if (c.caldowns) return 'defender';
    const kit = rpg.kitDe(u);
    const hab = kit && kit[0];
    if (hab && ki >= hab.costoKi && (!c.caldowns || !c.caldowns[hab.id] || c.caldowns[hab.id] <= c.turnos)) return 'habilidad';
    return 'atacar';
  } catch (e) {
    return 'atacar';
  }
};

// Simula un combate completo entre jugador y enemigo de zona.
const simularCombate = (u, claveEnemigo) => {
  const enemy = rpg.getEnemy(claveEnemigo);
  if (!enemy) return null;
  rpg.startCombat(u, enemy.clave, { enemy });
  let turnos = 0;
  const kiInicial = u.rpg.ki || 0;
  const hpInicial = u.rpg.hp || getStats(u).hp;
  let danoInfligido = 0;
  let danoRecibido = 0;
  let res = null;
  while (u.rpg.combate && turnos < 60) {
    const c = u.rpg.combate;
    const hpAntes = c.hpJugador;
    const hpEnemigoAntes = c.enemyHp;
    const accion = accionJugador(u, c);
    res = rpg.combatTurn(u, accion, '1');
    turnos++;
    if (!res || !u.rpg.combate) break;
    danoInfligido += Math.max(0, hpEnemigoAntes - (u.rpg.combate.enemyHp || 0));
    danoRecibido += Math.max(0, hpAntes - u.rpg.combate.hpJugador);
    if (res.terminado) break;
  }
  const kiFinal = u.rpg.ki || 0;
  const hpFinal = u.rpg.hp || getStats(u).hp;
  const victoria = res && res.tipo === 'victoria';
  return { victoria, turnos, hpRestante: Math.max(0, hpFinal), kiGastado: Math.max(0, kiInicial - kiFinal), danoInfligido, danoRecibido };
};

const main = () => {
  const filas = [];
  let totalWin = 0, totalCombates = 0, totalTurnos = 0;

  for (const clase of CLASES) {
    for (const nivel of NIVELES) {
      for (const zonaKey of ZONAS_ORDEN) {
        const zona = ZONAS[zonaKey];
        if (!zona) continue;
        const normales = Object.entries(zona.enemigos).filter(([, e]) => e.tipo === 'normal');
        if (normales.length === 0) continue;
        const claveEnemigo = normales[Math.floor(Math.random() * normales.length)][0];

        let victorias = 0, turnosSum = 0, hpSum = 0, kiSum = 0, cuenta = 0;
        for (let i = 0; i < COMBATES_POR_COMBINACION; i++) {
          const u = crearJugador(clase, nivel);
          const res = simularCombate(u, claveEnemigo);
          if (!res) continue;
          cuenta++;
          if (res.victoria) victorias++;
          turnosSum += res.turnos;
          hpSum += res.hpRestante;
          kiSum += res.kiGastado;
        }
        if (cuenta === 0) continue;
        const winrate = (victorias / cuenta) * 100;
        const avgTurnos = turnosSum / cuenta;
        const avgHp = hpSum / cuenta;
        const avgKi = kiSum / cuenta;
        totalWin += victorias;
        totalCombates += cuenta;
        totalTurnos += turnosSum;
        filas.push(`${clase.padEnd(9)} nv${String(nivel).padEnd(3)} ${zonaKey.padEnd(10)} ${claveEnemigo.padEnd(20)} | win ${winrate.toFixed(1)}% | turnos ${avgTurnos.toFixed(1)} | HP ${avgHp.toFixed(1)} | KiGasto ${avgKi.toFixed(1)}`);
      }
    }
  }

  console.log(`\n╔═══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  FASE 15 — Simulador de balance (${COMBATES_POR_COMBINACION} combates/combinación)   ║`);
  console.log(`╠═════════════╦═══════╦═══════════╦══════════════════════╦════════╦════════════╣`);
  console.log(`║ Clase       ║ Nivel ║ Zona              ║ Enemigo                  ║ Win%   ║ Turnos   ║`);
  console.log(`╠═════════════╬═══════╬══════════════════════╬══════════════════════╬════════╬════════════╣`);
  for (const f of filas) console.log(`║ ${f} ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝\n`);
  if (totalCombates > 0) {
    console.log(`Resultado global: ${((totalWin / totalCombates) * 100).toFixed(1)}% de victorias en ${totalCombates} combates, ${(totalTurnos / totalCombates).toFixed(1)} turnos promedio.`);
  }
  console.log(`Objetivos: Normal 85-92% win / 35-55% HP perdido / 4-7 turnos; Élite 65-75%; Jefe 50-65% / 12-20 turnos; diff clases ≤8 pts.\n`);
};

main();
