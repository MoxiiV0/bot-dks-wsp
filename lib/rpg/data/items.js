// Datos de equipo y objetos: armas, casas, cofres, clases de arma, entrenamiento y mana.

const WEAPONS = {
  nada: { nombre: 'Puños', atk: 0, precio: 0 },
  espada_hierro: { nombre: '⚔️ Espada de Hierro', atk: 8, precio: 1500 },
  arco_corto: { nombre: '🏹 Arco Corto', atk: 7, precio: 1400 },
  baston_madera: { nombre: '🪵 Bastón de Madera', atk: 6, precio: 1200 },
  daga_aguda: { nombre: '🗡️ Daga Aguda', atk: 7, precio: 1300 },
  espada_acero: { nombre: '⚔️ Espada de Acero', atk: 14, precio: 4000 },
  arco_largo: { nombre: '🏹 Arco Largo', atk: 13, precio: 3800 },
  baston_cristal: { nombre: '🔮 Bastón de Cristal', atk: 12, precio: 3500 },
  daga_venenosa: { nombre: '🗡️ Daga Venenosa', atk: 12, precio: 3600 },
  espada_dragón: { nombre: '🐉 Espada del Dragón', atk: 25, precio: 15000 },
  arco_elfico: { nombre: '🏹 Arco Elfo', atk: 23, precio: 14000 },
  baston_arca: { nombre: '🔮 Bastón Arcano', atk: 21, precio: 13000 },
  daga_sombría: { nombre: '🗡️ Daga Sombría', atk: 22, precio: 13500 },
};

const HOUSES = {
  choza: { nombre: '🏠 Choza', precio: 5000, beneficio: 'hp', valor: 10 },
  cabaña: { nombre: '🌲 Cabaña', precio: 15000, beneficio: 'hp', valor: 25 },
  casa: { nombre: '🏡 Casa', precio: 40000, beneficio: 'hp', valor: 50 },
  mansión: { nombre: '🏰 Mansión', precio: 100000, beneficio: 'atk', valor: 5 },
  castillo: { nombre: '🏰 Castillo', precio: 250000, beneficio: 'all', valor: 10 },
};

const CHESTS = {
  comun: { nombre: '📦 Cofre Común', costo: 500, min: 200, max: 1500, trampa: 5, objProb: 25 },
  raro: { nombre: '🎁 Cofre Raro', costo: 1500, min: 1000, max: 4000, trampa: 15, objProb: 40 },
  epico: { nombre: '✨ Cofre Épico', costo: 5000, min: 3000, max: 12000, trampa: 25, objProb: 60 },
  legendario: { nombre: '👑 Cofre Legendario', costo: 15000, min: 10000, max: 50000, trampa: 40, objProb: 80 },
};

// FASE 5 — Objetos de combate (acción #obj). Se guardan en r.inventario
// {id: cantidad} y se consumen en combate. Efectos: DATA pura.
const OBJETOS_COMBATE = {
  pocion_hp: {
    id: 'pocion_hp', nombre: '🧪 Poción de Vida',
    desc: 'Restaura 40% de tu HP máximo.',
    efecto: { tipo: 'curaHp', pct: 0.4 },
  },
  pocion_ki: {
    id: 'pocion_ki', nombre: '🌀 Tónico de Ki',
    desc: 'Restaura 50% de tu Ki.',
    efecto: { tipo: 'curaKi', pct: 0.5 },
  },
  elixir: {
    id: 'elixir', nombre: '🍹 Elixir Mayor',
    desc: 'Restaura 30% de HP y 30% de Ki.',
    efecto: { tipo: 'curaAmbos', pct: 0.3 },
  },
  antidoto: {
    id: 'antidoto', nombre: '🌿 Antídoto',
    desc: 'Cura los estados negativos (sangrado, veneno, quemadura).',
    efecto: { tipo: 'curaEstados', negativos: ['sangrado', 'quemadura', 'veneno', 'aturdido', 'congelado'] },
  },
  talisman: {
    id: 'talisman', nombre: '📜 Talismán de Furia',
    desc: 'Te otorga Furia 3 turnos (+25% ATK).',
    efecto: { tipo: 'estado', id: 'furia', turnos: 3, objetivo: 'self' },
  },
};

const WEAPON_CLASSES = {
  espada: { nombre: '🗡️ Espada', bonificacion: 'atk', valor: 2, desc: 'Ataque equilibrado y confiable.' },
  arco: { nombre: '🏹 Arco', bonificacion: 'crit', valor: 5, desc: 'Mayor probabilidad de golpe crítico.' },
  baston: { nombre: '🪵 Bastón', bonificacion: 'exp', valor: 10, desc: 'Ganas más experiencia en combate.' },
  daga: { nombre: '🔪 Daga', bonificacion: 'velocidad', valor: 3, desc: 'Ataques más rápidos, más turnos.' },
};

// FASE 3 — sistema de puntos de atributo (#entrenar) y reinicio con costo en oro.
// Los bonuses se multiplican por los puntos invertidos en cada atributo.
const ENTRENAMIENTO = {
  puntosPorNivel: 2,
  reinicio: { base: 500, porNivel: 100 }, // costo de #reiniciar = base + porNivel * nivel
  atributos: {
    atk: { nombre: '⚔️ Fuerza', porPunto: 2, desc: '+2 ATK por punto' },
    def: { nombre: '🛡️ Defensa', porPunto: 1, desc: '+1 DEF por punto' },
    hp: { nombre: '❤️ Vitalidad', porPunto: 10, desc: '+10 HP máximo por punto' },
    ki: { nombre: '🌀 Ki', porPunto: 5, desc: '+5 Ki máximo por punto' },
    vel: { nombre: '💨 Velocidad', porPunto: 0.5, desc: '+0.5 VEL por punto' },
  },
};

// FASE 3 — descanso en la posada: recuperación instantánea con costo y espera.
const DESCANSO = {
  costo: 500,
  restauraPct: 1, // 100% de HP y Ki
  cooldownMs: 10 * 60 * 1000,
};

// FASE 3 — regeneración por tiempo (sin timers): se aplica al consultar.
const REGEN = {
  hpPctPorMinuto: 1,
  kiPctPorMinuto: 2,
  intervaloMs: 60 * 1000,
};

const MANA = {
  costoLeer: 500,
  gananciaLeer: 10,
  costoUsar: 25,
};

// ---------------------------------------------------------------------------
// FASE 9 — Equipo, loot y forja.
// Slots: arma, armadura, accesorio, reliquia. Rarezas: Común, Raro, Épico,
// Legendario, Mítico.
// Familias de arma por clase: Katana (Kensei), Tomo de Sellos (Onmyōji),
// Arco Yumi (Hayate), Kodachi (Shinobi), Talismán (Shikigami),
// Campana Fúnebre (Médium Yūrei).
// Afijos aleatorios según rareza. Sets de 3 piezas con bono.
// #forjar mejora de +1 a +10 con riesgo creciente y costo en oro y materiales.
// Todo es DATA pura (cero números mágicos en la lógica).
// ---------------------------------------------------------------------------

// Config por rareza: multiplicador de stats, nº de afijos, precio relativo,
// durabilidad inicial.
const RAREZAS = {
  Comun:    { mult: 1.0,  afijos: 0, precio: 1,   durabilidad: 100 },
  Raro:     { mult: 1.4,  afijos: 1, precio: 4,   durabilidad: 120 },
  Epico:    { mult: 2.0,  afijos: 2, precio: 10,  durabilidad: 140 },
  Legendario: { mult: 3.0, afijos: 3, precio: 30, durabilidad: 160 },
  Mitico:   { mult: 4.5,  afijos: 4, precio: 90,  durabilidad: 200 },
};

const RAREZAS_ORDENADA = ['Comun', 'Raro', 'Epico', 'Legendario', 'Mitico'];

// Familias de arma por clase (FASE 9).
const FAMILIAS_ARMA = {
  kensei:       { nombre: 'Katana',            emoji: '⚔️', slotBonus: 'atk' },
  onmyoji:      { nombre: 'Tomo de Sellos',    emoji: '📜', slotBonus: 'ki' },
  hayate:       { nombre: 'Arco Yumi',         emoji: '🏹', slotBonus: 'crit' },
  shinobi:      { nombre: 'Kodachi',           emoji: '🔪', slotBonus: 'vel' },
  shikigami:    { nombre: 'Talismán',          emoji: '🪯', slotBonus: 'invocar' },
  medium_yurei: { nombre: 'Campana Fúnebre',   emoji: '🔔', slotBonus: 'roboHp' },
};

// Nombres de nivel de mejora (FASE 9: +1 a +10).
const MEJORA_NOMBRE = (nivel) => (nivel <= 0 ? '' : ` +${nivel}`);

// Estadísticas base por slot y tipo de pieza (antes de aplicar rareza).
const EQUIPO_BASE = {
  arma: {
    kensei:       { atk: 6,  hp: 0,  def: 0,  ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
    onmyoji:      { atk: 4,  hp: 0,  def: 0,  ki: 6,  vel: 0,  crit: 0,  roboHp: 0 },
    hayate:       { atk: 5,  hp: 0,  def: 0,  ki: 0,  vel: 2,  crit: 1,  roboHp: 0 },
    shinobi:      { atk: 5,  hp: 0,  def: 0,  ki: 0,  vel: 3,  crit: 0,  roboHp: 0 },
    shikigami:    { atk: 3,  hp: 0,  def: 0,  ki: 4,  vel: 1,  crit: 0,  roboHp: 0 },
    medium_yurei: { atk: 4,  hp: 0,  def: 0,  ki: 3,  vel: 0,  crit: 0,  roboHp: 1 },
  },
  armadura: {
    Comun:    { atk: 0,  hp: 20, def: 3,  ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
    Raro:     { atk: 0,  hp: 30, def: 5,  ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
    Epico:    { atk: 0,  hp: 45, def: 8,  ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
    Legendario: { atk: 0, hp: 65, def: 12, ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
    Mitico:   { atk: 0, hp: 95, def: 18, ki: 0,  vel: 0,  crit: 0,  roboHp: 0 },
  },
  accesorio: {
    Comun:    { atk: 0,  hp: 0,  def: 0,  ki: 0,  vel: 1,  crit: 0,  roboHp: 0 },
    Raro:     { atk: 0,  hp: 0,  def: 0,  ki: 0,  vel: 2,  crit: 1,  roboHp: 0 },
    Epico:    { atk: 0,  hp: 0,  def: 0,  ki: 0,  vel: 3,  crit: 2,  roboHp: 0 },
    Legendario: { atk: 0, hp: 0,  def: 0,  ki: 0,  vel: 4,  crit: 3,  roboHp: 0 },
    Mitico:   { atk: 0, hp: 0,  def: 0,  ki: 0,  vel: 5,  crit: 4,  roboHp: 0 },
  },
  reliquia: {
    Comun:    { atk: 0,  hp: 0,  def: 0,  ki: 4,  vel: 0,  crit: 0,  roboHp: 0 },
    Raro:     { atk: 0,  hp: 0,  def: 0,  ki: 6,  vel: 0,  crit: 0,  roboHp: 0 },
    Epico:    { atk: 0,  hp: 0,  def: 0,  ki: 9,  vel: 0,  crit: 0,  roboHp: 1 },
    Legendario: { atk: 0, hp: 0,  def: 0,  ki: 13, vel: 0,  crit: 0,  roboHp: 1 },
    Mitico:   { atk: 0, hp: 0,  def: 0,  ki: 19, vel: 0,  crit: 0,  roboHp: 2 },
  },
};

// Materiales de forja: minar y pescar ahora producen estos materiales.
const MATERIALES = {
  mineral_fragmento: { nombre: '⛏️ Fragmento de Mineral', tipo: 'mineral', porPescado: false, porMinar: true },
  mineral_esencia:   { nombre: '💎 Esencia de Mineral',   tipo: 'mineral', porPescado: false, porMinar: true },
  pesca_comun:       { nombre: '🎣 Pesca Común',          tipo: 'pesca',   porPescado: true,  porMinar: false },
  pesca_dorada:      { nombre: '🐟 Pesca Dorada',         tipo: 'pesca',   porPescado: true,  porMinar: false },
};

const MATERIAL_COSTO_MEJORA = {
  Comun:    ['mineral_fragmento'],
  Raro:     ['mineral_fragmento', 'pesca_comun'],
  Epico:    ['mineral_esencia', 'pesca_comun', 'pesca_dorada'],
  Legendario: ['mineral_esencia', 'pesca_dorada', 'pesca_dorada'],
  Mitico:   ['mineral_esencia', 'mineral_esencia', 'pesca_dorada'],
};

// Afijos aleatorios aplicables según rareza (clave → efecto).
const AFIJOS = {
  critico:   { clave: 'critico',   nombre: 'Filoso',   efecto: 'crit',   valor: 1, desc: '+1% crítico' },
  velocidad: { clave: 'velocidad', nombre: 'Veloz',    efecto: 'vel',    valor: 1, desc: '+1 VEL' },
  roboVida:  { clave: 'roboVida',  nombre: 'Sangriento', efecto: 'roboHp', valor: 1, desc: '+1% robo de vida' },
  ki:        { clave: 'ki',        nombre: 'Místico',  efecto: 'kiMax',  valor: 5, desc: '+5 Ki máx.' },
};

const AFIJOS_POR_RAREZA = {
  Comun:    [],
  Raro:     ['critico', 'velocidad', 'roboVida', 'ki'],
  Epico:    ['critico', 'velocidad', 'roboVida', 'ki'],
  Legendario: ['critico', 'velocidad', 'roboVida', 'ki'],
  Mitico:   ['critico', 'velocidad', 'roboVida', 'ki'],
};

// Sets de 3 piezas: 3 piezas del mismo set otorgan bono.
const SETS = {
  dragón: { nombre: 'Set del Dragón', bono: { atk: 8, def: 4 }, piezas: 3 },
  sombra: { nombre: 'Set de la Sombra', bono: { vel: 4, crit: 2 }, piezas: 3 },
  luna:   { nombre: 'Set Lunar', bono: { hp: 40, ki: 10 }, piezas: 3 },
};

// Clave del set por pieza (clave del equipo → set).
const PIEZA_SET = {
  katana_mitico: 'dragón', tomo_mitico: 'dragón', arco_mitico: 'dragón',
  kodachi_mitico: 'sombra', talisman_mitico: 'sombra', campana_mitico: 'sombra',
  armadura_mitico: 'dragón', accesorio_mitico: 'sombra', reliquia_mitico: 'luna',
};

// Durabilidad opcional (FASE 9). Si se activa, #reparar es sumidero de oro.
const DURABILIDAD = {
  activada: true,
  danoPorCombate: 1,     // durabilidad que se gasta por combate
  costoRepararPct: 0.05, // 5% del valor del item por punto de durabilidad
};

module.exports = {
  WEAPONS,
  HOUSES,
  CHESTS,
  OBJETOS_COMBATE,
  WEAPON_CLASSES,
  ENTRENAMIENTO,
  DESCANSO,
  REGEN,
  MANA,
  // FASE 9
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
};
