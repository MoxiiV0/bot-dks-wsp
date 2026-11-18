// Datos de enemigos: bestias comunes y jefes.

// FASE 5 — enemigos con DEF/VEL/arquetipo/elemento para el motor unificado.
// (La FASE 6 reemplaza esto por zonas con escalado por nivel.)
const ENEMIES = {
  jabali: { nombre: '🐗 Jabalí', hp: 60, atk: 8, def: 2, vel: 5, arquetipo: 'agresivo', exp: 30, oro: 100 },
  lobo: { nombre: '🐺 Lobo', hp: 80, atk: 12, def: 3, vel: 9, arquetipo: 'agresivo', exp: 50, oro: 200 },
  bandido: { nombre: '🏴‍☠️ Bandido', hp: 120, atk: 18, def: 6, vel: 7, arquetipo: 'erratico', exp: 80, oro: 400 },
  esqueleto: { nombre: '💀 Esqueleto', hp: 100, atk: 15, def: 5, vel: 5, arquetipo: 'defensivo', elemento: 'sombra', exp: 70, oro: 300 },
  dragon: { nombre: '🐉 Dragón Joven', hp: 300, atk: 35, def: 14, vel: 9, arquetipo: 'agresivo', elemento: 'fuego', exp: 250, oro: 1000 },
};

// FASE 5: todos los jefes usan el arquetipo 'jefe' (fases 70/40/15% y
// telegrafía). Los arquetipos con flavor (agresivo/defensivo/errático) son
// para los enemigos comunes.
const BOSSSES = {
  slime: { nombre: '🟣 Rey Slime', hp: 200, atk: 15, def: 5, vel: 4, arquetipo: 'jefe', elemento: 'agua', exp: 100, oro: 2000, dificultad: 1 },
  orco: { nombre: '👹 Señor Orco', hp: 350, atk: 22, def: 10, vel: 6, arquetipo: 'jefe', exp: 250, oro: 4000, dificultad: 2 },
  hechicero: { nombre: '🧙 Hechicero Oscuro', hp: 300, atk: 30, def: 8, vel: 8, arquetipo: 'jefe', elemento: 'sombra', exp: 350, oro: 6000, dificultad: 3 },
  golem: { nombre: '🗿 Golem de Piedra', hp: 600, atk: 20, def: 22, vel: 3, arquetipo: 'jefe', exp: 500, oro: 8000, dificultad: 4 },
  vampiro: { nombre: '🧛 Señor Vampiro', hp: 450, atk: 35, def: 12, vel: 12, arquetipo: 'jefe', elemento: 'sombra', exp: 700, oro: 10000, dificultad: 5 },
  dragon_viejo: { nombre: '🐉 Dragón Ancestral', hp: 1000, atk: 45, def: 20, vel: 10, arquetipo: 'jefe', elemento: 'fuego', exp: 1200, oro: 20000, dificultad: 7 },
};

module.exports = { ENEMIES, BOSSSES };
