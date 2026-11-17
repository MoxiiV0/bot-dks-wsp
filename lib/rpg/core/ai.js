// IA enemiga por arquetipo (FASE 5 la amplía: agresivo, defensivo, errático, jefe
// con fases al 70%, 40% y 15% de HP). Por ahora: ataque base con variación.

const { rand } = require('./narrate');

// Devuelve el daño base del enemigo en este turno.
const ataqueEnemigo = (enemy) => Math.max(1, enemy.atk + rand(-5, 5));

module.exports = { ataqueEnemigo };
