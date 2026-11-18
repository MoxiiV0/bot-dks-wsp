// Datos de clases: bases, pasivas, evoluciones por elección y secundarias.
// FASE 4: clases renombradas estilo anime según la tabla del prompt maestro.
// Todo el contenido es DATA — cero números mágicos en la lógica.

// --- Clases primarias (disponibles desde el inicio) -------------------------
// Crec. por nivel HP/Ki/ATK/DEF (FASE 3) + bases FASE 4 + pasiva FASE 4.
const CLASSES = {
  kensei: {
    nombre: '⚔️ Kensei', rol: 'Bruiser / tanque',
    hpBase: 130, kiBase: 60, atkBase: 16, defBase: 10, velBase: 8,
    crec: { hp: 14, ki: 3, atk: 2.2, def: 1.6 },
    pasiva: {
      clave: 'voluntad_acero', nombre: 'Voluntad de Acero',
      desc: 'Bajo 30% de HP, +25% DEF.',
      descMayor: 'Bajo 40% de HP, +35% DEF y +10% ATK.',
      efecto: { umbralHp: 0.3, defPct: 0.25 },
      efectoMayor: { umbralHp: 0.4, defPct: 0.35, atkPct: 0.1 },
    },
    desc: 'Resistente y fuerte en cuerpo a cuerpo. Aguanta lo que otros no.',
  },
  onmyoji: {
    nombre: '🔮 Onmyōji', rol: 'Daño explosivo elemental',
    hpBase: 85, kiBase: 120, atkBase: 22, defBase: 4, velBase: 9,
    crec: { hp: 8, ki: 7, atk: 3.0, def: 0.7 },
    pasiva: {
      clave: 'sellos_elementales', nombre: 'Sellos Elementales',
      desc: 'Encadenar fuego, viento, rayo y agua en orden da +20% de daño.',
      descMayor: 'Encadenar los cuatro elementos en orden da +35% de daño.',
      efecto: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.2 },
      efectoMayor: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.35 },
    },
    desc: 'Daño mágico elemental devastador con poca defensa.',
  },
  hayate: {
    nombre: '🏹 Cazador Hayate', rol: 'Crítico a distancia',
    hpBase: 100, kiBase: 80, atkBase: 17, defBase: 6, velBase: 14,
    crec: { hp: 10, ki: 4, atk: 2.4, def: 1.0 },
    pasiva: {
      clave: 'ojo_halcon', nombre: 'Ojo de Halcón',
      desc: '+12% de probabilidad de crítico y +0.3 al multiplicador crítico.',
      descMayor: '+20% de probabilidad de crítico y +0.5 al multiplicador.',
      efecto: { critProb: 0.12, critMult: 0.3 },
      efectoMayor: { critProb: 0.2, critMult: 0.5 },
    },
    desc: 'Críticos a distancia y ojo implacable.',
  },
  shinobi: {
    nombre: '🌑 Shinobi', rol: 'Esquiva y combos',
    hpBase: 92, kiBase: 90, atkBase: 18, defBase: 5, velBase: 18,
    crec: { hp: 9, ki: 5, atk: 2.5, def: 0.9 },
    pasiva: {
      clave: 'paso_fantasma', nombre: 'Paso Fantasma',
      desc: '+10% de esquiva; tras esquivar, el siguiente golpe hace +30%.',
      descMayor: '+18% de esquiva y +50% al golpe tras esquivar.',
      efecto: { esquiva: 0.1, golpePostEsquiva: 0.3 },
      efectoMayor: { esquiva: 0.18, golpePostEsquiva: 0.5 },
    },
    desc: 'Esquiva, sigilo y combos rápidos.',
  },
};

// --- Clases secundarias (nivel 10, misión especial) --------------------------
const NUEVAS_CLASES = {
  shikigami: {
    nombre: '🦊 Shikigami', rol: 'Control con espíritus',
    hpBase: 95, kiBase: 100, atkBase: 14, defBase: 6, velBase: 11,
    crec: { hp: 9, ki: 6, atk: 1.8, def: 0.9 },
    pasiva: {
      clave: 'pacto', nombre: 'Pacto',
      desc: 'El espíritu activo hereda el 60% de tus stats.',
      descMayor: 'El espíritu activo hereda el 80% de tus stats.',
      efecto: { heredaPct: 0.6 },
      efectoMayor: { heredaPct: 0.8 },
    },
    desc: 'Controla espíritus que luchan a tu lado.',
  },
  medium_yurei: {
    nombre: '👻 Médium Yūrei', rol: 'Maldiciones y robo de vida',
    hpBase: 85, kiBase: 110, atkBase: 19, defBase: 4, velBase: 10,
    crec: { hp: 8, ki: 6, atk: 2.6, def: 0.7 },
    pasiva: {
      clave: 'susurro', nombre: 'Susurro',
      desc: '10% del daño infligido se convierte en HP.',
      descMayor: '18% del daño infligido se convierte en HP.',
      efecto: { roboHpPct: 0.1 },
      efectoMayor: { roboHpPct: 0.18 },
    },
    desc: 'Maldiciones, robo de vida y magia fúnebre.',
  },
};

// --- Evoluciones por elección (Prueba de Ascenso, nivel 15) ------------------
// Dos caminos por clase. Stats propias; crecimiento/ki/vel/pasiva se heredan
// de la clase base (ver CLASE_BASE y los helpers).
const CLASES_EVOLUCION = {
  // Kensei
  shogun_carmesi: { nombre: '🏯 Shōgun Carmesí', hpBase: 165, atkBase: 21, defBase: 15, desc: 'Tanque con contraataques demoledores.' },
  hoja_celestial: { nombre: '🌙 Hoja Celestial', hpBase: 140, atkBase: 26, defBase: 11, desc: 'Duelista de críticos letales.' },
  // Onmyōji
  maestro_sellos: { nombre: '📜 Maestro de los Sellos', hpBase: 95, atkBase: 24, defBase: 7, desc: 'Control y apoyo con sellos.' },
  archimago_vacio: { nombre: '🌌 Archimago del Vacío', hpBase: 90, atkBase: 30, defBase: 5, desc: 'Daño mágico máximo sin concesiones.' },
  // Hayate
  francotirador_espectral: { nombre: '🎯 Francotirador Espectral', hpBase: 108, atkBase: 24, defBase: 7, desc: 'Un disparo, un objetivo menos.' },
  domador_tormentas: { nombre: '⛈️ Domador de Tormentas', hpBase: 112, atkBase: 20, defBase: 8, desc: 'Balancea control y daño a distancia.' },
  // Shinobi
  sombra_carmesi: { nombre: '🗡️ Sombra Carmesí', hpBase: 105, atkBase: 27, defBase: 7, desc: 'Asesino de golpes definitivos.' },
  maestro_ilusiones: { nombre: '🌫️ Maestro de Ilusiones', hpBase: 100, atkBase: 22, defBase: 9, desc: 'Engaña y confunde antes de atacar.' },
  // Shikigami
  senior_bestias: { nombre: '🐺 Señor de las Bestias', hpBase: 105, atkBase: 18, defBase: 8, desc: 'Manada de bestias a su mando.' },
  pacto_celestial: { nombre: '✨ Pacto Celestial', hpBase: 100, atkBase: 17, defBase: 9, desc: 'Espíritus celestiales de apoyo.' },
  // Médium Yūrei
  nigromante_real: { nombre: '👑 Nigromante Real', hpBase: 92, atkBase: 24, defBase: 6, desc: 'Señor absoluto de los muertos.' },
  ejecutor_espectral: { nombre: '⚡ Ejecutor Espectral', hpBase: 88, atkBase: 27, defBase: 5, desc: 'Ejecuta con robo de vida masivo.' },
};

// Prueba de Ascenso: dos caminos por clase (nivel 15). `nombre` es la clave
// de CLASES_EVOLUCION. `mayor` = Despertar Mayor disponible desde el nivel 35.
const EVOLUCIONES_CLASE = {
  kensei: [
    { nombre: 'shogun_carmesi', requisito: 15, costo: 0 },
    { nombre: 'hoja_celestial', requisito: 15, costo: 0 },
  ],
  onmyoji: [
    { nombre: 'maestro_sellos', requisito: 15, costo: 0 },
    { nombre: 'archimago_vacio', requisito: 15, costo: 0 },
  ],
  hayate: [
    { nombre: 'francotirador_espectral', requisito: 15, costo: 0 },
    { nombre: 'domador_tormentas', requisito: 15, costo: 0 },
  ],
  shinobi: [
    { nombre: 'sombra_carmesi', requisito: 15, costo: 0 },
    { nombre: 'maestro_ilusiones', requisito: 15, costo: 0 },
  ],
  shikigami: [
    { nombre: 'senior_bestias', requisito: 15, costo: 0 },
    { nombre: 'pacto_celestial', requisito: 15, costo: 0 },
  ],
  medium_yurei: [
    { nombre: 'nigromante_real', requisito: 15, costo: 0 },
    { nombre: 'ejecutor_espectral', requisito: 15, costo: 0 },
  ],
};

// Despertar Mayor (nivel 35): la rama elegida mejora su pasiva.
const DESPERTAR_MAYOR = { requisito: 35 };

// Rama evolucionada -> clase base (heredan crecimiento, ki/vel y pasiva)
const CLASE_BASE = {
  shogun_carmesi: 'kensei',
  hoja_celestial: 'kensei',
  maestro_sellos: 'onmyoji',
  archimago_vacio: 'onmyoji',
  francotirador_espectral: 'hayate',
  domador_tormentas: 'hayate',
  sombra_carmesi: 'shinobi',
  maestro_ilusiones: 'shinobi',
  senior_bestias: 'shikigami',
  pacto_celestial: 'shikigami',
  nigromante_real: 'medium_yurei',
  ejecutor_espectral: 'medium_yurei',
};

// Ki/VEL por defecto para quien no tiene clase todavía (data, no número mágico)
const KI_SIN_CLASE = 100;
const VEL_SIN_CLASE = 5;

// Lookup de clase: primarias + secundarias + ramas de evolución
const getClass = (key) =>
  (key ? (CLASSES[key] || NUEVAS_CLASES[key] || CLASES_EVOLUCION[key] || null) : null);

// Clave de clase base para efectos compartidos (skills, crecimiento, pasivas)
const baseClassKey = (key) => CLASE_BASE[key] || key;

// true si la clase es secundaria (se elige al nivel 10, no desde el inicio)
const esClaseSecundaria = (key) => !CLASSES[key] && !!NUEVAS_CLASES[key];

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

// Pasiva de la clase (las ramas heredan la de su base). FASE 4/5.
const pasivaDe = (key, despertarMayor = false) => {
  const c = getClass(key);
  let p = c && c.pasiva ? c.pasiva : null;
  if (!p) {
    const b = getClass(baseClassKey(key));
    p = b && b.pasiva ? b.pasiva : null;
  }
  if (!p) return null;
  const efecto = (despertarMayor && p.efectoMayor) || p.efecto || {};
  return { ...p, efecto, mayor: despertarMayor && !!p.efectoMayor };
};

module.exports = {
  CLASSES,
  NUEVAS_CLASES,
  CLASES_EVOLUCION,
  EVOLUCIONES_CLASE,
  DESPERTAR_MAYOR,
  CLASE_BASE,
  KI_SIN_CLASE,
  VEL_SIN_CLASE,
  getClass,
  baseClassKey,
  esClaseSecundaria,
  getGrowth,
  kiBaseDe,
  velBaseDe,
  pasivaDe,
};
