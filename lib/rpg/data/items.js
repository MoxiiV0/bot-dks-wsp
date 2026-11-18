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

module.exports = { WEAPONS, HOUSES, CHESTS, OBJETOS_COMBATE, WEAPON_CLASSES, ENTRENAMIENTO, DESCANSO, REGEN, MANA };
