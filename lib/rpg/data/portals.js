// FASE 7 — Portales (reemplazo de la mazmorra). Todo es DATA: probabilidades,
// dificultad, costos, eventos y ranking. La lógica vive en core/portal.js.

const PORTAL = {
  // Entrada: se gasta 1 llave del día (3/día) o se paga este oro.
  llavesPorDia: 3,
  costoOro: 1000,

  // Reparto de pisos: 55% combate, 25% evento, 10% tesoro, 10% santuario.
  pisos: { combate: 55, evento: 25, tesoro: 10, santuario: 10 },

  // Dificultad +4% por piso (compuesta sobre HP/ATK del enemigo del piso).
  dificultadPorPiso: 0.04,

  // Jefe de portal (arquetipo 'jefe', con fases 70/40/15) cada N pisos.
  jefeCadaPisos: 10,

  // Al morir en el portal perdés 50% del botín acumulado (desde el efectivo,
  // con tope 0 — nunca quedan saldos negativos).
  botinMuertePct: 0.5,

  // Expiración por inactividad (timestamps, sin setTimeout). Al expirar el
  // portal se cierra conservando el botín.
  expiracionMs: 60 * 60 * 1000,

  // Piso de tesoro: oro base + incremento por piso (±20%) y objeto de combate.
  tesoro: { oroBase: 60, oroPorPiso: 15, variacion: 0.2, objetoProb: 25 },

  // Santuario de descanso: restaura HP y Ki al 100%.
  santuario: { hpPct: 1, kiPct: 1 },

  // Botín extra al vencer al jefe de portal (por piso alcanzado).
  jefeBotin: { oroBase: 300, oroPorPiso: 40 },

  // Bono temporal del Altar del Sacrificio: +25% ATK durante los próximos
  // 3 combates de portal (se consume al entrar a cada combate).
  bonoAltar: { atkPct: 0.25, combates: 3 },

  // Ranking semanal por grupo: cuántos récords conserva.
  rankingTop: 10,

  // Rangos de portal (#portal <rango>): nivel base de los enemigos.
  // El jugador necesita ese rango de Cazador o superior.
  rangos: {
    E: { nivelBase: 1 },
    D: { nivelBase: 10 },
    C: { nivelBase: 20 },
    B: { nivelBase: 32 },
    A: { nivelBase: 45 },
    S: { nivelBase: 58 },
  },
};

// Los 5 eventos viejos reescritos con efectos REALES sobre HP, Ki, oro y
// bonos temporales. `prob` suma 100.
const EVENTOS_PORTAL = {
  cofre_oculto: {
    id: 'cofre_oculto',
    nombre: '🕳️ Cofre Oculto',
    prob: 22,
    tipo: 'oro',
    oroBase: 50,
    oroPorPiso: 12,
    variacion: 0.2,
    desc: 'Un cofre entre los escombros guarda monedas de la incursión.',
  },
  trampa_sombras: {
    id: 'trampa_sombras',
    nombre: '🌑 Trampa de Sombras',
    prob: 20,
    tipo: 'dano',
    hpPct: 0.15,
    kiPct: 0.3,
    desc: 'Tejados de sombra te raspan: perdés parte de HP y Ki.',
  },
  pozo_sanador: {
    id: 'pozo_sanador',
    nombre: '💧 Pozo Sanador',
    prob: 18,
    tipo: 'curar',
    hpPct: 0.6,
    kiPct: 0.6,
    desc: 'Un pozo de luz restauradora te envuelve.',
  },
  altar_sacrificio: {
    id: 'altar_sacrificio',
    nombre: '⚔️ Altar del Sacrificio',
    prob: 18,
    tipo: 'bono',
    hpPct: 0.25,
    desc: 'Derramás sangre en el altar a cambio de poder temporal.',
  },
  encuentro_mistico: {
    id: 'encuentro_mistico',
    nombre: '✨ Encuentro Místico',
    prob: 22,
    tipo: 'exp',
    expBase: 30,
    expPorPiso: 8,
    variacion: 0.4,
    desc: 'Un espíritu errante comparte sabiduría contigo.',
  },
};

module.exports = { PORTAL, EVENTOS_PORTAL };
