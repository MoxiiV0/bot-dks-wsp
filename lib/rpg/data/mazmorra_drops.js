// FASE G — Drops y bestiario: tablas por tipo de monstruo, raridades y bestiario.
// Cada monstruo puede dropear: oro, items, materiales, o nada.
// El bestiario completa mazmorras para dar título + bono.

const { ESCALADO } = require('../data/world');

const DROPS = {
  // Formato: clave del enemigo -> { oro, items, materiales, exp }
  jabali: { oro: 100, items: [], materiales: ['carnaza'] },
  lobo: { oro: 200, items: [], materiales: ['carnaza'] },
  bandido: { oro: 400, items: ['espada_simple'], materiales: ['cuero'] },
  esqueleto: { oro: 300, items: ['hueso'], materiales: ['polvo_esqueletico'] },
  dragon: { oro: 1000, items: ['escala_dragon'], materiales: ['hueso_dragon'] },
  // Jefes de mazmorra
  grRojo_jabalí: { oro: 500, items: [], materiales: ['carnaza_prima'] },
  grRojo_bandido: { oro: 600, items: ['espada_acero'], materiales: ['cuero_primo'] },
  grRojo_lobo: { oro: 350, items: [], materiales: ['carnaza'] },
  grRojo_brujo: { oro: 450, items: ['pocion_vida'], materiales: ['essencia_sombra'] },
  grRojo_ladrón: { oro: 400, items: ['daga'], materiales: ['cuero'] },
  // ... más enemigos según sea necesario
};

const BESTIARIO = {
  // Contador: { clave: { vistos, vencidos } }
  completado: false,
};

// Función para registrar vista/victoria en bestiario
const registrarBestiario = (clave) => {
  if (!BESTIARIO[clave]) {
    BESTIARIO[clave] = { vistos: 0, vencidos: 0 };
  }
  BESTIARIO[clave].vistos += 1;
};

// Función para registrar victoria en bestiario
const registrarVictoriaBestiario = (clave) => {
  if (!BESTIARIO[clave]) {
    BESTIARIO[clave] = { vistos: 0, vencidos: 0 };
  }
  BESTIARIO[clave].vencidos += 1;
  // Bono por completar: +10% EXP en próximos combates
  return { bonusExpPct: 0.10, titulo: 'Aventureiro' };
};

// Función para verificar si hay títulos por bestiario
const verificarTitulosBestiario = (u) => {
  let nuevos = [];
  for (const [clave, stats] of Object.entries(BESTIARIO)) {
    if (stats.vencidos >= 5 && !stats.titulo) {
      stats.titulo = true;
      nuevos.push(`Bestiario: ${clave}`);
    }
  }
  return nuevos;
};

module.exports = { DROPS, BESTIARIO, registrarBestiario, registrarVictoriaBestiario, verificarTitulosBestiario };