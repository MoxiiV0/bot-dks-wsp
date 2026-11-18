// Utilidades de narrativa/formato para mensajes de WhatsApp.
// Funciones puras: reciben valores, devuelven texto.

const { getClass } = require('../data/classes');
const { WEAPONS } = require('../data/items');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const money = (n) => '¥' + Number(n || 0).toLocaleString('en-US') + ' Coins';

const classLabel = (key) => {
  const c = getClass(key);
  return c ? c.nombre : 'Sin clase';
};

const weaponLabel = (key) => {
  const w = WEAPONS[key];
  return w ? w.nombre : 'Puños';
};

// Barra de vida simple para WhatsApp: ██████░░░░
const barra = (actual, max) => {
  const pct = Math.max(0, Math.min(1, actual / max));
  const llenos = Math.round(pct * 10);
  return '█'.repeat(llenos) + '░'.repeat(10 - llenos);
};

module.exports = { rand, pick, money, classLabel, weaponLabel, barra };
