// Datos de mundo: eventos de mazmorra/portales, misiones y rangos de gremio.

const EVENTOS_MAZMORRA = {
  cofre_oculto: { nombre: '📦 Cofre Oculto', desc: 'Encontraste un cofre escondido en la pared.', tipo: 'oro', min: 500, max: 3000, prob: 30 },
  trampa_sombra: { nombre: '🌑 Trampa de Sombras', desc: 'Una sombra te emboscó y te quitó oro.', tipo: 'perder_oro', min: 100, max: 1000, prob: 20 },
  pozo_sano: { nombre: '💧 Pozo Sanador', desc: 'Bebiste de un pozo y te sentiste renovado.', tipo: 'curar', valor: 50, prob: 15 },
  altar_sacrificio: { nombre: '⚔️ Altar de Sacrificio', desc: 'Sacrificaste oro para ganar fuerza.', tipo: 'sacrificio', min: 500, max: 2000, prob: 10 },
  encuentro_mistico: { nombre: '✨ Encuentro Místico', desc: 'Un ser místico te otorgó experiencia extra.', tipo: 'exp', min: 100, max: 500, prob: 25 },
};

const MISSIONS = {
  cazador: { nombre: '🏹 Cazador de Jabalíes', objetivo: 'matar 3 jabalíes', recompensa: 3000, exp: 50, dificultad: 1 },
  explorador: { nombre: '🗺️ Explorador de Ruinas', objetivo: 'encontrar 5 fragmentos', recompensa: 5000, exp: 80, dificultad: 2 },
  asesino: { nombre: '⚔️ Eliminar Bandido', objetivo: 'derrotar al bandido jefe', recompensa: 8000, exp: 120, dificultad: 3 },
  caballero: { nombre: '🐉 Matar Dragón Joven', objetivo: 'derrotar al dragón', recompensa: 15000, exp: 200, dificultad: 5 },
};

const GUILD_RANKS = [
  { nombre: 'Recluta', requerimiento: 0 },
  { nombre: 'Miembro', requerimiento: 5000 },
  { nombre: 'Veterano', requerimiento: 20000 },
  { nombre: 'Oficial', requerimiento: 50000 },
  { nombre: 'Líder', requerimiento: 100000 },
];

module.exports = { EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS };
