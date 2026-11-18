// FASE 8 — Arcos narrativos: avance de capítulos, pruebas y recompensas.
// Estado en u.rpg.arco = { id, capitulo } (persistido con la economía; sin globals).

const { ARCS } = require('../data/arcs');
const { startCombat, puedeCombatir } = require('./combat');
const { addExp, checkTitles } = require('./progression');
const { ensureRPG } = require('./migrate');
const { money } = require('./narrate');
const { getStats } = require('./stats');
const { OBJETOS_COMBATE } = require('../data/items');

const ARCO_INICIAL = 'sakura';

// Devuelve el arco actual y el capítulo pendiente (perezoso, idempotente).
const arcoActual = (u) => {
  const r = ensureRPG(u);
  if (!r.arco || !r.arco.id || !ARCS[r.arco.id]) {
    r.arco = { id: ARCO_INICIAL, capitulo: 0 };
  }
  const arco = ARCS[r.arco.id];
  const idx = Math.max(0, Math.min(r.arco.capitulo || 0, arco.capitulos.length - 1));
  return { arco, indice: idx, capitulo: arco.capitulos[idx] };
};

// Progreso de todos los arcos (para #arco listar).
const listarArcos = (u) => {
  const r = ensureRPG(u);
  const keys = Object.keys(ARCS);
  const actualIdx = keys.indexOf(r.arco.id || '');
  const { indice, capitulo } = arcoActual(u);
  let txt = '📚 *Arcos Narrativos*\n';
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const arco = ARCS[key];
    if (i < actualIdx) {
      txt += `✅ *${arco.nombre}* — completado\n`;
    } else if (i === actualIdx) {
      txt += `▶️ *${arco.nombre}* — cap. ${indice + 1}/${arco.capitulos.length}: ${capitulo.titulo}\n`;
    } else {
      txt += `⏳ *${arco.nombre}* — bloqueado\n`;
    }
  }
  txt += `\nUsá #arco avanzar para jugar el capítulo actual.`;
  return txt;
};

// ¿Cumple los requisitos de nivel del capítulo?
const cumpleRequisitos = (u, caps) => {
  const r = ensureRPG(u);
  const req = caps.requisitos || {};
  if (req.nivel && (r.nivel || 1) < req.nivel) return false;
  return true;
};

// Resuelve una prueba (sin combate).
const resolverPrueba = (u, caps) => {
  const s = getStats(u);
  const p = caps.prueba || {};
  let exito = true;
  let detalle = '';
  if (p.tipo === 'stat') {
    const valor = s[p.atributo] || 0;
    exito = valor >= p.umbral;
    detalle = `${p.atributo.toUpperCase()} ${valor} / necesita ${p.umbral}`;
  } else if (p.tipo === 'azar') {
    exito = Math.random() * 100 < (p.prob || 50);
    detalle = `azar ${Math.round((p.prob || 50))}%`;
  }
  return { exito, detalle };
};

// Entrega la recompensa de un capítulo completado.
const entregarRecompensa = (u, caps) => {
  const r = ensureRPG(u);
  const { oro = 0, exp = 0, item, itemCant = 1 } = caps.recompensa || {};
  const partes = [];
  if (oro) {
    u.cash = Math.max(0, u.cash + oro);
    partes.push(`💰 +${money(oro)}`);
  }
  if (exp) {
    const subida = addExp(u, exp);
    if (subida) partes.push(`⭐ ${subida.split('\n')[0]}`);
  }
  if (item) {
    if (!r.inventario) r.inventario = {};
    r.inventario[item] = (r.inventario[item] || 0) + itemCant;
    const obj = OBJETOS_COMBATE[item];
    partes.push(`🎁 ${obj ? obj.nombre : item} x${itemCant}`);
  }
  const nuevos = checkTitles(u);
  if (nuevos.length) partes.push(`🏆 ¡Título: ${nuevos.join(', ')}!`);
  return partes;
};

// Cierra el capítulo actual: entrega recompensa, avanza al siguiente (o siguiente arco).
const cerrarCapitulo = (u, capitulo) => {
  const r = ensureRPG(u);
  const partes = entregarRecompensa(u, capitulo);
  const indiceActual = r.arco.capitulo || 0;
  const siguiente = indiceActual + 1;
  const arco = ARCS[r.arco.id];
  const keys = Object.keys(ARCS);
  const actualIdx = keys.indexOf(r.arco.id);
  let avance;
  if (siguiente >= arco.capitulos.length) {
    if (actualIdx + 1 < keys.length) {
      r.arco = { id: keys[actualIdx + 1], capitulo: 0 };
      const prox = ARCS[keys[actualIdx + 1]];
      avance = `🎉 ¡Arco *${arco.nombre}* completado!\nDesbloqueado: *${prox.nombre}* — cap. 1: ${prox.capitulos[0].titulo}`;
    } else {
      r.arco.completado = true;
      avance = `🎉 ¡Arco *${arco.nombre}* completado! Completaste todos los arcos disponibles.`;
    }
  } else {
    r.arco.capitulo = siguiente;
    const prox = arco.capitulos[siguiente];
    avance = `📖 Próximo episodio: *${prox.proximoEpisodio}* — ${prox.titulo}`;
  }
  const txt = partes.length ? `${partes.join(' · ')}\n` : '';
  return `${txt}${avance}\nUsá #arco para continuar.`;
};

// Inicia (o reintenta) el capítulo actual. Para combates, arranca el motor.
const iniciarCapitulo = (u) => {
  const r = ensureRPG(u);
  const { arco, indice, capitulo } = arcoActual(u);
  if (indice >= arco.capitulos.length) {
    return { tipo: 'completado', texto: `🎉 El arco *${arco.nombre}* ya está completo.` };
  }
  if (!cumpleRequisitos(u, capitulo)) {
    const req = capitulo.requisitos || {};
    return {
      tipo: 'bloqueado',
      texto: `🔒 ${capitulo.titulo} requiere nivel ${req.nivel || '?'}.`,
    };
  }
  let texto = `📖 *${arco.nombre} — Capítulo ${indice + 1}/${arco.capitulos.length}*\n${capitulo.titulo}\n\n`;
  for (const l of capitulo.dialogo) {
    texto += `${l.quien}: ${l.linea}\n`;
  }
  texto += '\n';

  if (capitulo.tipo === 'combate') {
    if (u.rpg.combate) {
      return { tipo: 'bloqueado', texto: '⚠️ Ya estás en combate. Terminalo con #atk antes de continuar el arco.' };
    }
    const bloqueo = puedeCombatir(u);
    if (bloqueo.error) return { tipo: 'bloqueado', texto: `⚠️ ${bloqueo.error}` };
    let iniciado;
    if (capitulo.enemigoInline) {
      iniciado = startCombat(u, capitulo.enemigo, { enemy: capitulo.enemigoInline });
    } else {
      iniciado = startCombat(u, capitulo.enemigo);
    }
    if (!iniciado) return { tipo: 'error', texto: 'No se pudo iniciar el combate del capítulo.' };
    r.arco.pendienteCombate = { clave: capitulo.enemigo, indice };
    texto += `⚔️ Enfrentás a *${iniciado.nombre}*. Usá #atk para atacar, #hab <n> para habilidades, #def para defenderte.\n`;
    return { tipo: 'combate', texto };
  }

  // Prueba (sin combate)
  const res = resolverPrueba(u, capitulo);
  if (!res.exito) {
    texto += `🎲 Prueba superada: ${res.detalle}. Fallaste. Volvé a intentar con #arco avanzar.\n`;
    return { tipo: 'prueba', texto };
  }
  const cerrado = cerrarCapitulo(u, capitulo);
  texto += `✅ Prueba superada.\n${cerrado}`;
  return { tipo: 'prueba', texto };
};

// Hook post-combate: se llama desde formatearCombate cuando un combate termina.
// Si el combate era el capítulo pendiente del arco y se ganó, cierra el capítulo.
const arcoPostCombate = (u, result) => {
  const r = u.rpg;
  if (!r || !r.arco || !r.arco.pendienteCombate) return null;
  if (!result || !result.terminado) return null;
  if (result.tipo !== 'victoria') {
    delete r.arco.pendienteCombate;
    return null;
  }
  const { clave, indice } = r.arco.pendienteCombate;
  const { indice: actualIdx, capitulo } = arcoActual(u);
  if (actualIdx !== indice || capitulo.tipo !== 'combate' || capitulo.enemigo !== clave) {
    delete r.arco.pendienteCombate;
    return null;
  }
  delete r.arco.pendienteCombate;
  const cerrado = cerrarCapitulo(u, capitulo);
  return `✨ Capítulo superado.\n${cerrado}`;
};

module.exports = {
  ARCO_INICIAL,
  arcoActual,
  listarArcos,
  iniciarCapitulo,
  arcoPostCombate,
};
