// Datos de habilidades: skills por clase, combinaciones y desbloqueos por nivel.

const SKILLS = {
  guerrero: {
    golpe_fuerte: { nombre: '💥 Golpe Fuerte', descripcion: 'Ataque potente que causa 1.5x daño.', costo: 10, multiplicador: 1.5 },
    escudo: { nombre: '🛡️ Escudo', descripcion: 'Reduce daño entrante un 50% este turno.', costo: 15, reduccion: 0.5 },
  },
  mago: {
    bola_fuego: { nombre: '🔥 Bola de Fuego', descripcion: 'Causa 2x daño mágico.', costo: 20, multiplicador: 2 },
    curacion: { nombre: '✨ Curación', descripcion: 'Recupera 30 de vida en combate.', costo: 15, curacion: 30 },
  },
  arquero: {
    disparo_preciso: { nombre: '🎯 Disparo Preciso', descripcion: 'Golpe crítico garantizado (2x daño).', costo: 12, multiplicador: 2 },
    evasion: { nombre: '🌀 Evasión', descripcion: '50% de probabilidad de esquivar el próximo ataque.', costo: 18, evadir: 0.5 },
  },
  pícaro: {
    ataque_sombra: { nombre: '🌑 Ataque en Sombra', descripcion: 'Causa 1.8x daño y roba oro.', costo: 18, multiplicador: 1.8, roba_oro: true },
    sigilo: { nombre: '🫥 Sigilo', descripcion: 'El siguiente turno no recibes daño.', costo: 25, bloquear: true },
  },
};

const COMBINACIONES_SKILLS = {
  'golpe_fuerte+escudo': { nombre: '💥🛡️ Golpe Escudo', descripcion: 'Ataque potente con reducción de daño.', clases: ['guerrero'], skill1: 'golpe_fuerte', skill2: 'escudo', resultado: 'golpe_escudo', costo: 20 },
  'bola_fuego+curacion': { nombre: '🔥✨ Fuego Sanador', descripcion: 'Ataca y te curas al mismo tiempo.', clases: ['mago'], skill1: 'bola_fuego', skill2: 'curacion', resultado: 'fuego_sanador', costo: 25 },
  'disparo_preciso+evasion': { nombre: '🎯🌀 Tiro Evasivo', descripcion: 'Disparo crítico con posibilidad de esquivar.', clases: ['arquero'], skill1: 'disparo_preciso', skill2: 'evasion', resultado: 'tiro_evasivo', costo: 22 },
  'ataque_sombra+sigilo': { nombre: '🌑🫥 Sombra Sigilosa', descripcion: 'Ataque desde las sombras sin ser detectado.', clases: ['pícaro'], skill1: 'ataque_sombra', skill2: 'sigilo', resultado: 'sombra_sigilosa', costo: 30 },
};

const HABILIDADES_POR_NIVEL = {
  guerrero: [
    { nivel: 5, key: 'golpe_fuerte', nombre: '💥 Golpe Fuerte', costo: 10 },
    { nivel: 10, key: 'escudo', nombre: '🛡️ Escudo', costo: 15 },
    { nivel: 15, key: 'embestida', nombre: '🐂 Embestida', costo: 20 },
    { nivel: 20, key: 'furia', nombre: '😡 Furia Berserker', costo: 25 },
  ],
  mago: [
    { nivel: 5, key: 'bola_fuego', nombre: '🔥 Bola de Fuego', costo: 20 },
    { nivel: 10, key: 'curacion', nombre: '✨ Curación', costo: 15 },
    { nivel: 15, key: 'rayo', nombre: '⚡ Rayo', costo: 25 },
    { nivel: 20, key: 'meteorito', nombre: '☄️ Meteorito', costo: 40 },
  ],
  arquero: [
    { nivel: 5, key: 'disparo_preciso', nombre: '🎯 Disparo Preciso', costo: 12 },
    { nivel: 10, key: 'evasion', nombre: '🌀 Evasión', costo: 18 },
    { nivel: 15, key: 'disparo_rapido', nombre: '⚡ Disparo Rápido', costo: 22 },
    { nivel: 20, key: 'lluvia_flechas', nombre: '🌧️ Lluvia de Flechas', costo: 35 },
  ],
  pícaro: [
    { nivel: 5, key: 'ataque_sombra', nombre: '🌑 Ataque en Sombra', costo: 18 },
    { nivel: 10, key: 'sigilo', nombre: '🫥 Sigilo', costo: 25 },
    { nivel: 15, key: 'dagas_venenosas', nombre: '☠️ Dagas Venenosas', costo: 28 },
    { nivel: 20, key: 'golpe_mortal', nombre: '💀 Golpe Mortal', costo: 45 },
  ],
  asesino: [
    { nivel: 15, key: 'golpe_silencioso', nombre: '🤫 Golpe Silencioso', costo: 20 },
    { nivel: 20, key: 'asesinato', nombre: '⚰️ Asesinato', costo: 40 },
  ],
  gran_arquero: [
    { nivel: 15, key: 'punteria_mortal', nombre: '🎯 Puntería Mortal', costo: 20 },
    { nivel: 20, key: 'flecha_explosiva', nombre: '💣 Flecha Explosiva', costo: 40 },
  ],
  caballero: [
    { nivel: 15, key: 'escudo_sagrado', nombre: '✨ Escudo Sagrado', costo: 20 },
    { nivel: 20, key: 'golpe_divino', nombre: '⚡ Golpe Divino', costo: 40 },
  ],
  archimago: [
    { nivel: 15, key: 'conejo_arcano', nombre: '🌀 Conejo Arcano', costo: 20 },
    { nivel: 20, key: 'invocacion_demonios', nombre: '👹 Invocación Demonios', costo: 45 },
  ],
  invocador: [
    { nivel: 5, key: 'domar_bestia', nombre: '🐺 Domar Bestia', costo: 15 },
    { nivel: 10, key: 'invocacion', nombre: '👹 Invocación', costo: 25 },
    { nivel: 15, key: 'bestia_alpha', nombre: '🐉 Bestia Alpha', costo: 40 },
  ],
  nigromante: [
    { nivel: 5, key: 'animar_muerto', nombre: '💀 Animar Muerto', costo: 15 },
    { nivel: 10, key: 'explosion_ossea', nombre: '🦴 Explosión Ósea', costo: 28 },
    { nivel: 15, key: 'ejercito_sombras', nombre: '👥 Ejército de Sombras', costo: 45 },
  ],
};

const HABILIDADES_ESPECIALES = {
  10: { key: 'golpe_epico', nombre: '⭐ Golpe Épico', descripcion: 'Daño masivo 3x. Solo cada 10 niveles.', costo: 50 },
  20: { key: 'habilidad_ultima', nombre: '🌟 Habilidad Última', descripcion: 'Tu poder máximo desbloqueado.', costo: 100 },
  30: { key: 'dios_de_la_guerra', nombre: '⚡ Dios de la Guerra', descripcion: 'Inmortalidad temporal por 3 turnos.', costo: 200 },
  40: { key: 'final_eclipse', nombre: '🌑 Eclipse Final', descripcion: 'Aniquila a todos los enemigos.', costo: 500 },
};

module.exports = {
  SKILLS,
  COMBINACIONES_SKILLS,
  HABILIDADES_POR_NIVEL,
  HABILIDADES_ESPECIALES,
};
