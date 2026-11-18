// FASE 6 — Mundo: zonas, enemigos por zona y fórmulas de escalado por nivel.
//
// Cada zona tiene 5 enemigos normales, 1 élite y 1 jefe, todos como DATA con
// elemento y arquetipo de IA. Los stats NO viven acá: se derivan de ESCALADO
// según el nivel del enemigo:
//   HP = 45 + 22*Lv | ATK = 8 + 2.6*Lv | DEF = 3 + 1.2*Lv
//   Élite: HP x1.6, ATK x1.25 | Jefe: HP x6, ATK x1.5 (con fases)
//   EXP = ceil(expToNext(Lv) / (10 + 0.25*Lv)) | Oro = 20 + 6*Lv (con variación)

const ESCALADO = {
  hp: { base: 45, porNivel: 22 },
  atk: { base: 8, porNivel: 2.6 },
  def: { base: 3, porNivel: 1.2 },
  // Extensión (el prompt no define VEL): los enemigos ganan velocidad por
  // nivel para que la iniciativa no sea siempre del jugador en zonas altas.
  vel: { base: 4, porNivel: 0.3 },
  elite: { hpMult: 1.6, atkMult: 1.25 },
  jefe: { hpMult: 6, atkMult: 1.5 },
  exp: { divisorBase: 10, divisorPorNivel: 0.25 },
  oro: { base: 20, porNivel: 6, variacion: 0.2 },
  // Pesos de #cazar (suma 100): normales vs élite. El jefe solo con #cazar jefe.
  caza: { normal: 80, elite: 20 },
};

// tipo: 'normal' | 'elite' | 'jefe'. El jefe siempre arquetipo 'jefe' (fases).
const ZONAS = {
  sakura: {
    nombre: '🌸 Aldea Sakura Rota',
    nivelMin: 1,
    nivelMax: 9,
    rangoReq: null,
    ambiente: 'Tutorial, bandidos y bestias menores',
    enemigos: {
      jabali_joven: { nombre: '🐗 Jabalí Joven', nivel: 2, tipo: 'normal', elemento: 'agua', arquetipo: 'agresivo' },
      rata_gigante: { nombre: '🐀 Rata Gigante', nivel: 3, tipo: 'normal', elemento: 'sombra', arquetipo: 'erratico' },
      lobo_rabioso: { nombre: '🐺 Lobo Rabioso', nivel: 4, tipo: 'normal', elemento: 'viento', arquetipo: 'agresivo' },
      bandido_raso: { nombre: '🏴‍☠️ Bandido Raso', nivel: 6, tipo: 'normal', elemento: 'fuego', arquetipo: 'agresivo' },
      serpiente_bamboo: { nombre: '🐍 Serpiente de Bambú', nivel: 7, tipo: 'normal', elemento: 'viento', arquetipo: 'defensivo' },
      capitan_bandido: { nombre: '⚔️ Capitán Bandido', nivel: 8, tipo: 'elite', elemento: 'fuego', arquetipo: 'agresivo' },
      oni_puente: { nombre: '👹 Oni del Puente', nivel: 9, tipo: 'jefe', elemento: 'sombra', arquetipo: 'jefe' },
    },
  },

  torii: {
    nombre: '🏯 Bosque de los Mil Torii',
    nivelMin: 8,
    nivelMax: 18,
    rangoReq: null,
    ambiente: 'Espíritus, onis y zorros',
    enemigos: {
      espiritu_torii: { nombre: '🏮 Espíritu del Torii', nivel: 10, tipo: 'normal', elemento: 'luz', arquetipo: 'defensivo' },
      zorro_espectral: { nombre: '🦊 Zorro Espectral', nivel: 11, tipo: 'normal', elemento: 'viento', arquetipo: 'erratico' },
      gato_sombra: { nombre: '🐈‍⬛ Gato de Sombra', nivel: 12, tipo: 'normal', elemento: 'sombra', arquetipo: 'erratico' },
      oni_menor: { nombre: '😈 Oni Menor', nivel: 14, tipo: 'normal', elemento: 'sombra', arquetipo: 'agresivo' },
      zorro_carmesi: { nombre: '🦊 Zorro Carmesí', nivel: 15, tipo: 'normal', elemento: 'fuego', arquetipo: 'erratico' },
      oni_capitan: { nombre: '😈 Capitán Oni', nivel: 17, tipo: 'elite', elemento: 'sombra', arquetipo: 'agresivo' },
      zorro_anciano: { nombre: '🦊 Zorro Anciano de los Torii', nivel: 18, tipo: 'jefe', elemento: 'viento', arquetipo: 'jefe' },
    },
  },

  luna: {
    nombre: '🌘 Ruinas del Templo Lunar',
    nivelMin: 16,
    nivelMax: 28,
    rangoReq: null,
    ambiente: 'No-muertos y guardianes',
    enemigos: {
      esqueleto_guerrero: { nombre: '💀 Esqueleto Guerrera', nivel: 17, tipo: 'normal', elemento: 'sombra', arquetipo: 'agresivo' },
      momia_lunar: { nombre: '🧟 Momia Lunar', nivel: 19, tipo: 'normal', elemento: 'agua', arquetipo: 'defensivo' },
      fantasma_lunar: { nombre: '👻 Fantasma Lunar', nivel: 21, tipo: 'normal', elemento: 'luz', arquetipo: 'erratico' },
      guardian_templo: { nombre: '🗿 Guardián del Templo', nivel: 23, tipo: 'normal', elemento: 'rayo', arquetipo: 'defensivo' },
      sacerdote_maldito: { nombre: '☠️ Sacerdote Maldito', nivel: 25, tipo: 'normal', elemento: 'sombra', arquetipo: 'agresivo' },
      caballero_huesos: { nombre: '🦴 Caballero de Huesos', nivel: 27, tipo: 'elite', elemento: 'sombra', arquetipo: 'defensivo' },
      guardian_lunar: { nombre: '🌕 Guardián de la Luna', nivel: 28, tipo: 'jefe', elemento: 'luz', arquetipo: 'jefe' },
    },
  },

  cristal: {
    nombre: '🏜️ Desierto de Cristal',
    nivelMin: 26,
    nivelMax: 38,
    rangoReq: 'C',
    ambiente: 'Golems y criaturas del cristal',
    enemigos: {
      escorpion_cristal: { nombre: '🦂 Escorpión de Cristal', nivel: 27, tipo: 'normal', elemento: 'rayo', arquetipo: 'agresivo' },
      halcon_cristal: { nombre: '🦅 Halcón de Cuarzo', nivel: 29, tipo: 'normal', elemento: 'viento', arquetipo: 'agresivo' },
      lagarto_cristal: { nombre: '🦎 Lagarto de Cristal', nivel: 31, tipo: 'normal', elemento: 'agua', arquetipo: 'erratico' },
      elemental_vidrio: { nombre: '💎 Elemental de Vidrio', nivel: 33, tipo: 'normal', elemento: 'rayo', arquetipo: 'defensivo' },
      golem_arena: { nombre: '🗿 Golem de Arena', nivel: 35, tipo: 'normal', elemento: 'fuego', arquetipo: 'defensivo' },
      golem_cuarzo: { nombre: '🗿 Golem de Cuarzo', nivel: 37, tipo: 'elite', elemento: 'rayo', arquetipo: 'defensivo' },
      rey_cristal: { nombre: '👑 Rey del Cristal', nivel: 38, tipo: 'jefe', elemento: 'rayo', arquetipo: 'jefe' },
    },
  },

  trueno: {
    nombre: '⛰️ Cumbres del Trueno',
    nivelMin: 36,
    nivelMax: 48,
    rangoReq: 'B',
    ambiente: 'Dragones menores y samuráis caídos',
    enemigos: {
      dragon_menor: { nombre: '🐉 Dragón Menor', nivel: 37, tipo: 'normal', elemento: 'fuego', arquetipo: 'agresivo' },
      samurai_caido: { nombre: '⚔️ Samurái Caído', nivel: 39, tipo: 'normal', elemento: 'sombra', arquetipo: 'agresivo' },
      espiritu_trueno: { nombre: '⚡ Espíritu del Trueno', nivel: 41, tipo: 'normal', elemento: 'rayo', arquetipo: 'erratico' },
      ronin_vendado: { nombre: '🗡️ Ronin Vendado', nivel: 43, tipo: 'normal', elemento: 'sombra', arquetipo: 'defensivo' },
      dragon_nube: { nombre: '🐲 Dragón de la Nube', nivel: 45, tipo: 'normal', elemento: 'viento', arquetipo: 'defensivo' },
      samurai_trueno: { nombre: '🌩️ Samurái del Trueno', nivel: 47, tipo: 'elite', elemento: 'rayo', arquetipo: 'agresivo' },
      dragon_trueno: { nombre: '🐉 Dragón del Trueno', nivel: 48, tipo: 'jefe', elemento: 'rayo', arquetipo: 'jefe' },
    },
  },

  abismo: {
    nombre: '🌑 Abismo Eclipse',
    nivelMin: 46,
    nivelMax: 60,
    rangoReq: 'A',
    ambiente: 'Demonios y señores del vacío',
    enemigos: {
      demonio_menor: { nombre: '😈 Demonio Menor', nivel: 48, tipo: 'normal', elemento: 'sombra', arquetipo: 'agresivo' },
      espectro_vacio: { nombre: '🌑 Espectro del Vacío', nivel: 51, tipo: 'normal', elemento: 'sombra', arquetipo: 'erratico' },
      acechador_abismo: { nombre: '👿 Acechador del Abismo', nivel: 53, tipo: 'normal', elemento: 'fuego', arquetipo: 'agresivo' },
      sentinela_eclipse: { nombre: '👁️ Sentinela del Eclipse', nivel: 55, tipo: 'normal', elemento: 'luz', arquetipo: 'defensivo' },
      campeon_vacio: { nombre: '⚔️ Campeón del Vacío', nivel: 57, tipo: 'normal', elemento: 'sombra', arquetipo: 'defensivo' },
      demonio_general: { nombre: '👹 General Demonio', nivel: 59, tipo: 'elite', elemento: 'sombra', arquetipo: 'agresivo' },
      senor_vacio: { nombre: '🕳️ Señor del Vacío', nivel: 60, tipo: 'jefe', elemento: 'sombra', arquetipo: 'jefe' },
    },
  },
};

// Zona inicial de todo jugador nuevo.
const ZONA_INICIAL = 'sakura';

module.exports = { ZONAS, ZONA_INICIAL, ESCALADO };
