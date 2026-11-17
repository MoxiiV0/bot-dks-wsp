// Datos de clases: bases, evoluciones y secundarias.
// Todo el contenido es DATA — cero números mágicos en la lógica.

// FASE 3 — crecimiento por nivel (tabla FASE 4, valores ya en DATA) y
// bases de Ki/VEL. Las evoluciones NO llevan crec: heredan de su clase base.
const CLASSES = {
  guerrero: { nombre: '🛡️ Guerrero', hpBase: 120, atkBase: 15, defBase: 8, kiBase: 60, velBase: 8, crec: { hp: 14, ki: 3, atk: 2.2, def: 1.6 }, desc: 'Resistente y fuerte en combate cuerpo a cuerpo.' },
  mago: { nombre: '🔮 Mago', hpBase: 80, atkBase: 20, defBase: 4, kiBase: 120, velBase: 9, crec: { hp: 8, ki: 7, atk: 3.0, def: 0.7 }, desc: 'Daño mágico alto, poca defensa.' },
  arquero: { nombre: '🏹 Arquero', hpBase: 100, atkBase: 16, defBase: 6, kiBase: 80, velBase: 14, crec: { hp: 10, ki: 4, atk: 2.4, def: 1.0 }, desc: 'Ataques a distancia y precisión.' },
  pícaro: { nombre: '🗡️ Pícaro', hpBase: 90, atkBase: 17, defBase: 5, kiBase: 90, velBase: 18, crec: { hp: 9, ki: 5, atk: 2.5, def: 0.9 }, desc: 'Críticos frecuentes y sigilo.' },
};

// Ki/VEL por defecto para quien no tiene clase todavía (data, no número mágico)
const KI_SIN_CLASE = 100;
const VEL_SIN_CLASE = 5;

const NUEVAS_CLASES = {
  asesino: { nombre: '🔪 Asesino', hpBase: 100, atkBase: 22, defBase: 6, desc: 'Maestro del sigilo y golpes mortales.' },
  gran_arquero: { nombre: '🏹 Gran Arquero', hpBase: 110, atkBase: 20, defBase: 7, desc: 'Experto en arquería y trampas a distancia.' },
  caballero: { nombre: '⚔️ Caballero', hpBase: 150, atkBase: 18, defBase: 12, desc: 'Guerrero elite con armadura pesada y honor.' },
  archimago: { nombre: '🔮 Archimago', hpBase: 90, atkBase: 25, defBase: 5, desc: 'Maestro de las artes arcanas y elementos.' },
  invocador: { nombre: '👹 Invocador', hpBase: 95, atkBase: 14, defBase: 6, kiBase: 100, velBase: 11, crec: { hp: 9, ki: 6, atk: 1.8, def: 0.9 }, desc: 'Domador de bestias y maestro de invocaciones.' },
  nigromante: { nombre: '💀 Nigromante', hpBase: 85, atkBase: 19, defBase: 4, kiBase: 110, velBase: 10, crec: { hp: 8, ki: 6, atk: 2.6, def: 0.7 }, desc: 'Controla los muertos y la magia oscura.' },
};

const EVOLUCIONES_CLASE = {
  pícaro: { nombre: 'asesino', requisito: 15, costo: 0 },
  arquero: { nombre: 'gran_arquero', requisito: 15, costo: 0 },
  guerrero: { nombre: 'caballero', requisito: 15, costo: 0 },
  mago: { nombre: 'archimago', requisito: 15, costo: 0 },
};

// Clase evolucionada -> clase base (las evoluciones heredan skills de la base)
const CLASE_BASE = {
  asesino: 'pícaro',
  gran_arquero: 'arquero',
  caballero: 'guerrero',
  archimago: 'mago',
};

// Lookup de clase que incluye evoluciones y clases secundarias
const getClass = (key) => (key ? (CLASSES[key] || NUEVAS_CLASES[key] || null) : null);

// Clave de clase base para efectos compartidos (skills, combinaciones)
const baseClassKey = (key) => CLASE_BASE[key] || key;

// --- FASE 3: crecimiento/ki/vel por clase -----------------------------------
// Las evoluciones heredan los de su clase base; sin clase, null (0 crecimiento).
const getGrowth = (key) => {
  const c = getClass(key);
  if (c && c.crec) return c.crec;
  if (!c) return null;
  const b = getClass(baseClassKey(key));
  return b && b.crec ? b.crec : null;
};

const kiBaseDe = (key) => {
  if (!key) return KI_SIN_CLASE;
  const c = getClass(key);
  if (c && c.kiBase != null) return c.kiBase;
  const b = getClass(baseClassKey(key));
  if (b && b.kiBase != null) return b.kiBase;
  return KI_SIN_CLASE;
};

const velBaseDe = (key) => {
  if (!key) return VEL_SIN_CLASE;
  const c = getClass(key);
  if (c && c.velBase != null) return c.velBase;
  const b = getClass(baseClassKey(key));
  if (b && b.velBase != null) return b.velBase;
  return VEL_SIN_CLASE;
};

// true si la clase es secundaria (se elige al nivel 10, no desde el inicio)
const esClaseSecundaria = (key) => !CLASSES[key] && !!NUEVAS_CLASES[key];

module.exports = {
  CLASSES,
  NUEVAS_CLASES,
  EVOLUCIONES_CLASE,
  CLASE_BASE,
  KI_SIN_CLASE,
  VEL_SIN_CLASE,
  getClass,
  baseClassKey,
  esClaseSecundaria,
  getGrowth,
  kiBaseDe,
  velBaseDe,
};
