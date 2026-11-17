// Progresión: EXP/nivel, títulos, evolución de clase, habilidades por nivel y misiones.

const { CLASSES, NUEVAS_CLASES, EVOLUCIONES_CLASE, baseClassKey } = require('../data/classes');
const { HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES } = require('../data/skills');
const { MISSIONS } = require('../data/zones');
const { TITLES } = require('../data/titles');
const { ensureRPG } = require('./migrate');
const { expToNext, MAX_LEVEL } = require('./curve');

// Subida de nivel centralizada (una sola curva para todo el juego).
// Curva v2: expToNext(L) = ceil(40 * L^1.65). Devuelve texto o null.
const addExp = (u, cantidad) => {
  const r = ensureRPG(u);
  r.exp += Math.max(0, Math.floor(cantidad));
  let subidas = 0;
  while (r.nivel < MAX_LEVEL && r.exp >= expToNext(r.nivel)) {
    r.exp -= expToNext(r.nivel);
    r.nivel += 1;
    subidas += 1;
  }
  if (subidas === 0) return null;
  return `⭐ *¡Subiste al nivel ${r.nivel}!* (+${subidas} nivel${subidas > 1 ? 'es' : ''})`;
};

// Desbloquea títulos cuya condición se cumple. Devuelve lista de nombres nuevos.
const checkTitles = (u) => {
  const r = ensureRPG(u);
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  const nuevos = [];
  for (const [key, t] of Object.entries(TITLES)) {
    if (!r.titulosDesbloqueados.includes(key) && t.condicion(u)) {
      r.titulosDesbloqueados.push(key);
      nuevos.push(t.nombre);
    }
  }
  return nuevos;
};

// Equipa un título ya desbloqueado.
const unlockTitle = (u, key) => {
  const r = ensureRPG(u);
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  if (!TITLES[key]) return { error: 'Título no existe.' };
  if (!r.titulosDesbloqueados.includes(key)) return { error: 'No has desbloqueado este título.' };
  r.tituloEquipado = key;
  return { exito: true, titulo: TITLES[key].nombre };
};

const evolucionarClase = (u, nuevaClave) => {
  const r = ensureRPG(u);
  const actual = r.clase;
  const evo = EVOLUCIONES_CLASE[actual];
  if (!evo || evo.nombre !== nuevaClave) {
    return { error: 'No puedes evolucionar a esa clase desde tu clase actual.' };
  }
  if (r.nivel < evo.requisito) {
    return { error: `Necesitas nivel ${evo.requisito} para evolucionar. Tu nivel: ${r.nivel}.` };
  }
  if (r.claseEvolucionada) {
    return { error: 'Ya evolucionaste tu clase.' };
  }

  const nueva = NUEVAS_CLASES[nuevaClave];
  if (!nueva) return { error: 'Clase de destino no encontrada.' };

  r.clase = nuevaClave;
  r.claseEvolucionada = true;
  return {
    exito: true,
    mensaje: `✨ ¡Has evolucionado a *${nueva.nombre}*!`,
    nueva,
  };
};

const obtenerHabilidadesNivel = (u) => {
  const r = ensureRPG(u);
  if (!r.clase) return [];
  const lista = HABILIDADES_POR_NIVEL[baseClassKey(r.clase)] || [];
  const desbloqueadas = r.habilidadesDesbloqueadas || [];
  const disponibles = [];
  for (const h of lista) {
    if (r.nivel >= h.nivel && !desbloqueadas.includes(h.key)) {
      disponibles.push(h);
    }
  }
  return disponibles;
};

const desbloquearHabilidadPorNivel = (u, key) => {
  const r = ensureRPG(u);
  if (!r.clase) return { error: 'No tienes clase.' };
  const lista = HABILIDADES_POR_NIVEL[baseClassKey(r.clase)] || [];
  const hab = lista.find((h) => h.key === key);
  if (!hab) return { error: 'Habilidad no encontrada para tu clase.' };
  if (r.nivel < hab.nivel) return { error: `Necesitas nivel ${hab.nivel} para desbloquear ${hab.nombre}.` };
  if (!r.habilidadesDesbloqueadas) r.habilidadesDesbloqueadas = [];
  if (r.habilidadesDesbloqueadas.includes(key)) return { error: 'Ya desbloqueaste esta habilidad.' };
  r.habilidadesDesbloqueadas.push(key);
  return { exito: true, habilidad: hab };
};

const obtenerHabilidadEspecial = (nivel) => {
  if (nivel % 10 !== 0) return null;
  return HABILIDADES_ESPECIALES[nivel] || null;
};

const getAvailableMissions = (nivel) => {
  const disponibles = [];
  for (const [key, m] of Object.entries(MISSIONS)) {
    if (nivel >= m.dificultad) disponibles.push({ key, ...m });
  }
  return disponibles;
};

const startMission = (u, missionKey) => {
  const m = MISSIONS[missionKey];
  if (!m) return null;
  const r = ensureRPG(u);
  if (r.misiones[missionKey]) return null; // ya tiene esta misión activa
  r.misiones[missionKey] = {
    progreso: 0,
    objetivo: m.objetivo,
    completada: false,
    iniciada: Date.now(),
  };
  return m;
};

const completeMission = (u, missionKey) => {
  const m = MISSIONS[missionKey];
  const r = ensureRPG(u);
  if (!r.misiones[missionKey]) return null;
  delete r.misiones[missionKey];
  r.misionesCompletadas.push(missionKey);
  u.cash += m.recompensa;
  const subida = addExp(u, m.exp);
  return { m, subida };
};

module.exports = {
  addExp,
  checkTitles,
  unlockTitle,
  evolucionarClase,
  obtenerHabilidadesNivel,
  desbloquearHabilidadPorNivel,
  obtenerHabilidadEspecial,
  getAvailableMissions,
  startMission,
  completeMission,
};
