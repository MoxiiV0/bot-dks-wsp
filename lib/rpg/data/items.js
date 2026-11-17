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
  comun: { nombre: '📦 Cofre Común', costo: 500, min: 200, max: 1500, trampa: 5 },
  raro: { nombre: '🎁 Cofre Raro', costo: 1500, min: 1000, max: 4000, trampa: 15 },
  epico: { nombre: '✨ Cofre Épico', costo: 5000, min: 3000, max: 12000, trampa: 25 },
  legendario: { nombre: '👑 Cofre Legendario', costo: 15000, min: 10000, max: 50000, trampa: 40 },
};

const WEAPON_CLASSES = {
  espada: { nombre: '🗡️ Espada', bonificacion: 'atk', valor: 2, desc: 'Ataque equilibrado y confiable.' },
  arco: { nombre: '🏹 Arco', bonificacion: 'crit', valor: 5, desc: 'Mayor probabilidad de golpe crítico.' },
  baston: { nombre: '🪵 Bastón', bonificacion: 'exp', valor: 10, desc: 'Ganas más experiencia en combate.' },
  daga: { nombre: '🔪 Daga', bonificacion: 'velocidad', valor: 3, desc: 'Ataques más rápidos, más turnos.' },
};

const ENTRENAMIENTO = {
  atk: { nombre: '⚔️ Fuerza', costo: 2000, bonus: 2, max: 50 },
  def: { nombre: '🛡️ Defensa', costo: 2000, bonus: 1, max: 40 },
  hp: { nombre: '❤️ Vitalidad', costo: 1500, bonus: 10, max: 200 },
};

const MANA = {
  costoLeer: 500,
  gananciaLeer: 10,
  costoUsar: 25,
};

module.exports = { WEAPONS, HOUSES, CHESTS, WEAPON_CLASSES, ENTRENAMIENTO, MANA };
