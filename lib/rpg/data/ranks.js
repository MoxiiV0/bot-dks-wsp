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
// Balanceados contra el nivel mínimo del rango (ver tools/simulate.js).
const EXAMENES = {
  examen_d: { nombre: '🎓 Guardián de la Prueba (D)', hp: 500, atk: 30, exp: 150, oro: 800, rango: 'D' },
  examen_c: { nombre: '🎓 Guardián de la Prueba (C)', hp: 850, atk: 55, exp: 400, oro: 2000, rango: 'C' },
  examen_b: { nombre: '🎓 Guardián de la Prueba (B)', hp: 1250, atk: 85, exp: 800, oro: 4000, rango: 'B' },
  examen_a: { nombre: '🎓 Guardián de la Prueba (A)', hp: 1700, atk: 115, exp: 1200, oro: 7000, rango: 'A' },
  examen_s: { nombre: '🎓 Guardián de la Prueba (S)', hp: 2200, atk: 145, exp: 1800, oro: 12000, rango: 'S' },
};

module.exports = { RANGOS, EXAMENES };
