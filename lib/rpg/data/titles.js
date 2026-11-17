// Datos de títulos: condición de desbloqueo + bonus de stats al equipar.
// Las condiciones reciben el usuario `u` y devuelven booleano.

const TITLES = {
  trabajador: {
    nombre: '👷 Trabajador',
    descripcion: 'Completó 10 trabajos.',
    condicion: (u) => (u.rpg.statsTrabajos || 0) >= 10,
    bonus: { atk: 1, hp: 5 },
  },
  criminal: {
    nombre: '🕵️ Criminal',
    descripcion: 'Completó 5 crímenes exitosos.',
    condicion: (u) => (u.rpg.statsCrimenes || 0) >= 5,
    bonus: { atk: 2, def: 1 },
  },
  millonario: {
    nombre: '💰 Millonario',
    descripcion: 'Tuvo 100,000 Coins en el banco.',
    condicion: (u) => (u.rpg.maxBank || 0) >= 100000,
    bonus: { atk: 3, def: 2, hp: 10 },
  },
  matador: {
    nombre: '⚔️ Matador',
    descripcion: 'Derrotó 20 enemigos en combate.',
    condicion: (u) => (u.rpg.statsEnemigosDerrotados || 0) >= 20,
    bonus: { atk: 4, def: 1 },
  },
  explorador: {
    nombre: '🗺️ Explorador',
    descripcion: 'Superó 30 pisos en la mazmorra.',
    condicion: (u) => (u.rpg.statsPisos || 0) >= 30,
    bonus: { def: 2, hp: 15 },
  },
  señor_oro: {
    nombre: '👑 Señor del Oro',
    descripcion: 'Tiene 500,000 Coins en efectivo.',
    condicion: (u) => (typeof u.cash === 'number' && u.cash >= 500000),
    bonus: { atk: 5, def: 3, hp: 20 },
  },
};

module.exports = { TITLES };
