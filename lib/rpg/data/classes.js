// Datos de clases: bases, evoluciones y secundarias.
// Todo el contenido es DATA — cero números mágicos en la lógica.

const CLASSES = {
  guerrero: { nombre: '🛡️ Guerrero', hpBase: 120, atkBase: 15, defBase: 8, desc: 'Resistente y fuerte en combate cuerpo a cuerpo.' },
  mago: { nombre: '🔮 Mago', hpBase: 80, atkBase: 20, defBase: 4, desc: 'Daño mágico alto, poca defensa.' },
  arquero: { nombre: '🏹 Arquero', hpBase: 100, atkBase: 16, defBase: 6, desc: 'Ataques a distancia y precisión.' },
  pícaro: { nombre: '🗡️ Pícaro', hpBase: 90, atkBase: 17, defBase: 5, desc: 'Críticos frecuentes y sigilo.' },
};

const NUEVAS_CLASES = {
  asesino: { nombre: '🔪 Asesino', hpBase: 100, atkBase: 22, defBase: 6, desc: 'Maestro del sigilo y golpes mortales.' },
  gran_arquero: { nombre: '🏹 Gran Arquero', hpBase: 110, atkBase: 20, defBase: 7, desc: 'Experto en arquería y trampas a distancia.' },
  caballero: { nombre: '⚔️ Caballero', hpBase: 150, atkBase: 18, defBase: 12, desc: 'Guerrero elite con armadura pesada y honor.' },
  archimago: { nombre: '🔮 Archimago', hpBase: 90, atkBase: 25, defBase: 5, desc: 'Maestro de las artes arcanas y elementos.' },
  invocador: { nombre: '👹 Invocador', hpBase: 95, atkBase: 14, defBase: 6, desc: 'Domador de bestias y maestro de invocaciones.' },
  nigromante: { nombre: '💀 Nigromante', hpBase: 85, atkBase: 19, defBase: 4, desc: 'Controla los muertos y la magia oscura.' },
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

// true si la clase es secundaria (se elige al nivel 10, no desde el inicio)
const esClaseSecundaria = (key) => !CLASSES[key] && !!NUEVAS_CLASES[key];

module.exports = {
  CLASSES,
  NUEVAS_CLASES,
  EVOLUCIONES_CLASE,
  CLASE_BASE,
  getClass,
  baseClassKey,
  esClaseSecundaria,
};
