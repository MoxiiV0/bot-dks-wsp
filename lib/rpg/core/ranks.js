// FASE 3 — Rangos de Cazador: consulta de examen y ascenso.
// La lógica vive acá; los datos (RANGOS/EXAMENES) en data/ranks.js.

const { RANGOS, EXAMENES } = require('../data/ranks');
const { ensureRPG } = require('./migrate');

const getRango = (u) => {
  const r = ensureRPG(u);
  return RANGOS.find((x) => x.key === r.rango) || RANGOS[0];
};

// Info del próximo examen de ascenso (o null si ya es S).
const examenActual = (u) => {
  const r = ensureRPG(u);
  const idx = RANGOS.findIndex((x) => x.key === r.rango);
  const actual = RANGOS[idx >= 0 ? idx : 0];
  const siguiente = RANGOS[idx + 1] || null;
  if (!siguiente) return { rangoActual: actual, siguiente: null };
  return {
    rangoActual: actual,
    siguiente,
    requisito: siguiente.nivel,
    examenKey: siguiente.examen,
    jefe: EXAMENES[siguiente.examen] || null,
    puede: (r.nivel || 1) >= siguiente.nivel,
  };
};

// Ascenso por victoria en el examen (lo llama el motor de combate).
const ascenderRango = (u, rangoKey) => {
  const r = ensureRPG(u);
  const destino = RANGOS.find((x) => x.key === rangoKey);
  if (!destino) return null;
  if (RANGOS.findIndex((x) => x.key === r.rango) >= RANGOS.findIndex((x) => x.key === rangoKey)) {
    return null; // no se puede bajar ni repetir
  }
  r.rango = rangoKey;
  return destino;
};

module.exports = { getRango, examenActual, ascenderRango, RANGOS, EXAMENES };
