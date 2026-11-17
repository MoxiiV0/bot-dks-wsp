// Datos de enemigos: bestias comunes y jefes.

const ENEMIES = {
  jabali: { nombre: '🐗 Jabalí', hp: 60, atk: 8, exp: 30, oro: 100 },
  lobo: { nombre: '🐺 Lobo', hp: 80, atk: 12, exp: 50, oro: 200 },
  bandido: { nombre: '🏴‍☠️ Bandido', hp: 120, atk: 18, exp: 80, oro: 400 },
  esqueleto: { nombre: '💀 Esqueleto', hp: 100, atk: 15, exp: 70, oro: 300 },
  dragon: { nombre: '🐉 Dragón Joven', hp: 300, atk: 35, exp: 250, oro: 1000 },
};

const BOSSSES = {
  slime: { nombre: '🟣 Rey Slime', hp: 200, atk: 15, exp: 100, oro: 2000, dificultad: 1 },
  orco: { nombre: '👹 Señor Orco', hp: 350, atk: 22, exp: 250, oro: 4000, dificultad: 2 },
  hechicero: { nombre: '🧙 Hechicero Oscuro', hp: 300, atk: 30, exp: 350, oro: 6000, dificultad: 3 },
  golem: { nombre: '🗿 Golem de Piedra', hp: 600, atk: 20, exp: 500, oro: 8000, dificultad: 4 },
  vampiro: { nombre: '🧛 Señor Vampiro', hp: 450, atk: 35, exp: 700, oro: 10000, dificultad: 5 },
  dragon_viejo: { nombre: '🐉 Dragón Ancestral', hp: 1000, atk: 45, exp: 1200, oro: 20000, dificultad: 7 },
};

module.exports = { ENEMIES, BOSSSES };
