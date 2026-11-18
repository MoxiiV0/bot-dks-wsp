// FASE 9 — Equipo, loot y forja.
// Slots: arma, armadura, accesorio, reliquia. Rarezas: Común, Raro, Épico,
// Legendario, Mítico. Afijos aleatorios según rareza. Sets de 3 piezas con
// bono. #forjar mejora de +1 a +10 con riesgo creciente y costo en oro y
// materiales. Todo DATA pura en data/items.js; aquí solo la lógica.

const {
  RAREZAS,
  RAREZAS_ORDENADA,
  FAMILIAS_ARMA,
  MEJORA_NOMBRE,
  EQUIPO_BASE,
  MATERIALES,
  MATERIAL_COSTO_MEJORA,
  AFIJOS,
  AFIJOS_POR_RAREZA,
  SETS,
  PIEZA_SET,
  DURABILIDAD,
} = require('../data/items');
const { rand, pick, money } = require('./narrate');
const { ensureRPG } = require('./migrate');

const SLOTS = ['arma', 'armadura', 'accesorio', 'reliquia'];

// ---------------------------------------------------------------------------
// Catálogo de items forjables: genera todas las combinaciones slot ×
// familia/tipo × rareza. Cada entrada: { clave, nombre, slot, clase?, raroza,
// base, precio, material }.
// ---------------------------------------------------------------------------
const generarCatalogo = () => {
  const cat = {};
  // Armas: una familia por clase.
  for (const [clase, fam] of Object.entries(FAMILIAS_ARMA)) {
    const claveFamilia = fam.nombre.toLowerCase().replace(/[^a-z0-9]/gi, '');
    for (const rareza of RAREZAS_ORDENADA) {
      const clave = `arma_${claveFamilia}_${rareza}`;
      const base = { ...EQUIPO_BASE.arma[clase] };
      const mult = RAREZAS[rareza].mult;
      const precio = Math.round(RAREZAS[rareza].precio * 800);
      cat[clave] = {
        clave,
        nombre: `${fam.emoji} ${fam.nombre} de ${rareza}${MEJORA_NOMBRE(0)}`,
        slot: 'arma',
        clase,
        rareza,
        base,
        precio,
        material: MATERIAL_COSTO_MEJORA[rareza][0] || 'mineral_fragmento',
      };
    }
  }
  // Armaduras, accesorios, reliquias: genéricos por rareza.
  const tiposSlot = {
    armadura: ['Pechera', 'Manto', 'Toga'],
    accesorio: ['Anillo', 'Amuleto', 'Botas'],
    reliquia: ['Esfera', 'Cristal', 'Sello'],
  };
  for (const [slot, tipos] of Object.entries(tiposSlot)) {
    for (const tipo of tipos) {
      for (const rareza of RAREZAS_ORDENADA) {
        const clave = `${slot}_${tipo.toLowerCase()}_${rareza}`;
        const base = { ...EQUIPO_BASE[slot][rareza] };
        const mult = RAREZAS[rareza].mult;
        const precio = Math.round(RAREZAS[rareza].precio * 600);
        cat[clave] = {
          clave,
          nombre: `🛡️ ${tipo} de ${rareza}${MEJORA_NOMBRE(0)}`,
          slot,
          rareza,
          base,
          precio,
          material: (MATERIAL_COSTO_MEJORA[rareza] || ['mineral_fragmento'])[0],
        };
      }
    }
  }
  return cat;
};

const CATALOGO = generarCatalogo();

const obtenerItem = (clave) => {
  if (!clave) return null;
  const k = String(clave).toLowerCase();
  // Búsqueda case-insensitive
  const directo = CATALOGO[k];
  if (directo) return directo;
  for (const [ck, cd] of Object.entries(CATALOGO)) {
    if (ck.toLowerCase() === k) return cd;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Construye un objeto item completo (clave, rareza, nivel, afijos, durabilidad)
// a partir de una clave de catálogo.
// ---------------------------------------------------------------------------
const crearItem = (clave, nivel = 0) => {
  const datos = obtenerItem(clave);
  if (!datos) return null;
  const rareza = datos.rareza;
  const nAfiijos = RAREZAS[rareza].afijos;
  const afijosDisponibles = AFIJOS_POR_RAREZA[rareza] || [];
  const afijos = [];
  for (let i = 0; i < nAfiijos && afijosDisponibles.length > 0; i += 1) {
    const af = pick(afijosDisponibles.filter((a) => !afijos.includes(a)));
    if (af) afijos.push(af);
  }
  return {
    clave,
    nombre: datos.nombre,
    slot: datos.slot,
    clase: datos.clase || null,
    rareza,
    nivel: Math.max(0, Math.min(10, nivel)),
    afijos,
    durabilidad: RAREZAS[rareza].durabilidad,
    durabilidadMax: RAREZAS[rareza].durabilidad,
  };
};

// ---------------------------------------------------------------------------
// Estado del equipo del usuario (perezoso, idempotente).
// ---------------------------------------------------------------------------
const equipoDe = (u) => {
  const r = ensureRPG(u);
  if (!r.equipo) r.equipo = { arma: null, armadura: null, accesorio: null, reliquia: null };
  if (!r.inventarioEquipo) r.inventarioEquipo = [];
  // Limpia espejo legacy si sincronizarProyecciones guardó un string en vez de item.
  if (r.equipo.arma && typeof r.equipo.arma === 'string') {
    const claveLegacy = r.equipo.arma;
    r.equipo.arma = null; // se reconstruye abajo
    const item = crearItemPorClaveVieja(claveLegacy);
    if (item) r.equipo.arma = item;
    r.arma = r.equipo.arma ? r.equipo.arma.clave : null;
    return r.equipo;
  }
  // Migración perezosa e idempotente de armas legacy (r.arma / r.armas).
  sincronizarEquipoLegado(r);
  // Sincroniza espejo r.arma <-> r.equipo.arma.clave
  if (r.equipo.arma) r.arma = r.equipo.arma.clave;
  else if (r.arma && !r.equipo.arma) {
    const item = crearItemPorClaveVieja(r.arma);
    if (item) r.equipo.arma = item;
    r.arma = r.equipo.arma ? r.equipo.arma.clave : null;
  }
  return r.equipo;
};

// Convierte claves de armas viejas (WEAPONS) a items FASE 9 con su rareza.
const crearItemPorClaveVieja = (claveVieja) => {
  const rareza = require('../data/migrations').ARMAS_RAREZA[claveVieja] || 'Comun';
  // Busca en el catálogo un arma de esa rareza (primera entrada que coincida).
  for (const [c, d] of Object.entries(CATALOGO)) {
    if (d.slot === 'arma' && d.rareza === rareza) {
      const item = crearItem(c, 0);
      if (item) return item;
    }
  }
  return crearItem(`arma_katana_${rareza}`, 0);
};

// Sincroniza el equipo v2 (r.equipo) con los campos legacy (r.arma, r.armas).
// Idempotente: se puede llamar cuantas veces haga falta; nunca sobrescribe un
// item ya equipado a menos que el arma equipada haya cambiado.
const sincronizarEquipoLegado = (r) => {
  if (!r.armas || !Array.isArray(r.armas)) return;
  const armaLegacy = r.arma || null;
  const itemEquipado = r.equipo && r.equipo.arma;

  // Si ya hay un item equipado y coincide con el arma legacy, todo sincronizado.
  if (itemEquipado && itemEquipado.clave === armaLegacy) return;

  // Si el arma legacy es una clave de WEAPONS vieja y no hay item, convertirla.
  if (armaLegacy && !itemEquipado) {
    const item = crearItemPorClaveVieja(armaLegacy);
    if (item) {
      r.equipo.arma = item;
      r.arma = item.clave;
    }
  }

  // Si r.arma es null pero hay armas en r.armas, equipar la primera.
  if (!armaLegacy && r.armas.length > 0 && !itemEquipado) {
    const item = crearItemPorClaveVieja(r.armas[0]);
    if (item) {
      r.equipo.arma = item;
      r.arma = item.clave;
    }
  }
};

// ---------------------------------------------------------------------------
// Equipar / desequipar un item en un slot.
// ---------------------------------------------------------------------------
const equipar = (u, slot, claveItem) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  if (!SLOTS.includes(slot)) return { error: 'Slot inválido.' };
  if (!equipo.inventarioEquipo) equipo.inventarioEquipo = [];
  // Busca el item en el inventario de equipo o ya equipado.
  let item = null;
  if (equipo[slot] && equipo[slot].clave === claveItem) {
    item = equipo[slot];
  } else {
    const idx = equipo.inventarioEquipo ? equipo.inventarioEquipo.findIndex((i) => i.clave === claveItem) : -1;
    if (idx >= 0) item = equipo.inventarioEquipo[idx];
    if (!item) {
      // Intenta crear desde catálogo si es forjable
      const cat = obtenerItem(claveItem);
      if (!cat) return { error: 'Ese objeto no existe.' };
      item = crearItem(claveItem, 0);
    }
  }
  if (item.slot !== slot) return { error: `Ese item no es de tipo *${slot}*.` };
  // Desequipa lo que haya en el slot y lo vuelve al inventario.
  const previo = equipo[slot];
  if (previo) {
    equipo.inventarioEquipo.push(previo);
  }
  equipo[slot] = item;
  // Saca del inventario si estaba ahí.
  if (equipo.inventarioEquipo) {
    equipo.inventarioEquipo = equipo.inventarioEquipo.filter((i) => i.clave !== claveItem || i !== item);
  }
  r.arma = equipo.arma ? equipo.arma.clave : null;
  return { exito: true, item, slot, previo };
};

const desequipar = (u, slot) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  if (!SLOTS.includes(slot)) return { error: 'Slot inválido.' };
  const previo = equipo[slot];
  if (!previo) return { error: `No tienes nada equipado en *${slot}*.` };
  equipo[slot] = null;
  if (!equipo.inventarioEquipo) equipo.inventarioEquipo = [];
  equipo.inventarioEquipo.push(previo);
  r.arma = equipo.arma ? equipo.arma.clave : null;
  return { exito: true, item: previo, slot };
};

// ---------------------------------------------------------------------------
// Bonos totales del equipo equipado (stats + afijos + sets + mejoras).
// ---------------------------------------------------------------------------
const bonosEquipo = (u) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u); // asegura migración de equipo legado
  const total = { atk: 0, def: 0, hp: 0, ki: 0, vel: 0, crit: 0, roboHp: 0 };
  const cuentaSets = {};
  for (const slot of SLOTS) {
    const item = equipo[slot];
    if (!item) continue;
    const datos = obtenerItem(item.clave);
    if (!datos) continue;
    const rareza = item.rareza || datos.rareza || 'Comun';
    const mult = (RAREZAS[rareza] || RAREZAS.Comun).mult;
    const base = datos.base || {};
    for (const stat of ['atk', 'def', 'hp', 'ki', 'vel', 'crit', 'roboHp']) {
      total[stat] += Math.round((base[stat] || 0) * mult);
    }
    // Cada nivel de mejora (+1..+10): +2 ATK y +5 HP por nivel.
    const nivel = item.nivel || 0;
    if (nivel > 0) {
      total.atk += nivel * 2;
      total.hp += nivel * 5;
    }
    // Afijos.
    for (const af of item.afijos || []) {
      const conf = AFIJOS[af];
      if (conf) total[conf.efecto] += conf.valor;
    }
    // Cuenta para sets.
    const setKey = PIEZA_SET[item.clave];
    if (setKey) cuentaSets[setKey] = (cuentaSets[setKey] || 0) + 1;
  }
  // Bonus de set: 3 piezas del mismo set.
  for (const [setKey, conta] of Object.entries(cuentaSets)) {
    const set = SETS[setKey];
    if (set && conta >= set.piezas) {
      for (const [stat, val] of Object.entries(set.bono || {})) {
        total[stat] = (total[stat] || 0) + val;
      }
    }
  }
  return total;
};

// ---------------------------------------------------------------------------
// Forjar un item nuevo (costo en oro + materiales). Lo equipa si el slot está
// vacío, si no va al inventario de equipo.
// ---------------------------------------------------------------------------
const forjar = (u, slot, clave) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  if (!SLOTS.includes(slot)) return { error: 'Slot inválido.' };
  const datos = obtenerItem(clave);
  if (!datos || datos.slot !== slot) return { error: 'Item no válido para ese slot.' };
  if (equipo[slot]) return { error: `Ya tienes algo equipado en *${slot}*. Usá #equipo desequipar ${slot} primero.` };
  const rareza = datos.rareza;
  const costoOro = Math.round(datos.precio);
  const materiales = MATERIAL_COSTO_MEJORA[rareza] || [];
  const costoMateriales = {};
  for (const m of materiales) costoMateriales[m] = (costoMateriales[m] || 0) + 1;
  // Oro
  if ((u.cash || 0) < costoOro) return { error: `No tienes suficiente oro. Costo: ${money(costoOro)}.` };
  // Materiales en r.materiales (minerales y pescado pasan a materiales)
  const mat = r.materiales || {};
  for (const [m, cant] of Object.entries(costoMateriales)) {
    if ((mat[m] || 0) < cant) {
      return { error: `Te faltan materiales: *${MATERIALES[m].nombre}* x${cant}. Conseguilos con #minar o #pescar.` };
    }
  }
  // Aplica costo.
  u.cash = Math.max(0, u.cash - costoOro);
  for (const [m, cant] of Object.entries(costoMateriales)) {
    mat[m] = Math.max(0, (mat[m] || 0) - cant);
  }
  r.materiales = mat;
  const item = crearItem(clave, 0);
  equipo[slot] = item;
  r.arma = equipo.arma ? equipo.arma.clave : null;
  return {
    exito: true,
    item,
    slot,
    costoOro,
    costoMateriales,
    texto: `✅ Forjaste *${item.nombre}* (${rareza}, nivel 0) por ${money(costoOro)}.`,
  };
};

// ---------------------------------------------------------------------------
// Mejorar el item equipado en un slot: +1 nivel (máx +10), riesgo creciente,
// costo en oro y materiales. Si falla, se pierden los materiales.
// ---------------------------------------------------------------------------
const PROB_EXITO_POR_NIVEL = [1.00, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.60, 0.50, 0.40];

const mejorar = (u, slot) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  if (!SLOTS.includes(slot)) return { error: 'Slot inválido.' };
  const item = equipo[slot];
  if (!item) return { error: `No tienes nada equipado en *${slot}*.` };
  const nivelActual = item.nivel || 0;
  if (nivelActual >= 10) return { error: 'Ese item ya está en su mejora máxima (+10).' };
  const raroza = item.rareza || 'Comun';
  const siguiente = nivelActual + 1;
  const prob = PROB_EXITO_POR_NIVEL[nivelActual] || 0.30;
  const costoOro = Math.round(500 * RAREZAS[raroza].mult * siguiente);
  const materiales = MATERIAL_COSTO_MEJORA[raroza] || [];
  const costoMateriales = {};
  for (const m of materiales) costoMateriales[m] = (costoMateriales[m] || 0) + siguiente;
  if ((u.cash || 0) < costoOro) return { error: `No tienes suficiente oro. Costo: ${money(costoOro)}.` };
  const mat = r.materiales || {};
  for (const [m, cant] of Object.entries(costoMateriales)) {
    if ((mat[m] || 0) < cant) {
      return { error: `Te faltan materiales para mejorar a +${siguiente}.` };
    }
  }
  // Tira de éxito.
  const exito = Math.random() < prob;
  u.cash = Math.max(0, u.cash - costoOro);
  if (!exito) {
    for (const [m, cant] of Object.entries(costoMateriales)) {
      mat[m] = Math.max(0, (mat[m] || 0) - cant);
    }
    r.materiales = mat;
    return {
      exito: false,
      item,
      slot,
      nivel: nivelActual,
      costoOro,
      texto: `❌ La mejora a +${siguiente} falló. Perdiste los materiales y ${money(costoOro)}. El item queda +${nivelActual}.`,
    };
  }
  for (const [m, cant] of Object.entries(costoMateriales)) {
    mat[m] = Math.max(0, (mat[m] || 0) - cant);
  }
  r.materiales = mat;
  item.nivel = siguiente;
  r.arma = equipo.arma ? equipo.arma.clave : null;
  return {
    exito: true,
    item,
    slot,
    nivel: siguiente,
    costoOro,
    texto: `✨ ¡*${item.nombre}* mejorado a +${siguiente}! (probabilidad era ${Math.round(prob * 100)}%)`,
  };
};

// ---------------------------------------------------------------------------
// Reparar durabilidad de todo el equipo equipado (sumidero de oro).
// ---------------------------------------------------------------------------
const reparar = (u) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  if (!DURABILIDAD.activada) return { error: 'La durabilidad está desactivada.' };
  let totalCosto = 0;
  let reparados = 0;
  for (const slot of SLOTS) {
    const item = equipo[slot];
    if (!item) continue;
    const falta = item.durabilidadMax - item.durabilidad;
    if (falta <= 0) continue;
    const datos = obtenerItem(item.clave);
    const valorBase = (datos && datos.precio) || 1000;
    const raroza = item.rareza || 'Comun';
    const costoPunto = Math.round(valorBase * DURABILIDAD.costoRepararPct * RAREZAS[raroza].mult);
    const costo = falta * costoPunto;
    totalCosto += costo;
    item.durabilidad = item.durabilidadMax;
    reparados += 1;
  }
  if (reparados === 0) return { error: 'Todo tu equipo está en perfecto estado.' };
  if ((u.cash || 0) < totalCosto) return { error: `No tienes suficiente oro para reparar. Costo: ${money(totalCosto)}.` };
  u.cash = Math.max(0, u.cash - totalCosto);
  return { exito: true, costo: totalCosto, reparados, texto: `🔧 Equipo reparado por ${money(totalCosto)}.` };
};

// ---------------------------------------------------------------------------
// Gastar durabilidad tras un combate (llamar desde post-combate).
// ---------------------------------------------------------------------------
const gastarDurabilidad = (u) => {
  const r = ensureRPG(u);
  const equipo = r.equipo || {};
  if (!DURABILIDAD.activada) return;
  for (const slot of SLOTS) {
    const item = equipo[slot];
    if (!item) continue;
    item.durabilidad = Math.max(0, item.durabilidad - DURABILIDAD.danoPorCombate);
  }
};

// ---------------------------------------------------------------------------
// Listado para mostrar.
// ---------------------------------------------------------------------------
const listarEquipo = (u) => {
  const r = ensureRPG(u);
  const equipo = equipoDe(u);
  let txt = '🎒 *Tu Equipo*\n';
  for (const slot of SLOTS) {
    const item = equipo[slot];
    if (!item) {
      txt += `\n• *${slot}*: vacío`;
      continue;
    }
    const mejoras = item.nivel > 0 ? ` +${item.nivel}` : '';
    const afijosTxt = item.afijos && item.afijos.length
      ? ` [${item.afijos.map((a) => AFIJOS[a].nombre).join(', ')}]`
      : '';
    const dur = DURABILIDAD.activada
      ? ` | Dur: ${item.durabilidad}/${item.durabilidadMax}`
      : '';
    txt += `\n• *${slot}*: *${item.nombre}${MEJORA_NOMBRE(item.nivel)}${afijosTxt}${dur}*`;
  }
  if (equipo.inventarioEquipo && equipo.inventarioEquipo.length) {
    txt += '\n\n🎁 *Inventario de equipo*:';
    for (const item of equipo.inventarioEquipo) {
      txt += `\n• ${item.nombre} (${item.slot})`;
    }
  }
  const bonos = bonosEquipo(u);
  txt += '\n\n📊 *Bonos activos*:';
  txt += `\n⚔️ ATK +${bonos.atk} | 🛡️ DEF +${bonos.def} | ❤️ HP +${bonos.hp} | 🌀 Ki +${bonos.ki} | 💨 VEL +${bonos.vel} | 🎯 Crit +${bonos.crit}% | 🩸 RoboVida +${bonos.roboHp}%`;
  return txt;
};

module.exports = {
  SLOTS,
  CATALOGO,
  obtenerItem,
  crearItem,
  equipoDe,
  equipar,
  desequipar,
  bonosEquipo,
  forjar,
  mejorar,
  reparar,
  gastarDurabilidad,
  listarEquipo,
  RAREZAS,
  AFIJOS,
  MATERIALES,
};
