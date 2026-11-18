// FASE 10 — Compañeros y vínculos.
// Estado en u.rpg.compañeros (persistido con la economía; sin globales sueltos).
// - Uno activo en combate, controlado por IA, con rol propio (tanque/curandero/daño).
// - Vínculo de nivel 1 a 5 con puntos ganados en combate.
// - Cada 4 turnos de combate activo, si vínculo ≥ 2, ataque combinado con banner.
// - El Shikigami usa el mismo sistema con espíritus.
// #domar y #invocar quedan como alias de #espiritu.

const { COMPANIONES, ESPIRITUS, VINCULO, DAÑO_COMBINADO_POR_ROL, CURA_COMBINADA } = require('../data/companions');
const { ARCO_INICIAL, arcoActual } = require('./arcs');
const { ensureRPG } = require('./migrate');
const { money } = require('./narrate');

const TIPO_COMPAÑERO = 'compañero';
const TIPO_ESPÍRITU = 'espíritu';

// ---------------------------------------------------------------------------
// Estado perezoso de compañeros/vínculos
// ---------------------------------------------------------------------------
const compañerosDe = (u) => {
  const r = ensureRPG(u);
  if (!r.compañeros) {
    r.compañeros = { activo: null, reclutas: [], vínculos: {} };
  }
  const cp = r.compañeros;
  if (!cp.reclutas) cp.reclutas = [];
  if (!cp.vínculos) cp.vínculos = {};
  return cp;
};

// Datos de un compañero/espíritu por clave y tipo.
const datosDe = (clave, tipo) => {
  const tabla = tipo === TIPO_ESPÍRITU ? ESPIRITUS : COMPANIONES;
  return tabla[clave] || null;
};

// ¿Está desbloqueado el arco necesario para reclutar a este compañero?
const arcoDesbloqueado = (u, arcoClave) => {
  const { índice, arco } = arcoActual(u);
  if (!arco) return false;
  const keys = Object.keys(require('../data/arcs').ARCS);
  const idxActual = keys.indexOf(arco.id);
  const idxRequerido = keys.indexOf(arcoClave);
  return idxRequerido <= idxActual;
};

// Reclutar un compañero o espíritu (costo en oro, requisito de nivel y arco).
const reclutar = (u, clave, tipo = TIPO_COMPAÑERO) => {
  const r = ensureRPG(u);
  const cp = compañerosDe(u);
  const datos = datosDe(clave, tipo);
  if (!datos) return { error: 'Ese compañero no existe.' };
  if (cp.reclutas.includes(clave)) return { error: `Ya reclutas a *${datos.nombre}*.` };
  if (u.rpg.nivel < datos.requisitoNivel) {
    return { error: `Necesitas nivel ${datos.requisitoNivel} para reclutar a *${datos.nombre}*.` };
  }
  if (!arcoDesbloqueado(u, datos.arcoDesbloqueo)) {
    return { error: `*${datos.nombre}* requiere haber avanzado en el arco *${datos.arcoDesbloqueo}*.` };
  }
  if ((u.cash || 0) < datos.costo) {
    return { error: `No tienes suficiente oro. Costo: ${money(datos.costo)}.` };
  }

  u.cash = Math.max(0, u.cash - datos.costo);
  cp.reclutas.push(clave);
  // Vínculo inicial nivel 1.
  if (!cp.vínculos[clave]) cp.vínculos[clave] = { nivel: 1, puntos: 0 };
  markEconDirtyLocal(u);
  return {
    exito: true,
    tipo,
    clave,
    nombre: datos.nombre,
    rol: datos.rol,
    costo: datos.costo,
    texto: `✨ ¡Reclutaste a *${datos.nombre}*! Rol: *${datos.rol}*. Usá #espiritu activar ${clave}.`,
  };
};

// Activar / desactivar el compañero activo (solo uno a la vez).
const activar = (u, clave, tipo = TIPO_COMPAÑERO) => {
  const r = ensureRPG(u);
  const cp = compañerosDe(u);
  const datos = datosDe(clave, tipo);
  if (!datos) return { error: 'Ese compañero no existe.' };
  if (!cp.reclutas.includes(clave)) {
    return { error: `No has reclutado a *${datos.nombre}*. Usá #espiritu reclutar ${clave}.` };
  }
  cp.activo = clave;
  cp.tipoActivo = tipo;
  markEconDirtyLocal(u);
  return { exito: true, clave, nombre: datos.nombre, rol: datos.rol, texto: `⚔️ *${datos.nombre}* está ahora activo (${datos.rol}).` };
};

const desactivar = (u) => {
  const r = ensureRPG(u);
  const cp = compañerosDe(u);
  if (!cp.activo) return { error: 'No tienes ningún compañero activo.' };
  const previo = cp.activo;
  cp.activo = null;
  cp.tipoActivo = null;
  markEconDirtyLocal(u);
  return { exito: true, clave: previo, texto: `🏡 ${previo} descansa.` };
};

// Compañero activo actual.
const activo = (u) => {
  const r = ensureRPG(u);
  const cp = r.compañeros;
  if (!cp || !cp.activo) return null;
  const datos = datosDe(cp.activo, cp.tipoActivo || TIPO_COMPAÑERO);
  if (!datos) return null;
  const vínculo = cp.vínculos[cp.activo] || { nivel: 1, puntos: 0 };
  return { ...datos, clave: cp.activo, tipo: cp.tipoActivo, vínculo };
};

// Listar todos los reclutados con su estado.
const listar = (u) => {
  const cp = compañerosDe(u);
  const lines = [];
  for (const [clave, tabla] of Object.entries({ ...COMPANIONES, ...ESPIRITUS })) {
    const reclutado = cp.reclutas.includes(clave);
    const act = cp.activo === clave;
    const v = cp.vínculos[clave] || { nivel: 1, puntos: 0 };
    const marca = act ? '▶️' : (reclutado ? '✅' : '🔒');
    lines.push(`${marca} *${tabla.nombre}* (${tabla.rol}) — Vínculo nv${v.nivel}${reclutado ? '' : ', no reclutado'}`);
  }
  if (lines.length === 0) return 'No hay compañeros disponibles aún.';
  const activoTxt = cp.activo ? cp.activo : 'ninguno';
  return `🐾 *Compañeros y espíritus*\nActivo: *${activoTxt}*\n${lines.join('\n')}\nUsá #espiritu activar <clave> para cambiar.`;
};

// ---------------------------------------------------------------------------
// Vínculo: subir de nivel al ganar un combate con compañero activo
// ---------------------------------------------------------------------------
const sumarPuntoVínculo = (u, clave) => {
  const r = ensureRPG(u);
  const cp = compañerosDe(u);
  if (!clave) clave = cp.activo;
  if (!clave) return null;
  const v = cp.vínculos[clave] || { nivel: 1, puntos: 0 };
  if (v.nivel >= VINCULO.max) return { nivel: v.nivel, puntos: v.puntos, subió: false };
  v.puntos += VINCULO.puntosPorCombate;
  let subió = false;
  while (v.puntos >= VINCULO.puntosPorNivel * v.nivel && v.nivel < VINCULO.max) {
    v.puntos -= VINCULO.puntosPorNivel * v.nivel;
    v.nivel += 1;
    subió = true;
  }
  cp.vínculos[clave] = v;
  markEconDirtyLocal(u);
  return { nivel: v.nivel, puntos: v.puntos, subió };
};

// ---------------------------------------------------------------------------
// Ataque combinado: cada 4 turnos de combate activo, si vínculo ≥ 2.
// Devuelve { daño, cura, banner } o null.
// `turnos` = turnos totales del combate actual (c.turnos).
// ---------------------------------------------------------------------------
const ataqueCombinado = (u, turnos) => {
  const r = ensureRPG(u);
  const cp = r.compañeros;
  if (!cp || !cp.activo) return null;
  const clave = cp.activo;
  const v = cp.vínculos[clave];
  if (!v || v.nivel < VINCULO.ataqueCombinadoMinVinculo) return null;
  if (turnos <= 0 || turnos % VINCULO.ataqueCombinadoCadaTurnos !== 0) return null;
  const datos = datosDe(clave, cp.tipoActivo || TIPO_COMPAÑERO);
  if (!datos) return null;
  const daño = Math.max(1, Math.round(datos.statsBase.atk * (DAÑO_COMBINADO_POR_ROL[datos.rol] || 0.5)));
  const cura = datos.rol === 'curandero' ? CURA_COMBINADA : 0;
  return { daño, cura, banner: datos.banner, rol: datos.rol, nombre: datos.nombre };
};

// Atribuir el daño del compañero al enemigo (llamado desde combatTurn).
const aplicarCombateCompañero = (u, turnos) => {
  const res = ataqueCombinado(u, turnos);
  if (!res) return null;
  // Si es curandero, curar al jugador.
  const r = ensureRPG(u);
  if (res.cura > 0) {
    const s = require('./stats').getStats(u);
    r.hp = Math.min(s.hp, (r.hp || 0) + res.cura);
  }
  return res;
};

// ---------------------------------------------------------------------------
// Helper local para marcar suciedad sin dependencia circular (index.js lo expone).
// ---------------------------------------------------------------------------
let markEconDirtyLocal = () => {};
const setMarkEconDirty = (fn) => { markEconDirtyLocal = fn; };

module.exports = {
  TIPO_COMPAÑERO,
  TIPO_ESPÍRITU,
  compañerosDe,
  datosDe,
  reclutar,
  activar,
  desactivar,
  activo,
  listar,
  sumarPuntoVínculo,
  ataqueCombinado,
  aplicarCombateCompañero,
  setMarkEconDirty,
  COMPANIONES,
  ESPIRITUS,
  VINCULO,
};
