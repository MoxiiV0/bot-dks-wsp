// Efectos de habilidades: uso y combinaciones.
// (La aplicación en combate vive en core/combat.js vía rpg.skillPendiente.)

const { baseClassKey } = require('../data/classes');
const { SKILLS, COMBINACIONES_SKILLS } = require('../data/skills');
const { money } = require('./narrate');
const { ensureRPG } = require('./migrate');

const useSkill = (u, skillKey) => {
  const r = ensureRPG(u);
  if (!r.clase) return { error: 'No tienes una clase seleccionada.' };
  const baseKey = baseClassKey(r.clase);
  const claseSkills = SKILLS[baseKey];
  if (!claseSkills) return { error: 'Tu clase no tiene habilidades básicas.' };
  const skill = claseSkills[skillKey];
  if (!skill) return { error: 'Esa habilidad no existe para tu clase.' };
  if (u.cash < skill.costo) return { error: `No tienes suficiente oro. Costo: ${money(skill.costo)}.` };

  u.cash = Math.max(0, u.cash - skill.costo);
  return { skill, costo: skill.costo };
};

const combinarSkills = (u, key1, key2) => {
  const r = ensureRPG(u);
  const baseKey = baseClassKey(r.clase);
  if (!r.clase || !SKILLS[baseKey]) return { error: 'No tienes una clase seleccionada.' };

  const claseSkills = SKILLS[baseKey];
  if (!claseSkills[key1] || !claseSkills[key2]) {
    return { error: 'Una o ambas habilidades no existen para tu clase.' };
  }

  const combinacionKey = `${key1}+${key2}`;
  const combinacionInversa = `${key2}+${key1}`;
  const comb = COMBINACIONES_SKILLS[combinacionKey] || COMBINACIONES_SKILLS[combinacionInversa];

  if (!comb) {
    return { error: 'No se pueden combinar esas dos habilidades.' };
  }

  if (!comb.clases.includes(baseKey)) {
    return { error: 'Esta combinación no está disponible para tu clase.' };
  }

  if (u.cash < comb.costo) {
    return { error: `No tienes suficiente oro. Costo: ${money(comb.costo)}.` };
  }

  if (!r.skillsCombinadas) r.skillsCombinadas = [];
  if (r.skillsCombinadas.includes(comb.resultado)) {
    return { error: 'Ya has combinado estas habilidades anteriormente.' };
  }

  u.cash = Math.max(0, u.cash - comb.costo);
  r.skillsCombinadas.push(comb.resultado);

  return {
    tipo: 'exito',
    mensaje: `✨ ¡Habilidades combinadas!\n🎯 Nueva habilidad: *${comb.nombre}*\n${comb.descripcion}\nCosto: ${money(comb.costo)}`,
    resultado: comb.resultado,
  };
};

module.exports = { useSkill, combinarSkills };
