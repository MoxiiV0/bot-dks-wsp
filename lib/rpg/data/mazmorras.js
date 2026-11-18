// FASE C — Mazmorras: datos de mazmorras, jefes y séquitos.
// Cada mazmorra tiene 3 jefes (pisos 10, 20, 30) con séquitos propios.
// Los enemigos normales de cada piso pertenecen a la familia del jefe del bloque.

const ESCALADO = require('./world').ESCALADO;

// ---------------------------------------------------------------------------
// Muebles auxiliares para generar enemigos por nivel
// ---------------------------------------------------------------------------
const escala = (nivel, tipo = 'normal') => {
  const s = {
    hp: Math.max(1, Math.round((ESCALADO.hp.base + ESCALADO.hp.porNivel * nivel) * (ESCALADO[tipo]?.hpMult || 1))),
    atk: Math.max(1, Math.round((ESCALADO.atk.base + ESCALADO.atk.porNivel * nivel) * (ESCALADO[tipo]?.atkMult || 1))),
    def: Math.max(0, Math.round(ESCALADO.def.base + ESCALADO.def.porNivel * nivel)),
    vel: Math.max(1, Math.round(ESCALADO.vel.base + ESCALADO.vel.porNivel * nivel)),
  };
  return s;
};

const recompensas = (nivel) => {
  const exp = Math.ceil(ESCALADO.exp.divisorBase + ESCALADO.exp.divisorPorNivel * nivel);
  const oro = Math.round(ESCALADO.oro.base + ESCALADO.oro.porNivel * nivel);
  return { exp, oro };
};

// ---------------------------------------------------------------------------
// Enemigos normales de las mazmorras (generados por piso, no son jefe)
// Cada enemigo tiene: clave, nombre, nivel, elemento, arquetipo, tipo: 'normal' | 'elite'
// Las claves usan prefijo del jefe al que pertenecen (ej: 'grRojo_' para Garra Roja)
// ---------------------------------------------------------------------------

const ENEMIGOS_MAZMORRA = {};

// ---------- 1. Cuevas de Sakura Rota (nivel base 1) ----------
// Jefe piso 10: Garra Roja, Rey Bandido (sombra)
// Jefe piso 20: Rey Bandido (fuego)
// Jefe piso 30: Titán de Piedra Viejo (tierra)

const crearEnemigo = (clave, nombre, nivel, elemento, arquetipo, tipo = 'normal') => {
  const s = escala(nivel, tipo);
  const rec = recompensas(nivel);
  return {
    clave,
    nombre,
    nivel,
    tipo,
    elemento,
    arquetipo,
    hp: s.hp,
    atk: s.atk,
    def: s.def,
    vel: s.vel,
    oro: rec.oro,
    exp: rec.exp,
    zona: 'cuevas_sakra',
  };
};

// Piso 10: Garra Roja, Rey Bandido (sombra)
ENEMIGOS_MAZMORRA.grRojo_jabalí = crearEnemigo('grRojo_jabalí', '🐗 Jabalí de Garra Roja', 5, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.grRojo_bandido = crearEnemigo('grRojo_bandido', '🏴‍☠️ Bandido de Garra Roja', 6, 'fuego', 'erratico');
ENEMIGOS_MAZMORRA.grRojo_lobo = crearEnemigo('grRojo_lobo', '🐺 Lobo de Garra Roja', 7, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.grRojo_brujo = crearEnemigo('grRojo_brujo', '🧙 Brujo de Garra Roja', 7, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.grRojo_ladrón = crearEnemigo('grRojo_ladrón', '🥷 Ladrón de Caminos', 7, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.grRojo_capataz = crearEnemigo('grRojo_capataz', '👊 Capataz de Garra Roja', 8, 'fuego', 'defensivo', 'elite');

// Piso 20: Rey Bandido (fuego)
ENEMIGOS_MAZMORRA.reyBando_bandido = crearEnemigo('reyBando_bandido', '🏴‍☠️ Bandido del Rey', 12, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.reyBando_arquero = crearEnemigo('reyBando_arquero', '🏹 Arquero Furtivo del Rey', 13, 'viento', 'erratico');
ENEMIGOS_MAZMORRA.reyBando_lobo = crearEnemigo('reyBando_lobo', '🐺 Lobo del Rey', 13, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.reyBando_brujo = crearEnemigo('reyBando_brujo', '🧙 Brujo del Rey', 13, 'fuego', 'erratico');
ENEMIGOS_MAZMORRA.reyBando_ladrón = crearEnemigo('reyBando_ladrón', '🥷 Ladrón del Rey', 13, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.reyBando_capataz = crearEnemigo('reyBando_capataz', '👊 Capataz del Rey', 14, 'fuego', 'defensivo', 'elite');

// Piso 30: Titán de Piedra Viejo (tierra)
ENEMIGOS_MAZMORRA.titán_gigante = crearEnemigo('titán_gigante', '🗿 Gigante de Piedra', 27, 'tierra', 'defensivo');
ENEMIGOS_MAZMORRA.titán_esqueleto = crearEnemigo('titán_esqueleto', '💀 Esqueleto de Piedra', 28, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.titán_golem = crearEnemigo('titán_golem', '🗿 Golem de Piedra', 29, 'tierra', 'defensivo');
ENEMIGOS_MAZMORRA.titán_momia = crearEnemigo('titán_momia', '🧟 Momia de Piedra', 29, 'agua', 'defensivo');
ENEMIGOS_MAZMORRA.titán_caballero = crearEnemigo('titán_caballero', '🦴 Caballero de Piedra', 29, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.titán_élite = crearEnemigo('titán_élite', '👑 Capitán de Piedra', 30, 'tierra', 'defensivo', 'elite');

// ---------- 2. Bosque de los Mil Torii (nivel base 8) ----------

// Piso 10: Gran Oni Musgoso (sombra)
ENEMIGOS_MAZMORRA.oniMusgoso_oni = crearEnemigo('oniMusgoso_oni', '😈 Oni Musgoso', 10, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.oniMusgoso_zorro = crearEnemigo('oniMusgoso_zorro', '🦊 Zorro del Bosque', 11, 'viento', 'erratico');
ENEMIGOS_MAZMORRA.oniMusgoso_gato = crearEnemigo('oniMusgoso_gato', '🐈‍⬛ Gato de Sombra', 12, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.oniMusgoso_oniMenor = crearEnemigo('oniMusgoso_oniMenor', '😈 Oni Menor', 14, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.oniMusgoso_zorroC = crearEnemigo('oniMusgoso_zorroC', '🦊 Zorro Carmesí', 15, 'fuego', 'erratico');
ENEMIGOS_MAZMORRA.oniMusgoso_oniCap = crearEnemigo('oniMusgoso_oniCap', '😈 Capitán Oni', 17, 'sombra', 'agresivo', 'elite');

// Piso 20: Kitsune Anciana de las Nueve Máscaras (fuego)
ENEMIGOS_MAZMORRA.kitsune_zorro = crearEnemigo('kitsune_zorro', '🦊 Zorro Anciano', 21, 'fuego', 'erratico');
ENEMIGOS_MAZMORRA.kitsune_gato = crearEnemigo('kitsune_gato', '🐈‍⬛ Gato de Sombra', 22, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.kitsune_oni = crearEnemigo('kitsune_oni', '😈 Oni del Bosque', 23, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.kitsune_bandido = crearEnemigo('kitsune_bandido', '🏴‍☠️ Bandido del Bosque', 24, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.kitsune_ladrón = crearEnemigo('kitsune_ladrón', '🥷 Ladrón del Bosque', 24, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.kitsune_élite = crearEnemigo('kitsune_élite', '👹 Capitán Oni del Bosque', 25, 'sombra', 'agresivo', 'elite');

// Piso 30: Tengu Supremo (viento)
ENEMIGOS_MAZMORRA.tengu_tengu = crearEnemigo('tengu_tengu', '👺 Tengu Supremo', 30, 'viento', 'agresivo');
ENEMIGOS_MAZMORRA.tengu_zorro = crearEnemigo('tengu_zorro', '🦊 Zorro del Trueno', 31, 'rayo', 'erratico');
ENEMIGOS_MAZMORRA.tengu_oni = crearEnemigo('tengu_oni', '😈 Oni del Trueno', 32, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.tengu_bandido = crearEnemigo('tengu_bandido', '🏴‍☠️ Bandido del Trueno', 33, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.tengu_ladrón = crearEnemigo('tengu_ladrón', '🥷 Ladrón del Trueno', 33, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.tengu_élite = crearEnemigo('tengu_élite', '👹 Capitán Oni del Trueno', 34, 'sombra', 'agresivo', 'elite');

// ---------- 3. Ruinas del Templo Lunar (nivel base 16) ----------

// Piso 10: Centinela de la Luna Quebrada (luz)
ENEMIGOS_MAZMORRA.centinela_esqueleto = crearEnemigo('centinela_esqueleto', '💀 Esqueleto de la Luna', 18, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.centinela_momia = crearEnemigo('centinela_momia', '🧟 Momia Lunar', 20, 'agua', 'defensivo');
ENEMIGOS_MAZMORRA.centinela_fantasma = crearEnemigo('centinela_fantasma', '👻 Fantasma Lunar', 22, 'luz', 'erratico');
ENEMIGOS_MAZMORRA.centinela_guardian = crearEnemigo('centinela_guardian', '🗿 Guardián del Templo', 23, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.centinela_sacerdote = crearEnemigo('centinela_sacerdote', '☠️ Sacerdote Maldito', 25, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.centinela_élite = crearEnemigo('centinela_élite', '🦴 Caballero de Huesos', 27, 'sombra', 'defensivo', 'elite');

// Piso 20: Sacerdote Eclipse (sombra)
ENEMIGOS_MAZMORRA.eclipsa_esqueleto = crearEnemigo('eclipsa_esqueleto', '💀 Esqueleto de la Luna', 21, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.eclipsa_momia = crearEnemigo('eclipsa_momia', '🧟 Momia de la Luna', 22, 'agua', 'defensivo');
ENEMIGOS_MAZMORRA.eclipsa_fantasma = crearEnemigo('eclipsa_fantasma', '👻 Fantasma de la Luna', 24, 'luz', 'erratico');
ENEMIGOS_MAZMORRA.eclipsa_guardian = crearEnemigo('eclipsa_guardian', '🗿 Guardián del Templo', 24, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.eclipsa_sacerdote = crearEnemigo('eclipsa_sacerdote', '☠️ Sacerdote Maldito', 25, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.eclipsa_élite = crearEnemigo('eclipsa_élite', '🦴 Caballero de Huesos', 27, 'sombra', 'defensivo', 'elite');

// Piso 30: Rey Esqueleto de Marfil (luz)
ENEMIGOS_MAZMORRA.reyEsq_esqueleto = crearEnemigo('reyEsq_esqueleto', '💀 Esqueleto de la Luna', 25, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.reyEsq_momia = crearEnemigo('reyEsq_momia', '🧟 Momia Lunar', 26, 'agua', 'defensivo');
ENEMIGOS_MAZMORRA.reyEsq_fantasma = crearEnemigo('reyEsq_fantasma', '👻 Fantasma de la Luna', 28, 'luz', 'erratico');
ENEMIGOS_MAZMORRA.reyEsq_guardian = crearEnemigo('reyEsq_guardian', '🗿 Guardián del Templo', 29, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.reyEsq_sacerdote = crearEnemigo('reyEsq_sacerdote', '☠️ Sacerdote Maldito', 30, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.reyEsq_élite = crearEnemigo('reyEsq_élite', '🦴 Caballero de Huesos', 29, 'sombra', 'defensivo', 'elite');

// ---------- 4. Desierto de Cristal (nivel base 26) ----------

// Piso 10: Coloso de Cristal (fuego)
ENEMIGOS_MAZMORRA.coloso_escorpión = crearEnemigo('coloso_escorpión', '🦂 Escorpión de Cristal', 27, 'rayo', 'agresivo');
ENEMIGOS_MAZMORRA.coloso_halcón = crearEnemigo('coloso_halcón', '🦅 Halcón de Cuarzo', 29, 'viento', 'agresivo');
ENEMIGOS_MAZMORRA.coloso_lagarto = crearEnemigo('coloso_lagarto', '🦎 Lagarto de Cristal', 31, 'agua', 'erratico');
ENEMIGOS_MAZMORRA.coloso_elemental = crearEnemigo('coloso_elemental', '💎 Elemental de Vidrio', 33, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.coloso_golem = crearEnemigo('coloso_golem', '🗿 Golem de Arena', 35, 'fuego', 'defensivo');
ENEMIGOS_MAZMORRA.coloso_élite = crearEnemigo('coloso_élite', '🗿 Golem de Cuarzo', 37, 'rayo', 'defensivo', 'elite');

// Piso 20: Golem de Cuarzo (luz)
ENEMIGOS_MAZMORRA.cuarzo_escorpión = crearEnemigo('cuarzo_escorpión', '🦂 Escorpión de Cristal', 28, 'rayo', 'agresivo');
ENEMIGOS_MAZMORRA.cuarzo_halcón = crearEnemigo('cuarzo_halcón', '🦅 Halcón de Cuarzo', 30, 'viento', 'agresivo');
ENEMIGOS_MAZMORRA.cuarzo_lagarto = crearEnemigo('cuarzo_lagarto', '🦎 Lagarto de Cristal', 32, 'agua', 'erratico');
ENEMIGOS_MAZMORRA.cuarzo_elemental = crearEnemigo('cuarzo_elemental', '💎 Elemental de Vidrio', 34, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.cuarzo_golem = crearEnemigo('cuarzo_golem', '🗿 Golem de Arena', 36, 'fuego', 'defensivo');
ENEMIGOS_MAZMORRA.cuarzo_élite = crearEnemigo('cuarzo_élite', '🗿 Golem de Cuarzo', 38, 'rayo', 'defensivo', 'elite');

// Piso 30: Faraón de Arena Viva (tierra)
ENEMIGOS_MAZMORRA.faraón_escorpión = crearEnemigo('faraón_escorpión', '🦂 Escorpión de Cristal', 30, 'rayo', 'agresivo');
ENEMIGOS_MAZMORRA.faraón_halcón = crearEnemigo('faraón_halcón', '🦅 Halcón de Cuarzo', 32, 'viento', 'agresivo');
ENEMIGOS_MAZMORRA.faraón_lagarto = crearEnemigo('faraón_lagarto', '🦎 Lagarto de Cristal', 34, 'agua', 'erratico');
ENEMIGOS_MAZMORRA.faraón_elemental = crearEnemigo('faraón_elemental', '💎 Elemental de Vidrio', 36, 'rayo', 'defensivo');
ENEMIGOS_MAZMORRA.faraón_golem = crearEnemigo('faraón_golem', '🗿 Golem de Arena', 38, 'fuego', 'defensivo');
ENEMIGOS_MAZMORRA.faraón_élite = crearEnemigo('faraón_élite', '🗿 Golem de Cuarzo', 40, 'rayo', 'defensivo', 'elite');

// ---------- 5. Cumbres del Trueno (nivel base 36) ----------

// Piso 10: Dragón Menor del Relámpago (fuego)
ENEMIGOS_MAZMORRA.relámpago_dragón = crearEnemigo('relámpago_dragón', '🐉 Dragón Menor', 37, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.relámpago_samurai = crearEnemigo('relámpago_samurai', '⚔️ Samurái Caído', 39, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.relámpago_espíritu = crearEnemigo('relámpago_espíritu', '⚡ Espíritu del Trueno', 41, 'rayo', 'erratico');
ENEMIGOS_MAZMORRA.relámpago_ronin = crearEnemigo('relámpago_ronin', '🗡️ Ronin Vendado', 43, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.relámpago_dragónNube = crearEnemigo('relámpago_dragónNube', '🐲 Dragón de la Nube', 45, 'viento', 'defensivo');
ENEMIGOS_MAZMORRA.relámpago_élite = crearEnemigo('relámpago_élite', '🌩️ Samurái del Trueno', 47, 'rayo', 'agresivo', 'elite');

// Piso 20: Dragón de la Nube (viento)
ENEMIGOS_MAZMORRA.nube_dragón = crearEnemigo('nube_dragón', '🐲 Dragón de la Nube', 45, 'viento', 'defensivo');
ENEMIGOS_MAZMORRA.nube_samurai = crearEnemigo('nube_samurai', '⚔️ Samurái Caído', 39, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.nube_espíritu = crearEnemigo('nube_espíritu', '⚡ Espíritu del Trueno', 41, 'rayo', 'erratico');
ENEMIGOS_MAZMORRA.nube_ronin = crearEnemigo('nube_ronin', '🗡️ Ronin Vendado', 43, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.nube_dragónMenor = crearEnemigo('nube_dragónMenor', '🐉 Dragón Menor', 37, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.nube_élite = crearEnemigo('nube_élite', '🌩️ Samurái del Trueno', 47, 'rayo', 'agresivo', 'elite');

// Piso 30: Dragón del Trueno (rayo)
ENEMIGOS_MAZMORRA.trueno_dragón = crearEnemigo('trueno_dragón', '🐉 Dragón del Trueno', 48, 'rayo', 'agresivo');
ENEMIGOS_MAZMORRA.trueno_dragónMenor = crearEnemigo('trueno_dragónMenor', '🐉 Dragón Menor', 37, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.trueno_samurai = crearEnemigo('trueno_samurai', '⚔️ Samurái Caído', 39, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.trueno_espíritu = crearEnemigo('trueno_espíritu', '⚡ Espíritu del Trueno', 41, 'rayo', 'erratico');
ENEMIGOS_MAZMORRA.trueno_ronin = crearEnemigo('trueno_ronin', '🗡️ Ronin Vendado', 43, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.trueno_dragónNube = crearEnemigo('trueno_dragónNube', '🐲 Dragón de la Nube', 45, 'viento', 'defensivo');
ENEMIGOS_MAZMORRA.trueno_élite = crearEnemigo('trueno_élite', '🌩️ Samurái del Trueno', 47, 'rayo', 'agresivo', 'elite');

// ---------- 6. Abismo Eclipse (nivel base 46) ----------

// Piso 10: Demonio Menor (sombra)
ENEMIGOS_MAZMORRA.abismo_demonio = crearEnemigo('abismo_demonio', '😈 Demonio Menor', 48, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.abismo_espectro = crearEnemigo('abismo_espectro', '🌑 Espectro del Vacío', 51, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.abismo_acechador = crearEnemigo('abismo_acechador', '👿 Acechador del Abismo', 53, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.abismo_sentinela = crearEnemigo('abismo_sentinela', '👁️ Sentinela del Eclipse', 55, 'luz', 'defensivo');
ENEMIGOS_MAZMORRA.abismo_campeón = crearEnemigo('abismo_campeón', '⚔️ Campeón del Vacío', 57, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.abismo_élite = crearEnemigo('abismo_élite', '👹 General Demonio', 59, 'sombra', 'agresivo', 'elite');

// Piso 20: Campeón del Vacío (sombra)
ENEMIGOS_MAZMORRA.vacío_demonio = crearEnemigo('vacío_demonio', '😈 Demonio Menor', 48, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.vacío_espectro = crearEnemigo('vacío_espectro', '🌑 Espectro del Vacío', 51, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.vacío_acechador = crearEnemigo('vacío_acechador', '👿 Acechador del Abismo', 53, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.vacío_sentinela = crearEnemigo('vacío_sentinela', '👁️ Sentinela del Eclipse', 55, 'luz', 'defensivo');
ENEMIGOS_MAZMORRA.vacío_campeón = crearEnemigo('vacío_campeón', '⚔️ Campeón del Vacío', 57, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.vacío_élite = crearEnemigo('vacío_élite', '👹 General Demonio', 59, 'sombra', 'agresivo', 'elite');

// Piso 30: Señor del Vacío (sombra)
ENEMIGOS_MAZMORRA.señor_demonio = crearEnemigo('señor_demonio', '😈 Demonio Menor', 48, 'sombra', 'agresivo');
ENEMIGOS_MAZMORRA.señor_espectro = crearEnemigo('señor_espectro', '🌑 Espectro del Vacío', 51, 'sombra', 'erratico');
ENEMIGOS_MAZMORRA.señor_acechador = crearEnemigo('señor_acechador', '👿 Acechador del Abismo', 53, 'fuego', 'agresivo');
ENEMIGOS_MAZMORRA.señor_sentinela = crearEnemigo('señor_sentinela', '👁️ Sentinela del Eclipse', 55, 'luz', 'defensivo');
ENEMIGOS_MAZMORRA.señor_campeón = crearEnemigo('señor_campeón', '⚔️ Campeón del Vacío', 57, 'sombra', 'defensivo');
ENEMIGOS_MAZMORRA.señor_élite = crearEnemigo('señor_élite', '👹 General Demonio', 59, 'sombra', 'agresivo', 'elite');

module.exports = { ENEMIGOS_MAZMORRA, ESCALADO, recompensas };
