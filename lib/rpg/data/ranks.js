// FASE 3 — Rangos de Cazador y exámenes de ascenso (jefe de prueba).
// RANGOS[i].nivel = nivel mínimo para rendir el examen de ESE rango.
// El rango E es el inicial (sin examen); los demás se obtienen ganando el
// combate de EXAMENES[entry.examen].

const RANGOS = [
  { key: 'E', nombre: '⚪ Cazador E', nivel: 1, examen: null },
  { key: 'D', nombre: '🟤 Cazador D', nivel: 10, examen: 'examen_d' },
  { key: 'C', nombre: '🟡 Cazador C', nivel: 20, examen: 'examen_c' },
  { key: 'B', nombre: '🟢 Cazador B', nivel: 32, examen: 'examen_b' },
  { key: 'A', nombre: '🔵 Cazador A', nivel: 45, examen: 'examen_a' },
  { key: 'S', nombre: '🔴 Cazador S', nivel: 58, examen: 'examen_s' },
];

// Jefes de prueba. `rango` = rango que se obtiene al derrotarlo.
// FASE 5: con la fórmula de daño por DEF, cada guardián tiene DEF/VEL propios.
// Balance (tools/examen-sim.js): >70% de victorias con build mixto, 8-10
// turnos, kensei termina ≥80% HP y onmyoji ≥50% HP.
const EXAMENES = {
  examen_d: { nombre: '🎓 Guardián de la Prueba (D)', hp: 470, atk: 5, def: 3, vel: 6, exp: 150, oro: 800, rango: 'D' },
  examen_c: { nombre: '🎓 Guardián de la Prueba (C)', hp: 800, atk: 11, def: 8, vel: 7, exp: 400, oro: 2000, rango: 'C' },
  examen_b: { nombre: '🎓 Guardián de la Prueba (B)', hp: 1150, atk: 15, def: 11, vel: 8, exp: 800, oro: 4000, rango: 'B' },
  examen_a: { nombre: '🎓 Guardián de la Prueba (A)', hp: 1550, atk: 20, def: 14, vel: 9, exp: 1200, oro: 7000, rango: 'A' },
  examen_s: { nombre: '🎓 Guardián de la Prueba (S)', hp: 2000, atk: 25, def: 17, vel: 10, exp: 1800, oro: 12000, rango: 'S' },
};

module.exports = { RANGOS, EXAMENES };
