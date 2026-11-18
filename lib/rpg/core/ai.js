// FASE 5 — IA enemiga por arquetipo (agresivo, defensivo, errático, jefe).
// Los jefes tienen fases al 70%, 40% y 15% de HP con cambio de patrón y
// telegrafían sus golpes devastadores un turno antes. Todo es DATA (data/battle.js).

const { ARQUETIPOS, BATALLA } = require('../data/battle');
const { rand } = require('./narrate');

// Daño base del enemigo (legado: lo usan callers externos del motor viejo).
const ataqueEnemigo = (enemy) => Math.max(1, enemy.atk + rand(-5, 5));

// Confianza de IA del enemigo (con fases de jefe ya aplicadas por el motor).
const confIANZA = (enemy) => ARQUETIPOS[enemy.arquetipo] || ARQUETIPOS[BATALLA.arquetipoDefecto];

// Fases del jefe: devuelve la nueva fase si el HP cruza un umbral (o null).
// c.fase = índice de fase alcanzada (0 = sin fase).
const faseActual = (c, conf) => {
  if (!conf.fases) return null;
  const pct = c.enemyHp / c.enemyMaxHp;
  let fase = c.fase || 0;
  while (fase < conf.fases.length && pct <= conf.fases[fase].pct) fase += 1;
  return fase;
};

// Decide la acción del enemigo en su paso.
//   { tipo: 'atacar' | 'cargar' | 'defender' }
// 'cargar' telegrafia el golpe devastador (no hace daño este turno).
const decidirIA = (c, conf) => {
  // Golpe cargado de la ronda anterior: se descarga sí o sí.
  if (c.cargando) return { tipo: 'atacar', cargado: true };

  // Fase de jefe activa (c.faseConf) puede alterar la probabilidad de carga.
  const probCargar = (c.faseConf && c.faseConf.probCargar) || conf.probCargar;
  const probDefender = conf.probDefender;

  const r = Math.random();
  if (r < probCargar) return { tipo: 'cargar' };
  if (r < probCargar + probDefender) return { tipo: 'defender' };
  return { tipo: 'atacar' };
};

module.exports = { ataqueEnemigo, confIANZA, faseActual, decidirIA };
