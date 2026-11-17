// Curvas de progresión (introducidas en FASE 2 para la migración; FASE 3 las completa).

const MAX_LEVEL = 60;

// EXP necesaria para subir del nivel L al L+1: ceil(40 * L^1.65)
const expToNext = (nivel) => Math.ceil(40 * Math.pow(Math.max(1, nivel || 1), 1.65));

module.exports = { MAX_LEVEL, expToNext };
