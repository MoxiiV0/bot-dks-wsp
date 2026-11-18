// FASE 11 — PvP y social: duelos, torneos y jefe mundial.
// Todo es DATA pura: reglas de duelo, torneos semanales, jefe mundial.

// --- Reglas de duelo (arena) ---
const DUELO = {
  // Tiempo por turno en segundos (60s según el prompt).
  turnoSegundos: 60,
  // Comisión de la apuesta que se queda la casa (0 = sin comisión, 0.1 = 10%).
  comisionApuesta: 0.1,
  // Apuesta mínima y máxima.
  apuestaMin: 1000,
  apuestaMax: 100000,
  // Vida inicial normalizada del duelo (porcentaje de HP máx del jugador).
  vidaPct: 1.0,
  // Máximo de turnos antes de empate.
  maxTurnos: 50,
};

// --- Torneo semanal ---
const TORNEO = {
  // Cuadro de 8 jugadores.
  maxJugadores: 8,
  // Rondas: cuartos (4), semifinales (2), final (1) = 7 combates totales.
  rondas: ['cuartos', 'semifinales', 'final'],
  // Premios por posición (oro).
  premios: { 1: 50000, 2: 25000, 3: 10000, 4: 5000 },
  // Título exclusivo para el ganador.
  tituloCampeon: 'campeon_torneo',
  // Duración de una ronda en segundos (para expiración por inactividad).
  rondaSegundos: 10 * 60,
  // Semana ISO para reset.
};

// --- Jefe mundial (grupo) ---
const JEFEMUNDIAL = {
  // HP base del jefe mundial (escalado por nivel del grupo).
  hpBase: 50000,
  // HP adicional por miembro del grupo.
  hpPorMiembro: 10000,
  // Daño mínimo para contabilizar participación.
  dañoMinimo: 100,
  // Recompensa base del jefe.
  oroBase: 20000,
  // Título exclusivo por participar.
  tituloParticipacion: 'defensor_mundial',
  // Expiración por inactividad (timestamps, sin timers).
  expiracionMs: 2 * 60 * 60 * 1000,
};

module.exports = { DUELO, TORNEO, JEFEMUNDIAL };
