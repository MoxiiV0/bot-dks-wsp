// FASE 12 — Economía y anti-abuso. Reglas de sumideros, límite diario de EXP,
// auditoría de ganancias grandes y respaldo automático. Todo DATA pura.

// Límite diario de EXP por caza de rutina (para frenar el spam).
const EXP_DIARIA = {
  tope: 1000000, // EXP máxima obtenible por caza de rutina por día
};

// Umbral a partir del cual una ganancia de RPG se registra en AUDIT_LOG.
const AUDIT_UMBRAL = 5000; // oro

// Sumideros de economía (costos en oro).
const SUMIDEROS = {
  forja: { descripcion: 'Forjar equipo', costoBase: 800 },
  pocion: { descripcion: 'Pociones de combate', costoBase: 200 },
  reparacion: { descripcion: 'Reparar durabilidad', costoBase: 100 },
  reinicioPuntos: { descripcion: 'Reiniciar puntos de atributo', costoBase: 500 },
  viaje: { descripcion: 'Viajar sin llaves', costoBase: 1000 },
  llaveExtra: { descripcion: 'Llave extra de portal', costoBase: 1000 },
};

module.exports = { EXP_DIARIA, AUDIT_UMBRAL, SUMIDEROS };
