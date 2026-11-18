// Progresión: EXP/nivel, puntos de atributo, descanso, títulos, evolución de
// clase, habilidades por nivel y misiones.

const { CLASSES, SUBCLASES, CLASES_AVANZADAS, DESPERTAR_MAYOR, baseClassKey, classLabel } = require('../data/classes');
const { HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES } = require('../data/skills');
const { MISSIONS } = require('../data/zones');
const { TITLES } = require('../data/titles');
const { ENTRENAMIENTO, DESCANSO } = require('../data/items');
const { aplicarLimiteEXPDiaria } = require('./economia');
const { ensureRPG } = require('./migrate');
const { getStats } = require('./stats');
const { expToNext, MAX_LEVEL } = require('./curve');

const CURACION_POR_SUBIDA = 0.2; // 20% de HP/Ki al subir de nivel

// Subida de nivel centralizada (una sola curva para todo el juego).
// Curva v2: expToNext(L) = ceil(40 * L^1.65).
// FASE 3: otorga puntos de atributo y restaura 20% de HP/Ki por nivel.
// Devuelve texto o null.
const addExp = (u, cantidad) => {
  const r = ensureRPG(u);
  // FASE 12: límite diario de EXP por caza de rutina (anti-spam).
  const limite = aplicarLimiteEXPDiaria(u, cantidad);
  r.exp += Math.max(0, Math.floor(limite.efectiva));
  let subidas = 0;
  while (r.nivel < MAX_LEVEL && r.exp >= expToNext(r.nivel)) {
    r.exp -= expToNext(r.nivel);
    r.nivel += 1;
    subidas += 1;
  }
  if (r.nivel >= MAX_LEVEL) r.exp = 0; // en el tope no se acumula EXP
  if (subidas === 0) return null;

  const puntos = subidas * ENTRENAMIENTO.puntosPorNivel;
  r.puntos = (r.puntos || 0) + puntos;

  // Curación al subir: 20% del máximo actual (la curva de crecimiento ya
  // subió los máximos, getStats recalcula y recorta todo).
  const s = getStats(u);
  r.hp = Math.min(s.hp, (r.hp || 0) + Math.ceil(s.hp * CURACION_POR_SUBIDA));
  r.ki = Math.min(s.kiMax, (r.ki || 0) + Math.ceil(s.kiMax * CURACION_POR_SUBIDA));

  return `⭐ *¡Subiste al nivel ${r.nivel}!* (+${subidas} nivel${subidas > 1 ? 'es' : ''})\n🎯 +${puntos} puntos de atributo — usá #entrenar`;
};

// Invierte puntos en un atributo. Uso interno de #entrenar.
const invertirPunto = (u, clave, cantidad = 1) => {
  const r = ensureRPG(u);
  const conf = ENTRENAMIENTO.atributos[clave];
  if (!conf) {
    return { error: `Atributo inválido. Disponibles: ${Object.keys(ENTRENAMIENTO.atributos).join(', ')}` };
  }
  const n = Math.floor(Number(cantidad));
  if (!Number.isFinite(n) || n < 1) return { error: 'La cantidad debe ser un número entero mayor a 0.' };
  if ((r.puntos || 0) < n) return { error: `No tienes puntos suficientes. Disponibles: ${r.puntos || 0}. Gana niveles con #pelear.` };

  r.puntos -= n;
  r.atributos = r.atributos || { atk: 0, def: 0, hp: 0, ki: 0, vel: 0 };
  r.atributos[clave] = (r.atributos[clave] || 0) + n;
  const s = getStats(u); // recalcula máximos con el nuevo bonus
  if (r.hp > s.hp) r.hp = s.hp;
  if (r.ki > s.kiMax) r.ki = s.kiMax;

  return {
    exito: true,
    atributo: conf.nombre,
    invertidos: n,
    total: r.atributos[clave],
    puntosRestantes: r.puntos,
    mensaje: `${conf.nombre} +${(n * conf.porPunto)} → *${r.atributos[clave]}* puntos invertidos (${conf.desc}). Quedan *${r.puntos}* puntos.`,
  };
};

// Reinicia todos los puntos invertidos (devuelve los puntos, cuesta oro).
const reiniciarPuntos = (u) => {
  const r = ensureRPG(u);
  const invertidos = Object.values(r.atributos || {}).reduce((a, b) => a + (b || 0), 0);
  if (invertidos <= 0) return { error: 'No tienes puntos invertidos para reiniciar.' };
  const costo = ENTRENAMIENTO.reinicio.base + ENTRENAMIENTO.reinicio.porNivel * (r.nivel || 1);
  if ((r.oro || 0) < costo) return { error: `No tienes suficiente oro. Costo: ${costo} oro (tienes ${r.oro || 0}).` };

  r.oro -= costo;
  r.puntos = (r.puntos || 0) + invertidos;
  r.atributos = { atk: 0, def: 0, hp: 0, ki: 0, vel: 0 };
  getStats(u); // recalcula máximos (bajan) y recorta HP/Ki actual
  return { exito: true, costo, puntos: r.puntos, invertidos };
};

// Descanso en la posada: recuperación instantánea con costo y espera.
const descansar = (u) => {
  const r = ensureRPG(u);
  if (r.combate) return { error: 'No podés descansar en pleno combate.' };
  r.cooldowns = r.cooldowns || r.cd || (r.cd = {});
  const ultimo = r.cooldowns['descansar'] || 0;
  const falta = Math.max(0, ultimo + DESCANSO.cooldownMs - Date.now());
  if (falta > 0) {
    return { error: `Ya descansaste hace poco. Esperá ${Math.ceil(falta / 60000)} min más.` };
  }
  if ((u.cash || 0) < DESCANSO.costo) {
    return { error: `La posada cuesta ${DESCANSO.costo}. No tienes suficiente.` };
  }

  const s = getStats(u);
  u.cash = Math.max(0, u.cash - DESCANSO.costo);
  r.hp = Math.min(s.hp, Math.ceil(s.hp * DESCANSO.restauraPct));
  r.ki = Math.min(s.kiMax, Math.ceil(s.kiMax * DESCANSO.restauraPct));
  r.cooldowns['descansar'] = Date.now();
  if (r.cd) r.cd['descansar'] = r.cooldowns['descansar'];
  return {
    exito: true,
    costo: DESCANSO.costo,
    mensaje: `🏨 *Descansaste en la posada* (-${DESCANSO.costo} oro)\n❤️ ${r.hp}/${s.hp} HP — 🌀 ${r.ki}/${s.kiMax} Ki`,
  };
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

// FASE B — Clases, subclases y ramas.
// Nivel 15: Prueba de Ascenso, elegir una subclase (irreversible).
// Nivel 35: otra prueba, elegir clase avanzada de tu subclase.
const evolucionarClase = (u, nuevaClave) => {
  const r = ensureRPG(u);
  const actual = r.clase;
  if (!actual) return { error: 'No tienes una clase seleccionada. Usá #clase primero.' };

  // --- Clase Avanzada (nivel 35): elegir de las dos opciones de tu subclase ---
  if (r.subclase && !r.despertarMayor) {
    const avanzadas = Object.values(CLASES_AVANZADAS).filter(a => a.subclase === r.subclase);
    if (!nuevaClave) {
      let txt = `🔄 *Clase Avanzada* — ${classLabel(u.rpg.clase)} (nivel ${u.rpg.nivel})\nElegí tu clase avanzada:\n\n`;
      for (const av of avanzadas) {
        const marca = u.rpg.nivel >= av.requisito ? '✅' : `🔒 nv${av.requisito}`;
        txt += `• ${marca} *${av.nombre}* — ${av.desc}\n`;
      }
      txt += `\nUsá: #evolucionar <clave>`;
      return txt;
    }
    const av = CLASES_AVANZADAS[nuevaClave];
    if (!av || av.subclase !== r.subclase) {
      return { error: 'No es una clase avanzada válida para tu subclase.' };
    }
    if (u.rpg.nivel < av.requisito) {
      return { error: `Necesitas nivel ${av.requisito} para ${av.nombre}. Tu nivel: ${u.rpg.nivel}.` };
    }
    r.clase = nuevaClave;
    r.despertarMayor = true;
    return {
      exito: true,
      mensaje: `✨ *¡Clase Avanzada Desbloqueada!*\nAhora eres *${av.nombre}*.\n${av.desc}`,
      avanzada: av,
    };
  }

  // --- Subclase (nivel 15): elegir una de las dos ramas de tu clase base ---
  if (r.claseEvolucionada && !r.despertarMayor) {
    // Ya tiene subclase, puede elegir clase avanzada si tiene nivel 35
    if (u.rpg.nivel >= DESPERTAR_MAYOR.requisito) {
      const avanzadas = Object.values(CLASES_AVANZADAS).filter(a => a.subclase === r.subclase);
      if (avanzadas.length === 0) return 'Tu subclase no tiene clase avanzada disponible.';
      let txt = `🔄 *Clase Avanzada* — ${classLabel(u.rpg.clase)} (nivel ${u.rpg.nivel})\nElegí tu clase avanzada:\n\n`;
      for (const av of avanzadas) {
        const marca = u.rpg.nivel >= av.requisito ? '✅' : `🔒 nv${av.requisito}`;
        txt += `• ${marca} *${av.nombre}* — ${av.desc}\n`;
      }
      txt += `\nUsá: #evolucionar <clave>`;
      return txt;
    }
    return { error: 'Ya completaste tu evolución de clase.' };
  }

  const base = baseClassKey(actual);
  const subclases = Object.values(SUBCLASES).filter(s => s.claseBase === base);
  if (!nuevaClave) {
    if (subclases.length === 0) return 'Tu clase no tiene subclases disponibles.';
    let txt = `🔄 *Prueba de Ascenso* — ${rpg.classLabel(u.rpg.clase)} (nivel ${u.rpg.nivel})\nElegí una de tus dos subcases:\n\n`;
    for (const sub of subclases) {
      const marca = u.rpg.nivel >= sub.requisito ? '✅' : `🔒 nv${sub.requisito}`;
      txt += `• ${marca} *${sub.nombre}* — ${sub.desc}\n`;
    }
    txt += `\nUsá: #evolucionar <clave>`;
    return txt;
  }

  const sub = SUBCLASES[nuevaClave];
  if (!sub || sub.claseBase !== base) {
    return { error: 'No es una subclase válida para tu clase.' };
  }
  if (u.rpg.nivel < sub.requisito) {
    return { error: `Necesitas nivel ${sub.requisito} para ${sub.nombre}. Tu nivel: ${u.rpg.nivel}.` };
  }

  r.clase = nuevaClave;
  r.subclase = nuevaClave;
  r.claseEvolucionada = true;
  return {
    exito: true,
    mensaje: `✨ *¡Subclase Desbloqueada!*\nAhora eres *${sub.nombre}*.\n${sub.desc}`,
    subclase: sub,
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
  invertirPunto,
  reiniciarPuntos,
  descansar,
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
