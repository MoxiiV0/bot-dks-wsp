// FASE 5 — Habilidades del motor unificado + combinaciones legadas.
// - resolveHabilidad: valida y resuelve #hab contra SKILLS_V2 (kit por clase,
//   números 1-4, ids o alias legados de #skill). Sin números mágicos.
// - useSkill/combinarSkills: sistema legado (oro) que sigue operativo para
//   #combinar hasta su retiro en la FASE 13.

const { baseClassKey } = require('../data/classes');
const { SKILLS, SKILLS_V2, KITS_POR_CLASE, SKILLS_ALIAS, COMBINACIONES_SKILLS } = require('../data/skills');
const { money } = require('./narrate');
const { ensureRPG } = require('./migrate');

// Kit de habilidades de la clase del jugador (las ramas heredan el de su base).
const kitDe = (u) => {
  const r = ensureRPG(u);
  if (!r.clase) return null;
  return KITS_POR_CLASE[baseClassKey(r.clase)] || null;
};

// Resuelve una referencia de #hab: número (1..4), id de SKILLS_V2 o alias
// legado (#skill golpe_fuerte). Valida nivel, Ki (salvo modo Despertar),
// cooldown (turnos absolutos en c.cooldowns) y ougi (requiere Despertar).
// Devuelve { habilidad, kit } | { error, kit? }.
const resolveHabilidad = (u, ref, c) => {
  const r = ensureRPG(u);
  const kit = kitDe(u);
  if (!kit || !kit.length) return { error: 'Tu clase no tiene habilidades. Elegí una con #clase.' };
  if (!c) return { error: 'No estás en un combate. Iniciá con #combate <enemigo> o #cazar.' };

  const texto = String(ref == null ? '' : ref).trim().toLowerCase();
  if (!texto) return { error: 'Uso: #hab <número|id>', kit };

  let hab = null;
  if (/^\d+$/.test(texto)) {
    hab = kit[parseInt(texto, 10) - 1] || null;
  }
  if (!hab) {
    const id = SKILLS_ALIAS[texto] || texto;
    const cand = SKILLS_V2[id];
    if (cand && cand.clase === baseClassKey(r.clase)) hab = cand;
  }
  if (!hab) {
    return { error: `Habilidad no encontrada. Tu kit: ${kit.map((s, i) => `${i + 1}.${s.id}`).join(', ')}`, kit };
  }

  if ((r.nivel || 1) < hab.nivelReq) {
    return { error: `🔒 *${hab.nombre}* requiere nivel ${hab.nivelReq}. Tu nivel: ${r.nivel}.` };
  }
  const modoDespertar = (c.despertarTurnos || 0) > 0;
  if (hab.banner && !modoDespertar) {
    return { error: `🌟 *${hab.nombre}* es un Ougi: requiere modo Despertar (#despertar con el medidor en 100).` };
  }
  if (!modoDespertar && (r.ki || 0) < hab.costoKi) {
    return { error: `🌀 Ki insuficiente: ${hab.nombre} cuesta ${hab.costoKi} Ki (tienes ${r.ki || 0}).` };
  }
  const cd = c.cooldowns && c.cooldowns[hab.id];
  if (cd && c.turnos < cd) {
    return { error: `⏳ *${hab.nombre}* en cooldown: ${cd - c.turnos} turno/s.` };
  }
  return { habilidad: hab, kit };
};

// --- Legado (operativo hasta FASE 13) ----------------------------------------

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

module.exports = { kitDe, resolveHabilidad, useSkill, combinarSkills };
