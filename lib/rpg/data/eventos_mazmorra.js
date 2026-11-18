// FASE E — Eventos de mazmorra (DATA pura).
// Todos dan algo y ninguno quita oro ni apuesta nada.
// Los eventos con NPC amigables muestran qué ofrecen antes de decidir.

const EVENTOS_MAZMORRA = {
  cofre_oculto: {
    id: 'cofre_oculto',
    nombre: '🕳️ Cofre Oculto',
    prob: 20,
    tipo: 'oro',
    oroBase: 40,
    oroPorPiso: 10,
    objetoProb: 25,
    desc: 'Un cofre entre los escombros guarda monedas de la incursión.',
  },
  santuario_descanso: {
    id: 'santuario_descanso',
    nombre: '💧 Santuario de Descanso',
    prob: 15,
    tipo: 'curar',
    hpPct: 0.60,
    kiPct: 0.60,
    desc: 'Un pozo de luz restauradora te envuelve.',
  },
  mercader_errante: {
    id: 'mercader_errante',
    nombre: '🛒 Mercader Errante',
    prob: 12,
    tipo: 'tienda',
    desc: 'Un mercader viajero vende pociones y materiales a precio fijo.',
  },
  sanadora_camino: {
    id: 'sanadora_camino',
    nombre: '🌿 Sanadora del Camino',
    prob: 10,
    tipo: 'curar_gratis',
    hpPct: 0.40,
    desc: 'Una sanadora te cura gratis parte de tus heridas.',
  },
  ermitaño_instructor: {
    id: 'ermitaño_instructor',
    nombre: '🧘 Ermitaño Instructor',
    prob: 8,
    tipo: 'bono_atk',
    atkPct: 0.10,
    turnos: 3,
    desc: 'Un ermitaño te enseña una técnica temporal.',
  },
  cofre_trampa: {
    id: 'cofre_trampa',
    nombre: '⚠️ Cofre con Trampa',
    prob: 10,
    tipo: 'dano',
    hpPct: 0.08,
    desc: 'Un cofre parece valioso pero es una trampa.',
  },
};

module.exports = { EVENTOS_MAZMORRA };
