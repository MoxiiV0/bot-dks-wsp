// FASE 6 — Mundo: escalado de enemigos por nivel, recompensas, caza y viaje.
// Todo sale de data/world.js (cero números mágicos en la lógica).

const { ZONAS, ZONA_INICIAL, ESCALADO } = require('../data/world');
const { RANGOS } = require('../data/ranks');
const { expToNext } = require('./curve');
const { rand } = require('./narrate');

// ---------------------------------------------------------------------------
// Escalado: HP = 45 + 22*Lv, ATK = 8 + 2.6*Lv, DEF = 3 + 1.2*Lv (+ élite/jefe)
// ---------------------------------------------------------------------------
const statsEscala = (nivel, tipo = 'normal') => {
  const Lv = Math.max(1, nivel || 1);
  const hpBase = ESCALADO.hp.base + ESCALADO.hp.porNivel * Lv;
  const atkBase = ESCALADO.atk.base + ESCALADO.atk.porNivel * Lv;
  let hpMult = 1;
  let atkMult = 1;
  if (tipo === 'elite') { hpMult = ESCALADO.elite.hpMult; atkMult = ESCALADO.elite.atkMult; }
  if (tipo === 'jefe') { hpMult = ESCALADO.jefe.hpMult; atkMult = ESCALADO.jefe.atkMult; }
  return {
    hp: Math.max(1, Math.round(hpBase * hpMult)),
    atk: Math.max(1, Math.round(atkBase * atkMult)),
    def: Math.max(0, Math.round(ESCALADO.def.base + ESCALADO.def.porNivel * Lv)),
    vel: Math.max(1, Math.round(ESCALADO.vel.base + ESCALADO.vel.porNivel * Lv)),
  };
};

// EXP = ceil(expToNext(Lv) / (10 + 0.25 * Lv)); Oro = 20 + 6*Lv con variación.
const recompensas = (nivel) => {
  const Lv = Math.max(1, nivel || 1);
  const exp = Math.ceil(expToNext(Lv) / (ESCALADO.exp.divisorBase + ESCALADO.exp.divisorPorNivel * Lv));
  const base = ESCALADO.oro.base + ESCALADO.oro.porNivel * Lv;
  const v = ESCALADO.oro.variacion;
  const oro = rand(Math.round(base * (1 - v)), Math.round(base * (1 + v)));
  return { exp, oro };
};

// Enemigo de zona normalizado al esquema del motor de combate (FASE 5).
const enemigoZona = (clave) => {
  if (!clave) return null;
  for (const [zonaKey, zona] of Object.entries(ZONAS)) {
    const def = zona.enemigos[clave];
    if (!def) continue;
    const s = statsEscala(def.nivel, def.tipo);
    const r = recompensas(def.nivel);
    return {
      key: clave,
      nombre: def.nombre,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      vel: s.vel,
      elemento: def.elemento || null,
      arquetipo: def.arquetipo || 'agresivo',
      esJefe: def.tipo === 'jefe',
      oro: r.oro,
      exp: r.exp,
      rango: null,
      zona: zonaKey,
      nivel: def.nivel,
      tipo: def.tipo,
    };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Zona actual y viaje
// ---------------------------------------------------------------------------
const zonaActual = (u) => {
  const r = u.rpg || {};
  if (!r.zona || !ZONAS[r.zona]) r.zona = ZONA_INICIAL; // perezoso + idempotente
  return r.zona;
};

const rankIndex = (key) => RANGOS.findIndex((x) => x.key === key);

const puedeViajar = (u, zonaKey) => {
  const zona = ZONAS[zonaKey];
  if (!zona) {
    return { error: `Zona no encontrada. Disponibles: ${Object.keys(ZONAS).join(', ')}` };
  }
  const r = u.rpg || {};
  const nivel = r.nivel || 1;
  if (nivel < zona.nivelMin) {
    return { error: `Necesitas nivel ${zona.nivelMin} para ${zona.nombre} (tu nivel: ${nivel}).` };
  }
  if (zona.rangoReq && rankIndex(r.rango || 'E') < rankIndex(zona.rangoReq)) {
    return { error: `Necesitas el rango de Cazador ${zona.rangoReq} para ${zona.nombre}.` };
  }
  return {};
};

const viajar = (u, zonaKey) => {
  const key = String(zonaKey || '').toLowerCase();
  const chk = puedeViajar(u, key);
  if (chk.error) return chk;
  const r = u.rpg;
  if (r.combate) return { error: 'Estás en combate: terminalo antes de viajar (#huir para escapar).' };
  const zona = ZONAS[key];
  const desde = ZONAS[zonaActual(u)];
  r.zona = key;
  return {
    zona: key,
    mensaje: `📍 Viajaste de *${desde.nombre}* a *${zona.nombre}*.\nNiveles ${zona.nivelMin}-${zona.nivelMax} · ${zona.ambiente}\nUsá #cazar para buscar enemigos.`,
  };
};

// ---------------------------------------------------------------------------
// Caza: enemigo aleatorio de la zona actual (#cazar [jefe|clave])
// ---------------------------------------------------------------------------
const cazar = (u, ref) => {
  const zonaKey = zonaActual(u);
  const zona = ZONAS[zonaKey];
  const entradas = Object.entries(zona.enemigos);

  // Referencia explícita: #cazar jefe | #cazar <clave>
  if (ref) {
    if (ref === 'jefe') {
      const jefe = entradas.find(([, d]) => d.tipo === 'jefe');
      if (jefe) return { zona: zonaKey, clave: jefe[0], enemy: enemigoZona(jefe[0]) };
    }
    const par = entradas.find(([k]) => k === ref);
    if (par) return { zona: zonaKey, clave: par[0], enemy: enemigoZona(par[0]) };
    return { error: `Enemigo no encontrado en ${zona.nombre}. Disponibles: ${entradas.map(([k]) => k).join(', ')}` };
  }

  // Azar: peso de élite vs normal (el jefe nunca sale solo).
  const normales = entradas.filter(([, d]) => d.tipo === 'normal');
  const elites = entradas.filter(([, d]) => d.tipo === 'elite');
  const saleElite = elites.length > 0 && Math.random() * 100 < ESCALADO.caza.elite;
  const pool = saleElite ? elites : normales;
  const par = pool[Math.floor(Math.random() * pool.length)];
  return { zona: zonaKey, clave: par[0], enemy: enemigoZona(par[0]) };
};

// Listado de zonas para #viajar sin argumentos.
const listaZonas = (u) => {
  const actual = zonaActual(u);
  return Object.entries(ZONAS).map(([key, z]) => {
    const estado = key === actual ? '📍' : (puedeViajar(u, key).error ? '🔒' : '✅');
    const reqs = [`nv${z.nivelMin}+`];
    if (z.rangoReq) reqs.push(`rango ${z.rangoReq}`);
    return `${estado} *${z.nombre}* (${reqs.join(', ')})`;
  }).join('\n');
};

module.exports = { statsEscala, recompensas, enemigoZona, zonaActual, puedeViajar, viajar, cazar, listaZonas, ZONAS, ZONA_INICIAL };
